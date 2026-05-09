import {
  getCompletedCheckpointSteps,
  getCompletedCount,
  getEarnedBadgeCount,
  getLastActiveAt,
  getLesson,
  getLessonCompletedAt,
  getLessonNotes,
  getUnlockAllLessons,
  getTrack,
  loadAppState,
  loadLessonCatalog,
  saveAppState,
  setLessonNotes,
  setUnlockAllLessons,
  setActiveProfile,
} from "./state.js";

import "./swRegister.js";
import { ensureTeacherModeUnlocked, isTeacherModeUnlocked, lockTeacherModeSession } from "./teacherGate.js";
import { CURRICULUM_UNITS, getUnitForLesson } from "./curriculum.js";

const profileSelect = document.querySelector("#report-profile-select");
const summaryName = document.querySelector("#summary-name");
const summaryAge = document.querySelector("#summary-age");
const summaryLastActive = document.querySelector("#summary-last-active");
const summaryBadges = document.querySelector("#summary-badges");
const summaryTrack = document.querySelector("#summary-track");
const summaryLesson = document.querySelector("#summary-lesson");
const summaryProgress = document.querySelector("#summary-progress");
const trackSections = document.querySelector("#track-sections");
const printButton = document.querySelector("#print-report");
const hideCompletedToggle = document.querySelector("#report-hide-completed");
const activityList = document.querySelector("#activity-list");
const clearActivityButton = document.querySelector("#clear-activity");
const teacherModeButton = document.querySelector("#teacher-mode");
const lockSessionButton = document.querySelector("#lock-session");
const notesModal = document.querySelector("#notes-modal");
const closeNotesButton = document.querySelector("#close-notes");
const notesSubtitle = document.querySelector("#notes-subtitle");
const notesLearner = document.querySelector("#notes-learner");
const notesParent = document.querySelector("#notes-parent");
const unlockTeacherButton = document.querySelector("#unlock-teacher");
const notesSaveButton = document.querySelector("#save-notes");
const notesStatus = document.querySelector("#notes-status");
const notesOpenSheet = document.querySelector("#notes-open-sheet");
const unlockAllLessonsToggle = document.querySelector("#unlock-all-lessons");

let appState = loadAppState();
let lessonCatalog = { tracks: [] };
let activeProfile = null;
const profileFromQuery = new URLSearchParams(window.location.search).get("profile");
let editingTrackId = "";
let editingLessonId = "";
const REPORT_HIDE_COMPLETED_KEY = "homeschool-coders-report-hide-completed-v1";
let hideCompleted = false;
let teacherModeUnlocked = false;

function setTeacherMode(unlocked) {
  teacherModeUnlocked = Boolean(unlocked);
  document.body.classList.toggle("teacher-unlocked", teacherModeUnlocked);
  document.body.classList.toggle("teacher-locked", !teacherModeUnlocked);

  if (teacherModeButton) {
    teacherModeButton.textContent = teacherModeUnlocked ? "Teacher mode: Unlocked" : "Teacher mode: Locked";
    teacherModeButton.setAttribute("aria-pressed", teacherModeUnlocked ? "true" : "false");
  }

  if (lockSessionButton) {
    lockSessionButton.hidden = !teacherModeUnlocked;
  }

  if (unlockAllLessonsToggle) {
    unlockAllLessonsToggle.disabled = !teacherModeUnlocked;
  }

  if (clearActivityButton) {
    clearActivityButton.disabled = !teacherModeUnlocked;
  }

  if (notesLearner) {
    notesLearner.readOnly = !teacherModeUnlocked;
  }
  if (notesParent) {
    notesParent.readOnly = !teacherModeUnlocked;
  }

  if (notesSaveButton) {
    notesSaveButton.disabled = !teacherModeUnlocked;
    notesSaveButton.hidden = !teacherModeUnlocked;
  }
  if (unlockTeacherButton) {
    unlockTeacherButton.hidden = teacherModeUnlocked;
  }
}

function unlockTeacherMode() {
  const ok = ensureTeacherModeUnlocked({ purpose: "Teacher mode" });
  if (ok) {
    setTeacherMode(true);
  }
}

function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getActiveTrackForProfile(profile) {
  const trackId = getTrack(lessonCatalog, profile.progress.activeTrackId)
    ? profile.progress.activeTrackId
    : profile.age <= 9
      ? "kids"
      : "explorer";
  return getTrack(lessonCatalog, trackId);
}

function getCurrentLessonForProfile(profile, track) {
  const trackId = track?.id || (profile.age <= 9 ? "kids" : "explorer");
  const lessonId = profile.progress.activeLessonIdByTrack[trackId] || track?.lessons?.[0]?.id || "";
  return getLesson(lessonCatalog, trackId, lessonId);
}

function renderProfileSelect() {
  profileSelect.innerHTML = "";
  appState.profiles.forEach((profile) => {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = `${profile.name} · age ${profile.age}`;
    profileSelect.append(option);
  });
  profileSelect.value = activeProfile?.id || "";
}

function renderSummary() {
  if (!activeProfile) {
    return;
  }
  const track = getActiveTrackForProfile(activeProfile);
  const lesson = getCurrentLessonForProfile(activeProfile, track);
  const trackId = track?.id || (activeProfile.age <= 9 ? "kids" : "explorer");
  const completed = getCompletedCount(lessonCatalog, activeProfile, trackId);
  const total = track?.lessons?.length || 0;

  summaryName.textContent = activeProfile.name;
  summaryAge.textContent = `Age: ${activeProfile.age}`;
  summaryLastActive.textContent = `Last active: ${formatDate(getLastActiveAt(activeProfile))}`;
  summaryBadges.textContent = `Badges earned: ${getEarnedBadgeCount(activeProfile)}`;
  summaryTrack.textContent = track?.title || "Track";
  summaryLesson.textContent = `Current lesson: ${lesson?.title || "Not started yet"}`;
  summaryProgress.textContent = `Track progress: ${completed} / ${total}`;

  if (unlockAllLessonsToggle) {
    unlockAllLessonsToggle.checked = getUnlockAllLessons(activeProfile);
  }
}

function renderActivity() {
  if (!activityList) {
    return;
  }
  activityList.innerHTML = "";

  if (!activeProfile) {
    return;
  }

  const items = Array.isArray(activeProfile.progress.recentActivity) ? activeProfile.progress.recentActivity : [];
  if (!items.length) {
    activityList.innerHTML = `<div class="muted">No recent activity yet.</div>`;
    return;
  }

  items.slice(0, 12).forEach((item) => {
    const message = typeof item?.message === "string" ? item.message : "";
    const time = item?.time ? new Date(item.time) : null;
    const row = document.createElement("article");
    row.className = "activity-item";
    row.innerHTML = `
      <strong>${escapeHtml(message || "Activity")}</strong>
      <p>${escapeHtml(time ? formatDate(time) : "—")}</p>
    `;
    activityList.append(row);
  });
}

function renderTrackCards() {
  trackSections.innerHTML = "";
  if (!activeProfile) {
    return;
  }

  (lessonCatalog.tracks || []).forEach((track) => {
    const trackId = track.id;
    const completedCount = getCompletedCount(lessonCatalog, activeProfile, trackId);
    const totalCount = track.lessons.length;
    const remainingCount = Math.max(0, totalCount - completedCount);
    const units = CURRICULUM_UNITS[trackId] || [];

    const card = document.createElement("section");
    card.className = "track-card";
    card.innerHTML = `
      <div class="track-head">
        <div>
          <p class="eyebrow">Track</p>
          <h2>${track.title}</h2>
          <p class="track-meta">
            ${completedCount} / ${totalCount} lessons completed${hideCompleted ? ` · ${remainingCount} remaining shown` : ""}
          </p>
        </div>
        <div class="track-actions">
          <a class="ghost-link" href="./track.html?profile=${encodeURIComponent(activeProfile.id)}&track=${encodeURIComponent(trackId)}">Print track</a>
        </div>
      </div>
      <div class="unit-strip" data-unit-strip="true"></div>
      <table class="lesson-table">
        <thead>
          <tr>
            <th>Lesson</th>
            <th>Status</th>
            <th>Completed</th>
            <th>Steps</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    `;

    const unitStrip = card.querySelector("[data-unit-strip]");
    if (unitStrip) {
      if (units.length) {
        units.forEach((unit) => {
          const unitLessons = unit.lessonIds
            .map((lessonId) => track.lessons.find((item) => item.id === lessonId))
            .filter(Boolean);
          const unitDone = unitLessons.filter((lesson) => Boolean(activeProfile.progress.completedLessons?.[trackId]?.[lesson.id])).length;
          const unitTotal = unitLessons.length;
          const unitLink = document.createElement("a");
          unitLink.className = "unit-pill";
          unitLink.href = `./unit.html?profile=${encodeURIComponent(activeProfile.id)}&track=${encodeURIComponent(trackId)}&unit=${encodeURIComponent(unit.id)}`;
          unitLink.innerHTML = `<strong>${escapeHtml(unit.title)}</strong><span>${unitDone}/${unitTotal}</span>`;
          unitStrip.append(unitLink);
        });
      } else {
        unitStrip.remove();
      }
    }

    const tbody = card.querySelector("tbody");
    track.lessons.forEach((lesson, index) => {
      const done = Boolean(activeProfile.progress.completedLessons?.[trackId]?.[lesson.id]);
      if (hideCompleted && done) {
        return;
      }
      const completedAt = getLessonCompletedAt(activeProfile, trackId, lesson.id);
      const stepsCleared = getCompletedCheckpointSteps(activeProfile, trackId, lesson.id).length;
      const stepsTotal = Array.isArray(lesson.milestones) ? lesson.milestones.length : "—";
      const notes = getLessonNotes(activeProfile, trackId, lesson.id);
      const noteText = (notes?.parentText || notes?.learnerText || "").trim();
      const noteSnippet = noteText ? (noteText.length > 48 ? `${noteText.slice(0, 48)}…` : noteText) : "—";
      const safeSnippet = escapeHtml(noteSnippet);
      const safeTitle = escapeHtml(noteText);
      const lessonHref = `./learn.html?profile=${encodeURIComponent(activeProfile.id)}&track=${encodeURIComponent(trackId)}&lesson=${encodeURIComponent(lesson.id)}`;
      const unitTitle = getUnitForLesson(trackId, lesson.id)?.title || "";
      const unitLine = unitTitle ? `<div class="unit-tag">${escapeHtml(unitTitle)}</div>` : "";

      const row = document.createElement("tr");
      row.dataset.trackId = trackId;
      row.dataset.lessonId = lesson.id;
      row.innerHTML = `
        <td>
          <a class="lesson-link" href="${lessonHref}">
            <strong>${index + 1}. ${lesson.title}</strong>
          </a>
          ${unitLine}
          <div class="muted">${lesson.description}</div>
        </td>
        <td><span class="pill ${done ? "done" : "todo"}">${done ? "Completed" : "In progress"}</span></td>
        <td>${done ? formatDate(completedAt) : "—"}</td>
        <td>${stepsCleared} / ${stepsTotal}</td>
        <td>
          <button class="notes-button" type="button" data-edit-notes="true" title="${safeTitle}">
            ${safeSnippet || "—"}
          </button>
        </td>
      `;
      tbody.append(row);
    });

    trackSections.append(card);
  });
}

function renderAll() {
  renderProfileSelect();
  renderSummary();
  renderActivity();
  renderTrackCards();
}

function switchProfile(profileId) {
  const nextProfile = appState.profiles.find((profile) => profile.id === profileId) || null;
  if (!nextProfile) {
    return;
  }
  activeProfile = nextProfile;
  setActiveProfile(appState, profileId);
  saveAppState(appState);
  renderAll();
}

function hideNotesModal() {
  if (!notesModal) {
    return;
  }
  notesModal.classList.remove("open");
  notesModal.setAttribute("aria-hidden", "true");
  editingTrackId = "";
  editingLessonId = "";
}

function showNotesModal(trackId, lessonId) {
  if (!notesModal || !activeProfile || !notesLearner || !notesParent || !notesSubtitle || !notesStatus || !notesOpenSheet) {
    return;
  }
  const lesson = getLesson(lessonCatalog, trackId, lessonId);
  if (!lesson) {
    return;
  }

  editingTrackId = trackId;
  editingLessonId = lessonId;

  const existing = getLessonNotes(activeProfile, trackId, lessonId);
  notesLearner.value = existing?.learnerText || "";
  notesParent.value = existing?.parentText || "";
  notesSubtitle.textContent = `${activeProfile.name} · ${getTrack(lessonCatalog, trackId)?.title || trackId} · ${lesson.title}`;
  if (!teacherModeUnlocked) {
    notesStatus.textContent = "Teacher mode is locked. Unlock to edit and save notes.";
  } else {
    notesStatus.textContent = existing?.updatedAt ? `Last saved: ${formatDate(new Date(existing.updatedAt))}` : "Add notes, then save.";
  }
  notesOpenSheet.href = `./lesson.html?profile=${encodeURIComponent(activeProfile.id)}&track=${encodeURIComponent(trackId)}&lesson=${encodeURIComponent(lessonId)}`;

  notesModal.classList.add("open");
  notesModal.setAttribute("aria-hidden", "false");
  if (!teacherModeUnlocked && unlockTeacherButton) {
    unlockTeacherButton.focus();
  } else {
    notesParent.focus();
  }
}

profileSelect.addEventListener("change", () => {
  switchProfile(profileSelect.value);
});

if (clearActivityButton) {
  clearActivityButton.addEventListener("click", () => {
    if (!teacherModeUnlocked) {
      unlockTeacherMode();
      return;
    }
    if (!activeProfile) {
      return;
    }
    const ok = window.confirm(`Clear recent activity for ${activeProfile.name}?`);
    if (!ok) {
      return;
    }
    activeProfile.progress.recentActivity = [];
    saveAppState(appState);
    renderActivity();
  });
}

if (hideCompletedToggle) {
  hideCompletedToggle.addEventListener("change", () => {
    hideCompleted = Boolean(hideCompletedToggle.checked);
    window.localStorage.setItem(REPORT_HIDE_COMPLETED_KEY, hideCompleted ? "1" : "0");
    renderTrackCards();
  });
}

if (printButton) {
  printButton.addEventListener("click", () => {
    window.print();
  });
}

if (trackSections) {
  trackSections.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const editButton = target.closest("[data-edit-notes]");
    if (!editButton) {
      return;
    }
    const row = editButton.closest("tr");
    const trackId = row?.dataset?.trackId;
    const lessonId = row?.dataset?.lessonId;
    if (!trackId || !lessonId) {
      return;
    }
    showNotesModal(trackId, lessonId);
  });
}

if (notesModal) {
  notesModal.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.dataset.closeModal) {
      hideNotesModal();
    }
  });
}

if (closeNotesButton) {
  closeNotesButton.addEventListener("click", hideNotesModal);
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && notesModal?.classList.contains("open")) {
    hideNotesModal();
  }
});

if (notesSaveButton) {
  notesSaveButton.addEventListener("click", () => {
    if (!teacherModeUnlocked) {
      unlockTeacherMode();
      return;
    }
    if (!activeProfile || !editingTrackId || !editingLessonId || !notesLearner || !notesParent || !notesStatus) {
      return;
    }
    setLessonNotes(activeProfile, editingTrackId, editingLessonId, {
      learnerText: notesLearner.value,
      parentText: notesParent.value,
    });
    saveAppState(appState);
    notesStatus.textContent = `Saved: ${formatDate(new Date())}`;
    renderTrackCards();
  });
}

if (unlockAllLessonsToggle) {
  unlockAllLessonsToggle.addEventListener("change", () => {
    if (!teacherModeUnlocked) {
      unlockTeacherMode();
      unlockAllLessonsToggle.checked = activeProfile ? getUnlockAllLessons(activeProfile) : false;
      return;
    }
    if (!activeProfile) {
      return;
    }
    setUnlockAllLessons(activeProfile, unlockAllLessonsToggle.checked);
    saveAppState(appState);
    renderAll();
  });
}

if (teacherModeButton) {
  teacherModeButton.addEventListener("click", () => {
    if (teacherModeUnlocked) {
      setTeacherMode(false);
      return;
    }
    unlockTeacherMode();
  });
}

if (lockSessionButton) {
  lockSessionButton.addEventListener("click", () => {
    lockTeacherModeSession();
    setTeacherMode(false);
    window.alert("Teacher session locked. Next teacher action will ask for the parent code again.");
  });
}

if (unlockTeacherButton) {
  unlockTeacherButton.addEventListener("click", () => {
    unlockTeacherMode();
    if (notesModal?.classList.contains("open")) {
      if (teacherModeUnlocked) {
        notesParent?.focus();
        notesStatus.textContent = "Teacher mode unlocked. You can edit and save now.";
      }
    }
  });
}

async function boot() {
  try {
    lessonCatalog = await loadLessonCatalog();
  } catch (_error) {
    lessonCatalog = { tracks: [] };
  }

  if (!appState.profiles.length) {
    window.location.href = "./index.html";
    return;
  }

  hideCompleted = window.localStorage.getItem(REPORT_HIDE_COMPLETED_KEY) === "1";
  if (hideCompletedToggle) {
    hideCompletedToggle.checked = hideCompleted;
  }

  setTeacherMode(isTeacherModeUnlocked());

  activeProfile =
    appState.profiles.find((profile) => profile.id === profileFromQuery) ||
    appState.profiles.find((profile) => profile.id === appState.activeProfileId) ||
    appState.profiles[0];
  renderAll();
}

boot();

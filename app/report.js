import {
  getCompletedCheckpointSteps,
  getCompletedCount,
  getEarnedBadgeCount,
  getLastActiveAt,
  getLesson,
  getLessonCompletedAt,
  getLessonNotes,
  getTrack,
  loadAppState,
  loadLessonCatalog,
  saveAppState,
  setLessonNotes,
  setActiveProfile,
} from "./state.js";

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
const notesModal = document.querySelector("#notes-modal");
const closeNotesButton = document.querySelector("#close-notes");
const notesSubtitle = document.querySelector("#notes-subtitle");
const notesLearner = document.querySelector("#notes-learner");
const notesParent = document.querySelector("#notes-parent");
const notesSaveButton = document.querySelector("#save-notes");
const notesStatus = document.querySelector("#notes-status");
const notesOpenSheet = document.querySelector("#notes-open-sheet");

let appState = loadAppState();
let lessonCatalog = { tracks: [] };
let activeProfile = null;
const profileFromQuery = new URLSearchParams(window.location.search).get("profile");
let editingTrackId = "";
let editingLessonId = "";

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

    const card = document.createElement("section");
    card.className = "track-card";
    card.innerHTML = `
      <div class="track-head">
        <div>
          <p class="eyebrow">Track</p>
          <h2>${track.title}</h2>
          <p class="track-meta">${completedCount} / ${totalCount} lessons completed</p>
        </div>
      </div>
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

    const tbody = card.querySelector("tbody");
    track.lessons.forEach((lesson, index) => {
      const done = Boolean(activeProfile.progress.completedLessons?.[trackId]?.[lesson.id]);
      const completedAt = getLessonCompletedAt(activeProfile, trackId, lesson.id);
      const stepsCleared = getCompletedCheckpointSteps(activeProfile, trackId, lesson.id).length;
      const stepsTotal = Array.isArray(lesson.milestones) ? lesson.milestones.length : "—";
      const notes = getLessonNotes(activeProfile, trackId, lesson.id);
      const noteText = (notes?.parentText || notes?.learnerText || "").trim();
      const noteSnippet = noteText ? (noteText.length > 48 ? `${noteText.slice(0, 48)}…` : noteText) : "—";
      const safeSnippet = escapeHtml(noteSnippet);
      const safeTitle = escapeHtml(noteText);
      const lessonHref = `./learn.html?profile=${encodeURIComponent(activeProfile.id)}&track=${encodeURIComponent(trackId)}&lesson=${encodeURIComponent(lesson.id)}`;

      const row = document.createElement("tr");
      row.dataset.trackId = trackId;
      row.dataset.lessonId = lesson.id;
      row.innerHTML = `
        <td>
          <a class="lesson-link" href="${lessonHref}">
            <strong>${index + 1}. ${lesson.title}</strong>
          </a>
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
  notesStatus.textContent = existing?.updatedAt ? `Last saved: ${formatDate(new Date(existing.updatedAt))}` : "Add notes, then save.";
  notesOpenSheet.href = `./lesson.html?profile=${encodeURIComponent(activeProfile.id)}&track=${encodeURIComponent(trackId)}&lesson=${encodeURIComponent(lessonId)}`;

  notesModal.classList.add("open");
  notesModal.setAttribute("aria-hidden", "false");
  notesParent.focus();
}

profileSelect.addEventListener("change", () => {
  switchProfile(profileSelect.value);
});

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

  activeProfile =
    appState.profiles.find((profile) => profile.id === profileFromQuery) ||
    appState.profiles.find((profile) => profile.id === appState.activeProfileId) ||
    appState.profiles[0];
  renderAll();
}

boot();

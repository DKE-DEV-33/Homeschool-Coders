import { COMMAND_REFERENCE } from "./commands.js";
import { ensureTeacherModeUnlocked, isTeacherModeUnlocked } from "./teacherGate.js";
import {
  getCompletedCheckpointSteps,
  getLesson,
  getLessonCompletedAt,
  getLessonNotes,
  getProfile,
  getTrack,
  isLessonComplete,
  loadAppState,
  loadLessonCatalog,
} from "./state.js";

const teacherLock = document.querySelector("#teacher-lock");
const unlockTeacherButton = document.querySelector("#unlock-teacher");
const sheetTitle = document.querySelector("#sheet-title");
const backStudio = document.querySelector("#back-studio");
const backReport = document.querySelector("#back-report");
const printButton = document.querySelector("#print-sheet");
const sheetLearner = document.querySelector("#sheet-learner");
const sheetStatus = document.querySelector("#sheet-status");
const missionTitle = document.querySelector("#mission-title");
const missionCopy = document.querySelector("#mission-copy");
const targetSteps = document.querySelector("#target-steps");
const milestoneList = document.querySelector("#milestone-list");
const conceptCopy = document.querySelector("#concept-copy");
const commandList = document.querySelector("#command-list");
const savedNotesMeta = document.querySelector("#saved-notes-meta");
const savedNotesLearner = document.querySelector("#saved-notes-learner");
const savedNotesParent = document.querySelector("#saved-notes-parent");

let appState = loadAppState();
let lessonCatalog = { tracks: [] };

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

function setTeacherLockVisible(visible) {
  if (!teacherLock) {
    return;
  }
  teacherLock.classList.toggle("show", visible);
  teacherLock.setAttribute("aria-hidden", visible ? "false" : "true");
}

function renderLessonSheet({ profileId, trackId, lessonId }) {
  const track = getTrack(lessonCatalog, trackId);
  const lesson = getLesson(lessonCatalog, trackId, lessonId);

  if (!track || !lesson) {
    sheetTitle.textContent = "Lesson not found";
    missionTitle.textContent = "Missing lesson";
    missionCopy.textContent = "That lesson link is missing or out of date.";
    return;
  }

  const profile = profileId ? getProfile(appState, profileId) : null;
  const studioHref = `./learn.html?profile=${encodeURIComponent(profileId || "")}&track=${encodeURIComponent(trackId)}&lesson=${encodeURIComponent(lessonId)}`;
  const reportHref = profile ? `./report.html?profile=${encodeURIComponent(profile.id)}` : "./report.html";
  backStudio.href = studioHref;
  backReport.href = reportHref;

  sheetTitle.textContent = `${track.title}: ${lesson.title}`;
  missionTitle.textContent = lesson.title;
  missionCopy.textContent = lesson.mission || lesson.description || "";

  targetSteps.innerHTML = "";
  (lesson.targetSteps || []).forEach((step) => {
    const pill = document.createElement("span");
    pill.textContent = step;
    targetSteps.append(pill);
  });

  milestoneList.innerHTML = "";
  (lesson.milestones || []).forEach((step) => {
    const item = document.createElement("li");
    item.textContent = step.title || step.description || "";
    milestoneList.append(item);
  });

  conceptCopy.textContent = lesson.concept ? `Concept: ${lesson.concept}` : "";

  commandList.innerHTML = "";
  (lesson.allowedCommands || [])
    .map((key) => COMMAND_REFERENCE[key])
    .filter(Boolean)
    .forEach((command) => {
      const row = document.createElement("article");
      row.className = "command-item";
      row.innerHTML = `<code>${escapeHtml(command.signature)}</code><p>${escapeHtml(command.description)}</p>`;
      commandList.append(row);
    });

  if (profile) {
    const done = isLessonComplete(profile, trackId, lessonId);
    const completedAt = getLessonCompletedAt(profile, trackId, lessonId);
    const stepsCleared = getCompletedCheckpointSteps(profile, trackId, lessonId).length;
    const totalSteps = Array.isArray(lesson.milestones) ? lesson.milestones.length : 0;
    sheetLearner.textContent = `Learner: ${profile.name} (age ${profile.age})`;
    sheetStatus.textContent = done
      ? `Status: Completed on ${formatDate(completedAt)} · ${stepsCleared}/${totalSteps} steps`
      : `Status: In progress · ${stepsCleared}/${totalSteps} steps`;

    const notes = getLessonNotes(profile, trackId, lessonId);
    const updatedAt = notes?.updatedAt ? new Date(notes.updatedAt) : null;
    if (savedNotesMeta && savedNotesLearner && savedNotesParent) {
      savedNotesMeta.textContent = updatedAt ? `Last saved: ${formatDate(updatedAt)}` : "No notes saved for this lesson yet.";
      savedNotesLearner.textContent = (notes?.learnerText || "").trim() || "—";
      savedNotesParent.textContent = (notes?.parentText || "").trim() || "—";
    }
  } else {
    sheetLearner.textContent = "";
    sheetStatus.textContent = "";
    if (savedNotesMeta && savedNotesLearner && savedNotesParent) {
      savedNotesMeta.textContent = "Open this sheet from the Report or Studio to include saved notes.";
      savedNotesLearner.textContent = "—";
      savedNotesParent.textContent = "—";
    }
  }
}

if (printButton) {
  printButton.addEventListener("click", () => window.print());
}

if (unlockTeacherButton) {
  unlockTeacherButton.addEventListener("click", () => {
    const ok = ensureTeacherModeUnlocked({ purpose: "printing lesson sheets" });
    if (ok) {
      setTeacherLockVisible(false);
      boot();
    }
  });
}

async function boot() {
  if (!isTeacherModeUnlocked()) {
    setTeacherLockVisible(true);
    return;
  }

  setTeacherLockVisible(false);

  const params = new URLSearchParams(window.location.search);
  const profileId = params.get("profile") || "";
  const trackId = params.get("track") || "kids";
  const lessonId = params.get("lesson") || "";

  try {
    lessonCatalog = await loadLessonCatalog();
  } catch (_error) {
    lessonCatalog = { tracks: [] };
  }

  renderLessonSheet({ profileId, trackId, lessonId });
}

boot();

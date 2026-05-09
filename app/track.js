import "./swRegister.js";
import { ensureTeacherModeUnlocked, isTeacherModeUnlocked } from "./teacherGate.js";
import {
  getCompletedCount,
  getLessonCompletedAt,
  getProfile,
  getTrack,
  isLessonComplete,
  loadAppState,
  loadLessonCatalog,
} from "./state.js";

const teacherLock = document.querySelector("#teacher-lock");
const unlockTeacherButton = document.querySelector("#unlock-teacher");
const backReport = document.querySelector("#back-report");
const backStudio = document.querySelector("#back-studio");
const printButton = document.querySelector("#print-track");
const trackTitle = document.querySelector("#track-title");
const learnerLine = document.querySelector("#track-learner");
const progressLine = document.querySelector("#track-progress");
const lessonList = document.querySelector("#track-lessons");

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

function renderTrackSheet({ profileId, trackId }) {
  const track = getTrack(lessonCatalog, trackId);
  const profile = profileId ? getProfile(appState, profileId) : null;

  if (!track) {
    trackTitle.textContent = "Track not found";
    lessonList.innerHTML = `<li class="muted">That track link is missing or out of date.</li>`;
    return;
  }

  trackTitle.textContent = `${track.title} track`;
  if (profile) {
    const completedCount = getCompletedCount(lessonCatalog, profile, trackId);
    learnerLine.textContent = `Learner: ${profile.name} (age ${profile.age})`;
    progressLine.textContent = `Progress: ${completedCount} / ${track.lessons.length} lessons completed`;
    backReport.href = `./report.html?profile=${encodeURIComponent(profile.id)}`;
    backStudio.href = `./learn.html?profile=${encodeURIComponent(profile.id)}&track=${encodeURIComponent(trackId)}`;
  } else {
    learnerLine.textContent = "";
    progressLine.textContent = "";
    backReport.href = "./report.html";
    backStudio.href = "./learn.html";
  }

  lessonList.innerHTML = "";
  track.lessons.forEach((lesson, index) => {
    const done = profile ? isLessonComplete(profile, trackId, lesson.id) : false;
    const completedAt = profile ? getLessonCompletedAt(profile, trackId, lesson.id) : null;
    const row = document.createElement("li");
    row.className = `lesson-row ${done ? "completed" : ""}`.trim();
    row.innerHTML = `
      <div class="checkbox" aria-hidden="true"></div>
      <div class="lesson-text">
        <strong>${index + 1}. ${escapeHtml(lesson.title)}</strong>
        <span>${escapeHtml(lesson.description || "")}</span>
        <em>${done ? `Completed: ${escapeHtml(formatDate(completedAt))}` : "Completed: __________"}</em>
      </div>
    `;
    lessonList.append(row);
  });
}

if (printButton) {
  printButton.addEventListener("click", () => window.print());
}

if (unlockTeacherButton) {
  unlockTeacherButton.addEventListener("click", () => {
    const ok = ensureTeacherModeUnlocked({ purpose: "printing track checklists" });
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

  try {
    lessonCatalog = await loadLessonCatalog();
  } catch (_error) {
    lessonCatalog = { tracks: [] };
  }

  renderTrackSheet({ profileId, trackId });
}

boot();

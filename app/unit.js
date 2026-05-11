import { CURRICULUM_UNITS } from "./curriculum.js";
import "./swRegister.js";
import "./offlineStatus.js";
import { ensureTeacherModeUnlocked, isTeacherModeUnlocked } from "./teacherGate.js";
import {
  getLessonCompletedAt,
  getProfile,
  getTrack,
  isLessonComplete,
  loadAppState,
  loadLessonCatalog,
} from "./state.js";

const teacherLock = document.querySelector("#teacher-lock");
const unlockTeacherButton = document.querySelector("#unlock-teacher");
const backCurriculum = document.querySelector("#back-curriculum");
const backReport = document.querySelector("#back-report");
const backStudio = document.querySelector("#back-studio");
const printButton = document.querySelector("#print-unit");
const unitTitle = document.querySelector("#unit-title");
const learnerLine = document.querySelector("#unit-learner");
const progressLine = document.querySelector("#unit-progress");
const lessonList = document.querySelector("#unit-lessons");

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

function getUnit(trackId, unitId) {
  return (CURRICULUM_UNITS[trackId] || []).find((unit) => unit.id === unitId) || null;
}

function renderUnitSheet({ profileId, trackId, unitId }) {
  const track = getTrack(lessonCatalog, trackId);
  const unit = getUnit(trackId, unitId);
  const profile = profileId ? getProfile(appState, profileId) : null;

  if (!track || !unit) {
    unitTitle.textContent = "Unit not found";
    lessonList.innerHTML = `<li>That unit link is missing or out of date.</li>`;
    return;
  }

  unitTitle.textContent = unit.title;
  if (profile) {
    learnerLine.textContent = `Learner: ${profile.name} (age ${profile.age})`;
    backReport.href = `./report.html?profile=${encodeURIComponent(profile.id)}`;
    backCurriculum.href = `./curriculum.html?profile=${encodeURIComponent(profile.id)}&track=${encodeURIComponent(trackId)}`;
    backStudio.href = `./learn.html?profile=${encodeURIComponent(profile.id)}&track=${encodeURIComponent(trackId)}`;
  } else {
    learnerLine.textContent = "";
  }

  const lessons = unit.lessonIds
    .map((lessonId) => track.lessons.find((lesson) => lesson.id === lessonId))
    .filter(Boolean);

  const doneCount = profile ? lessons.filter((lesson) => isLessonComplete(profile, trackId, lesson.id)).length : 0;
  progressLine.textContent = `Progress: ${doneCount} / ${lessons.length} lessons completed`;

  lessonList.innerHTML = "";
  lessons.forEach((lesson, index) => {
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
    const ok = ensureTeacherModeUnlocked({ purpose: "printing unit sheets" });
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
  const unitId = params.get("unit") || "u1";

  try {
    lessonCatalog = await loadLessonCatalog();
  } catch (_error) {
    lessonCatalog = { tracks: [] };
  }

  renderUnitSheet({ profileId, trackId, unitId });
}

boot();

import { CURRICULUM_UNITS } from "./curriculum.js";
import "./swRegister.js";
import "./offlineStatus.js";
import { ensureTeacherModeUnlocked, isTeacherModeUnlocked, lockTeacherModeSession } from "./teacherGate.js";
import {
  getCompletedCount,
  getProfile,
  getTrack,
  isLessonComplete,
  isLessonUnlocked,
  loadAppState,
  loadLessonCatalog,
  setActiveProfile,
  saveAppState,
} from "./state.js";

const profileSelect = document.querySelector("#curriculum-profile-select");
const trackKidsButton = document.querySelector("#track-kids");
const trackExplorerButton = document.querySelector("#track-explorer");
const unlockButton = document.querySelector("#unlock-teacher");
const lockSessionButton = document.querySelector("#lock-session");
const summaryLearner = document.querySelector("#summary-learner");
const summaryTrack = document.querySelector("#summary-track");
const summaryProgress = document.querySelector("#summary-progress");
const unitList = document.querySelector("#unit-list");

let appState = loadAppState();
let lessonCatalog = { tracks: [] };
let activeProfile = null;
let activeTrackId = "kids";

function setTeacherLock(unlocked) {
  document.body.classList.toggle("teacher-locked", !unlocked);
  document.body.classList.toggle("teacher-unlocked", unlocked);
  if (unlockButton) {
    unlockButton.textContent = unlocked ? "Unlocked" : "Unlock";
  }
  if (lockSessionButton) {
    lockSessionButton.hidden = !unlocked;
  }
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

function renderTrackSwitcher() {
  trackKidsButton.classList.toggle("active", activeTrackId === "kids");
  trackExplorerButton.classList.toggle("active", activeTrackId === "explorer");
}

function renderSummary() {
  if (!activeProfile) {
    return;
  }
  const track = getTrack(lessonCatalog, activeTrackId);
  const completed = getCompletedCount(lessonCatalog, activeProfile, activeTrackId);
  const total = track?.lessons?.length || 0;
  summaryLearner.textContent = activeProfile.name;
  summaryTrack.textContent = `Track: ${track?.title || activeTrackId}`;
  summaryProgress.textContent = `Progress: ${completed} / ${total} lessons completed`;
}

function renderUnits() {
  unitList.innerHTML = "";
  if (!activeProfile) {
    return;
  }

  const track = getTrack(lessonCatalog, activeTrackId);
  const units = CURRICULUM_UNITS[activeTrackId] || [];

  units.forEach((unit) => {
    const lessonMeta = unit.lessonIds
      .map((lessonId) => track?.lessons?.find((l) => l.id === lessonId))
      .filter(Boolean);
    const unitDone = lessonMeta.filter((lesson) => isLessonComplete(activeProfile, activeTrackId, lesson.id)).length;
    const unitTotal = lessonMeta.length;

    const card = document.createElement("section");
    card.className = "unit-card";
    card.innerHTML = `
      <div class="unit-head">
        <div>
          <p class="eyebrow">Unit</p>
          <h2>${unit.title}</h2>
          <p class="unit-progress">${unitDone} / ${unitTotal} lessons complete</p>
        </div>
        <div class="unit-actions">
          <a class="ghost-link" href="./unit.html?profile=${encodeURIComponent(activeProfile.id)}&track=${encodeURIComponent(activeTrackId)}&unit=${encodeURIComponent(unit.id)}">Print unit</a>
        </div>
      </div>
      <div class="lesson-grid"></div>
    `;

    const grid = card.querySelector(".lesson-grid");

    lessonMeta.forEach((lesson, index) => {
      const done = isLessonComplete(activeProfile, activeTrackId, lesson.id);
      const unlocked = isLessonUnlocked(lessonCatalog, activeProfile, activeTrackId, lesson.id);
      const lessonCard = document.createElement("button");
      lessonCard.type = "button";
      lessonCard.className = "lesson-card";
      lessonCard.disabled = !unlocked;
      lessonCard.dataset.lessonId = lesson.id;
      lessonCard.innerHTML = `
        <div class="pill ${done ? "done" : "todo"}">${done ? "Done" : unlocked ? "Next" : "Locked"}</div>
        <strong>${index + 1}. ${lesson.title}</strong>
        <span>${lesson.description || ""}</span>
      `;
      grid.append(lessonCard);
    });

    unitList.append(card);
  });
}

function renderAll() {
  setTeacherLock(isTeacherModeUnlocked());
  renderProfileSelect();
  renderTrackSwitcher();
  renderSummary();
  renderUnits();
}

function switchProfile(profileId) {
  const next = getProfile(appState, profileId);
  if (!next) {
    return;
  }
  activeProfile = next;
  setActiveProfile(appState, profileId);
  saveAppState(appState);
  renderAll();
}

function switchTrack(trackId) {
  if (!getTrack(lessonCatalog, trackId)) {
    return;
  }
  activeTrackId = trackId;
  renderAll();
}

if (profileSelect) {
  profileSelect.addEventListener("change", () => switchProfile(profileSelect.value));
}

trackKidsButton.addEventListener("click", () => switchTrack("kids"));
trackExplorerButton.addEventListener("click", () => switchTrack("explorer"));

if (unlockButton) {
  unlockButton.addEventListener("click", () => {
    const ok = ensureTeacherModeUnlocked({ purpose: "the curriculum map" });
    if (ok) {
      setTeacherLock(true);
      renderAll();
    }
  });
}

if (lockSessionButton) {
  lockSessionButton.addEventListener("click", () => {
    lockTeacherModeSession();
    setTeacherLock(false);
    renderAll();
  });
}

if (unitList) {
  unitList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const button = target.closest("[data-lesson-id]");
    if (!(button instanceof HTMLElement)) {
      return;
    }
    const lessonId = button.dataset.lessonId;
    if (!lessonId || !activeProfile) {
      return;
    }
    window.location.href = `./learn.html?profile=${encodeURIComponent(activeProfile.id)}&track=${encodeURIComponent(activeTrackId)}&lesson=${encodeURIComponent(lessonId)}`;
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

  const params = new URLSearchParams(window.location.search);
  const requestedProfile = params.get("profile");
  const requestedTrack = params.get("track");

  activeProfile = getProfile(appState, requestedProfile) || getProfile(appState, appState.activeProfileId) || appState.profiles[0];
  activeTrackId = getTrack(lessonCatalog, requestedTrack) ? requestedTrack : activeProfile.age <= 9 ? "kids" : "explorer";

  renderAll();
}

boot();

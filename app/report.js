import {
  getCompletedCheckpointSteps,
  getCompletedCount,
  getEarnedBadgeCount,
  getLastActiveAt,
  getLesson,
  getLessonCompletedAt,
  getTrack,
  loadAppState,
  loadLessonCatalog,
  saveAppState,
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

let appState = loadAppState();
let lessonCatalog = { tracks: [] };
let activeProfile = null;
const profileFromQuery = new URLSearchParams(window.location.search).get("profile");

function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(date);
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

      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${index + 1}. ${lesson.title}</strong><div class="muted">${lesson.description}</div></td>
        <td><span class="pill ${done ? "done" : "todo"}">${done ? "Completed" : "In progress"}</span></td>
        <td>${done ? formatDate(completedAt) : "—"}</td>
        <td>${stepsCleared} / ${stepsTotal}</td>
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

profileSelect.addEventListener("change", () => {
  switchProfile(profileSelect.value);
});

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

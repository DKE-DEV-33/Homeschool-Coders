import {
  createProfile,
  getCompletedCount,
  getEarnedBadgeCount,
  getLesson,
  getProfileInitials,
  getTrack,
  loadAppState,
  loadLessonCatalog,
  saveAppState,
  setActiveProfile,
} from "./state.js";

const profileForm = document.querySelector("#profile-form");
const profileNameInput = document.querySelector("#profile-name");
const profileAgeInput = document.querySelector("#profile-age");
const createFeedback = document.querySelector("#create-feedback");
const profilesGrid = document.querySelector("#profiles-grid");
const overviewGrid = document.querySelector("#overview-grid");
const profileCount = document.querySelector("#profile-count");

let appState = loadAppState();
let lessonCatalog = { tracks: [] };

function getCurrentLessonForProfile(profile) {
  const trackId = getTrack(lessonCatalog, profile.progress.activeTrackId)
    ? profile.progress.activeTrackId
    : profile.age <= 9
      ? "kids"
      : "explorer";
  const track = getTrack(lessonCatalog, trackId);
  const lessonId = profile.progress.activeLessonIdByTrack[trackId] || track?.lessons?.[0]?.id || "";
  return {
    track,
    lesson: getLesson(lessonCatalog, trackId, lessonId),
  };
}

function renderProfiles() {
  profileCount.textContent = `${appState.profiles.length} profile${appState.profiles.length === 1 ? "" : "s"}`;
  profilesGrid.innerHTML = "";

  if (!appState.profiles.length) {
    profilesGrid.innerHTML = `
      <div class="empty-state">
        No learner profiles yet. Add one above and we will give them a full-screen lesson studio of their own.
      </div>
    `;
    return;
  }

  appState.profiles.forEach((profile) => {
    const { track, lesson } = getCurrentLessonForProfile(profile);
    const trackId = track?.id || (profile.age <= 9 ? "kids" : "explorer");
    const completed = getCompletedCount(lessonCatalog, profile, trackId);
    const total = track?.lessons?.length || 0;
    const badges = getEarnedBadgeCount(profile);

    const card = document.createElement("article");
    card.className = "profile-card";
    card.innerHTML = `
      <div class="profile-top">
        <div>
          <div class="avatar-dot" style="background:${profile.color}">${getProfileInitials(profile.name)}</div>
        </div>
        <div class="track-chip">${track?.title || "Track pending"}</div>
      </div>
      <div>
        <h3 class="profile-name">${profile.name}</h3>
        <p class="profile-age">Age ${profile.age}</p>
      </div>
      <div class="profile-stats">
        <div class="stat-box"><strong>${completed}/${total}</strong><span class="profile-stat">Lessons</span></div>
        <div class="stat-box"><strong>${badges}</strong><span class="profile-stat">Badges</span></div>
        <div class="stat-box"><strong>${lesson?.title || "Start"}</strong><span class="profile-stat">Current</span></div>
      </div>
      <div class="profile-actions">
        <button class="primary-button" type="button" data-open-profile="${profile.id}">Open Workspace</button>
        <button class="ghost-button" type="button" data-set-active="${profile.id}">Make Active</button>
      </div>
    `;
    profilesGrid.append(card);
  });
}

function renderOverview() {
  overviewGrid.innerHTML = "";

  if (!appState.profiles.length) {
    overviewGrid.innerHTML = `
      <div class="empty-state">
        Parent overview will appear here once at least one learner profile exists.
      </div>
    `;
    return;
  }

  appState.profiles.forEach((profile) => {
    const { track, lesson } = getCurrentLessonForProfile(profile);
    const trackId = track?.id || (profile.age <= 9 ? "kids" : "explorer");
    const card = document.createElement("article");
    card.className = "overview-card";
    card.innerHTML = `
      <h3>${profile.name}</h3>
      <p class="overview-copy">Age ${profile.age} · ${track?.title || "Track pending"}</p>
      <div class="overview-stack">
        <p>Current lesson: ${lesson?.title || "Not started yet"}</p>
        <p>Completed: ${getCompletedCount(lessonCatalog, profile, trackId)} / ${track?.lessons?.length || 0}</p>
        <p>Badges earned: ${getEarnedBadgeCount(profile)}</p>
      </div>
    `;
    overviewGrid.append(card);
  });
}

function render() {
  renderProfiles();
  renderOverview();
}

function openWorkspace(profileId) {
  setActiveProfile(appState, profileId);
  window.location.href = `./learn.html?profile=${encodeURIComponent(profileId)}`;
}

profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = profileNameInput.value.trim();
  const age = Number(profileAgeInput.value);

  if (!name) {
    createFeedback.textContent = "Please add a learner name first.";
    return;
  }

  if (!Number.isFinite(age) || age < 4) {
    createFeedback.textContent = "Please add an age of 4 or older.";
    return;
  }

  const profile = createProfile(appState, { name, age });
  saveAppState(appState);
  createFeedback.textContent = `${profile.name} is ready. Open their workspace whenever you like.`;
  profileForm.reset();
  render();
});

profilesGrid.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const openId = target.dataset.openProfile;
  if (openId) {
    openWorkspace(openId);
    return;
  }

  const activeId = target.dataset.setActive;
  if (activeId) {
    setActiveProfile(appState, activeId);
    createFeedback.textContent = "Active profile updated.";
    render();
  }
});

async function boot() {
  try {
    lessonCatalog = await loadLessonCatalog();
  } catch (error) {
    createFeedback.textContent = `Lesson data could not be loaded: ${error.message}`;
  }

  render();
}

boot();

import {
  createProfile,
  deleteProfile,
  exportBackup,
  getCompletedCount,
  getEarnedBadgeCount,
  getLesson,
  getLastActiveAt,
  getProfileInitials,
  getTrack,
  importBackup,
  loadAppState,
  loadLessonCatalog,
  saveAppState,
  setActiveProfile,
  updateProfile,
} from "./state.js";

import "./swRegister.js";
import { ensureTeacherModeUnlocked } from "./teacherGate.js";

const profileForm = document.querySelector("#profile-form");
const profileNameInput = document.querySelector("#profile-name");
const profileAgeInput = document.querySelector("#profile-age");
const createFeedback = document.querySelector("#create-feedback");
const profilesGrid = document.querySelector("#profiles-grid");
const overviewGrid = document.querySelector("#overview-grid");
const profileCount = document.querySelector("#profile-count");
const exportBackupButton = document.querySelector("#export-backup");
const importBackupInput = document.querySelector("#import-backup");
const backupFeedback = document.querySelector("#backup-feedback");
const openReportLink = document.querySelector("#open-report");

let appState = loadAppState();
let lessonCatalog = { tracks: [] };

function formatDateShort(date) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) {
    return "Never";
  }
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

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
    const lastActiveAt = getLastActiveAt(profile);

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
        <p class="profile-age">Last active: ${formatDateShort(lastActiveAt)}</p>
      </div>
      <div class="profile-stats">
        <div class="stat-box"><strong>${completed}/${total}</strong><span class="profile-stat">Lessons</span></div>
        <div class="stat-box"><strong>${badges}</strong><span class="profile-stat">Badges</span></div>
        <div class="stat-box"><strong>${lesson?.title || "Start"}</strong><span class="profile-stat">Current</span></div>
      </div>
      <div class="profile-actions">
        <button class="primary-button" type="button" data-open-profile="${profile.id}">Open Workspace</button>
        <button class="ghost-button" type="button" data-set-active="${profile.id}">Make Active</button>
        <button class="ghost-button" type="button" data-edit-profile="${profile.id}">Edit</button>
        <button class="ghost-button danger-button" type="button" data-delete-profile="${profile.id}">Delete</button>
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
    const lastActiveAt = getLastActiveAt(profile);
    const card = document.createElement("article");
    card.className = "overview-card";
    card.innerHTML = `
      <h3>${profile.name}</h3>
      <p class="overview-copy">Age ${profile.age} · ${track?.title || "Track pending"}</p>
      <div class="overview-stack">
        <p>Current lesson: ${lesson?.title || "Not started yet"}</p>
        <p>Completed: ${getCompletedCount(lessonCatalog, profile, trackId)} / ${track?.lessons?.length || 0}</p>
        <p>Badges earned: ${getEarnedBadgeCount(profile)}</p>
        <p>Last active: ${formatDateShort(lastActiveAt)}</p>
      </div>
      <div class="overview-actions">
        <a class="ghost-button link-button" href="./report.html?profile=${encodeURIComponent(profile.id)}">View report</a>
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

if (openReportLink) {
  openReportLink.addEventListener("click", (event) => {
    event.preventDefault();
    const ok = ensureTeacherModeUnlocked({ purpose: "the progress report" });
    if (!ok) {
      return;
    }
    window.location.href = openReportLink.href;
  });
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const link = target.closest("a");
  if (!(link instanceof HTMLAnchorElement)) {
    return;
  }
  const href = link.getAttribute("href") || "";
  if (!href.startsWith("./curriculum.html")) {
    return;
  }
  event.preventDefault();
  const ok = ensureTeacherModeUnlocked({ purpose: "the curriculum map" });
  if (!ok) {
    return;
  }
  window.location.href = href;
});

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
    return;
  }

  const editId = target.dataset.editProfile;
  if (editId) {
    const profile = appState.profiles.find((item) => item.id === editId);
    if (!profile) {
      return;
    }

    const nextName = window.prompt("Edit name", profile.name);
    if (nextName === null) {
      return;
    }

    const nextAgeRaw = window.prompt("Edit age (4-99)", String(profile.age));
    if (nextAgeRaw === null) {
      return;
    }

    const updated = updateProfile(appState, editId, { name: nextName, age: nextAgeRaw });
    if (!updated) {
      return;
    }
    createFeedback.textContent = `Updated ${updated.name}.`;
    render();
    return;
  }

  const deleteId = target.dataset.deleteProfile;
  if (deleteId) {
    const profile = appState.profiles.find((item) => item.id === deleteId);
    if (!profile) {
      return;
    }

    const ok = window.confirm(`Delete profile "${profile.name}"? This removes local progress for this learner on this device.`);
    if (!ok) {
      return;
    }

    const removed = deleteProfile(appState, deleteId);
    if (removed) {
      createFeedback.textContent = "Profile deleted.";
      render();
    }
  }
});

overviewGrid.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const link = target.closest("a");
  if (!link) {
    return;
  }
  const href = link.getAttribute("href") || "";
  if (!href.startsWith("./report.html")) {
    return;
  }
  event.preventDefault();

  const ok = ensureTeacherModeUnlocked({ purpose: "the progress report" });
  if (!ok) {
    return;
  }

  window.location.href = href;
});

async function boot() {
  try {
    lessonCatalog = await loadLessonCatalog();
  } catch (error) {
    createFeedback.textContent = `Lesson data could not be loaded: ${error.message}`;
  }

  render();
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

if (exportBackupButton) {
  exportBackupButton.addEventListener("click", () => {
    const backup = exportBackup(appState);
    const dateStamp = new Date().toISOString().slice(0, 10);
    downloadJson(`homeschool-coders-backup-${dateStamp}.json`, backup);
    if (backupFeedback) {
      backupFeedback.textContent = "Backup exported. Keep that JSON file somewhere safe.";
    }
  });
}

if (importBackupInput) {
  importBackupInput.addEventListener("change", async () => {
    const file = importBackupInput.files?.[0];
    if (!file) {
      return;
    }

    const ok = window.confirm("Importing a backup will replace profiles/progress on this device. Continue?");
    if (!ok) {
      importBackupInput.value = "";
      return;
    }

    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText);
      appState = importBackup(parsed);
      if (backupFeedback) {
        backupFeedback.textContent = "Backup imported. Profiles and progress were restored.";
      }
      render();
    } catch (error) {
      if (backupFeedback) {
        backupFeedback.textContent = `Import failed: ${error?.message || String(error)}`;
      }
    } finally {
      importBackupInput.value = "";
    }
  });
}

boot();

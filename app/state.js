const STORAGE_KEY = "homeschool-coders-app-v4";
const LEGACY_STORAGE_KEY = "homeschool-coders-progress-v2";
const PROFILE_COLORS = ["#e86e3b", "#2e8d9b", "#457bff", "#7d5cff", "#f29f05", "#4e9f69"];

function createEmptyProgress(defaultTrackId = "kids") {
  return {
    activeTrackId: defaultTrackId,
    activeLessonIdByTrack: {},
    codeDrafts: {},
    completedCheckpointSteps: {},
    hintLevelByLesson: {},
    noProgressRunsByLesson: {},
    completedLessonAt: {},
    completedLessons: {},
    earnedBadges: {},
    lastResultByLesson: {},
    lessonNotes: {},
    teacherOverrides: {
      unlockAllLessons: false,
    },
    recentActivity: [],
  };
}

function inferTrackIdFromAge(age) {
  return Number(age) <= 9 ? "kids" : "explorer";
}

function inferRoleFromAge(age) {
  return Number(age) <= 17 ? "child" : "adult";
}

function makeId() {
  return `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function pickColor(index) {
  return PROFILE_COLORS[index % PROFILE_COLORS.length];
}

function normalizeProfile(rawProfile = {}, index = 0) {
  const age = Number(rawProfile.age) || 8;
  const defaultTrackId = inferTrackIdFromAge(age);
  const progress = rawProfile.progress || {};

  return {
    id: rawProfile.id || makeId(),
    name: rawProfile.name || `Learner ${index + 1}`,
    age,
    role: rawProfile.role || inferRoleFromAge(age),
    color: rawProfile.color || pickColor(index),
    createdAt: rawProfile.createdAt || new Date().toISOString(),
    progress: {
      activeTrackId: progress.activeTrackId || defaultTrackId,
      activeLessonIdByTrack: progress.activeLessonIdByTrack || {},
      codeDrafts: progress.codeDrafts || {},
      completedCheckpointSteps: progress.completedCheckpointSteps || {},
      hintLevelByLesson: progress.hintLevelByLesson || {},
      noProgressRunsByLesson: progress.noProgressRunsByLesson || {},
      completedLessonAt: progress.completedLessonAt || {},
      completedLessons: progress.completedLessons || {},
      earnedBadges: progress.earnedBadges || {},
      lastResultByLesson: progress.lastResultByLesson || {},
      lessonNotes: progress.lessonNotes || {},
      teacherOverrides: {
        unlockAllLessons: Boolean(progress.teacherOverrides?.unlockAllLessons),
      },
      recentActivity: Array.isArray(progress.recentActivity) ? progress.recentActivity.slice(0, 12) : [],
    },
  };
}

function createInitialState() {
  return {
    activeProfileId: "",
    profiles: [],
  };
}

function migrateLegacyState() {
  try {
    const rawLegacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);

    if (!rawLegacy) {
      return createInitialState();
    }

    const parsed = JSON.parse(rawLegacy);
    const legacyProfiles = [
      { id: "parent", name: "Parent Explorer", age: 34, role: "adult", color: pickColor(0) },
      { id: "kid-one", name: "Kid One", age: 8, role: "child", color: pickColor(1) },
      { id: "kid-two", name: "Kid Two", age: 6, role: "child", color: pickColor(2) },
    ];

    const profiles = legacyProfiles.map((profile, index) => {
      const learner = parsed.learners?.[profile.id] || {};
      return normalizeProfile(
        {
          ...profile,
          progress: {
            activeTrackId: learner.activeTrackId || inferTrackIdFromAge(profile.age),
            activeLessonIdByTrack: learner.activeLessonIdByTrack || {},
            codeDrafts: learner.codeDrafts || {},
            completedCheckpointSteps: learner.completedCheckpointSteps || {},
            hintLevelByLesson: learner.hintLevelByLesson || {},
            noProgressRunsByLesson: learner.noProgressRunsByLesson || {},
            completedLessonAt: learner.completedLessonAt || {},
            completedLessons: learner.completedLessons || {},
            earnedBadges: learner.earnedBadges || {},
            lastResultByLesson: learner.lastResultByLesson || {},
            lessonNotes: learner.lessonNotes || {},
            teacherOverrides: {
              unlockAllLessons: Boolean(learner.teacherOverrides?.unlockAllLessons),
            },
            recentActivity: learner.recentActivity || [],
          },
        },
        index,
      );
    });

    return {
      activeProfileId: parsed.activeLearnerId || profiles[0]?.id || "",
      profiles,
    };
  } catch (_error) {
    return createInitialState();
  }
}

export function loadAppState() {
  try {
    const rawState = window.localStorage.getItem(STORAGE_KEY);

    if (!rawState) {
      const migrated = migrateLegacyState();
      saveAppState(migrated);
      return migrated;
    }

    const parsed = JSON.parse(rawState);
    const profiles = Array.isArray(parsed.profiles)
      ? parsed.profiles.map((profile, index) => normalizeProfile(profile, index))
      : [];

    return {
      activeProfileId: profiles.some((profile) => profile.id === parsed.activeProfileId)
        ? parsed.activeProfileId
        : profiles[0]?.id || "",
      profiles,
    };
  } catch (_error) {
    const fallback = migrateLegacyState();
    saveAppState(fallback);
    return fallback;
  }
}

export function saveAppState(state) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportBackup(state) {
  return {
    schema: "homeschool-coders-backup-v1",
    exportedAt: new Date().toISOString(),
    state,
  };
}

export function importBackup(raw) {
  const backup = raw && typeof raw === "object" ? raw : null;
  if (!backup || backup.schema !== "homeschool-coders-backup-v1") {
    throw new Error("Backup file schema not recognized.");
  }
  if (!backup.state || typeof backup.state !== "object") {
    throw new Error("Backup file is missing state.");
  }

  const nextProfiles = Array.isArray(backup.state.profiles) ? backup.state.profiles : [];
  const normalizedProfiles = nextProfiles.map((profile, index) => normalizeProfile(profile, index));
  const nextState = {
    activeProfileId: normalizedProfiles.some((profile) => profile.id === backup.state.activeProfileId)
      ? backup.state.activeProfileId
      : normalizedProfiles[0]?.id || "",
    profiles: normalizedProfiles,
  };

  saveAppState(nextState);
  return nextState;
}

export function createProfile(state, profileData) {
  const profile = normalizeProfile(
    {
      id: makeId(),
      name: profileData.name,
      age: Number(profileData.age),
      role: inferRoleFromAge(profileData.age),
      color: pickColor(state.profiles.length),
      progress: createEmptyProgress(inferTrackIdFromAge(profileData.age)),
    },
    state.profiles.length,
  );

  state.profiles.push(profile);
  if (!state.activeProfileId) {
    state.activeProfileId = profile.id;
  }
  saveAppState(state);
  return profile;
}

export function getProfile(state, profileId) {
  return state.profiles.find((profile) => profile.id === profileId) || null;
}

export function setActiveProfile(state, profileId) {
  if (getProfile(state, profileId)) {
    state.activeProfileId = profileId;
    saveAppState(state);
  }
}

export function updateProfile(state, profileId, updates) {
  const profile = getProfile(state, profileId);
  if (!profile) {
    return null;
  }

  if (typeof updates?.name === "string") {
    const trimmedName = updates.name.trim();
    if (trimmedName) {
      profile.name = trimmedName.slice(0, 32);
    }
  }

  if (updates?.age !== undefined) {
    const age = Number(updates.age);
    if (Number.isFinite(age) && age >= 4 && age <= 99) {
      profile.age = age;
    }
  }

  saveAppState(state);
  return profile;
}

export function deleteProfile(state, profileId) {
  const index = state.profiles.findIndex((profile) => profile.id === profileId);
  if (index < 0) {
    return false;
  }

  state.profiles.splice(index, 1);

  if (state.activeProfileId === profileId) {
    state.activeProfileId = state.profiles[0]?.id || "";
  }

  saveAppState(state);
  return true;
}

export function ensureTrackContainers(profile, trackId) {
  if (!profile) {
    return;
  }

  const progress = profile.progress;
  progress.codeDrafts[trackId] = progress.codeDrafts[trackId] || {};
  progress.completedCheckpointSteps[trackId] = progress.completedCheckpointSteps[trackId] || {};
  progress.hintLevelByLesson[trackId] = progress.hintLevelByLesson[trackId] || {};
  progress.noProgressRunsByLesson[trackId] = progress.noProgressRunsByLesson[trackId] || {};
  progress.completedLessonAt[trackId] = progress.completedLessonAt[trackId] || {};
  progress.completedLessons[trackId] = progress.completedLessons[trackId] || {};
  progress.earnedBadges[trackId] = progress.earnedBadges[trackId] || {};
  progress.lastResultByLesson[trackId] = progress.lastResultByLesson[trackId] || {};
  progress.lessonNotes[trackId] = progress.lessonNotes[trackId] || {};
}

export function getTrack(catalog, trackId) {
  return catalog?.tracks?.find((track) => track.id === trackId) || null;
}

export function getLesson(catalog, trackId, lessonId) {
  return getTrack(catalog, trackId)?.lessons?.find((lesson) => lesson.id === lessonId) || null;
}

export function getLessonIndex(catalog, trackId, lessonId) {
  return getTrack(catalog, trackId)?.lessons?.findIndex((lesson) => lesson.id === lessonId) ?? -1;
}

export function getNextLesson(catalog, trackId, lessonId) {
  const track = getTrack(catalog, trackId);
  const currentIndex = getLessonIndex(catalog, trackId, lessonId);

  if (!track || currentIndex < 0) {
    return null;
  }

  return track.lessons[currentIndex + 1] || null;
}

export function isLessonComplete(profile, trackId, lessonId) {
  return Boolean(profile?.progress?.completedLessons?.[trackId]?.[lessonId]);
}

export function isLessonUnlocked(catalog, profile, trackId, lessonId) {
  const track = getTrack(catalog, trackId);
  const lessonIndex = getLessonIndex(catalog, trackId, lessonId);

  if (!track || lessonIndex < 0) {
    return false;
  }

  if (profile?.progress?.teacherOverrides?.unlockAllLessons) {
    return true;
  }

  if (lessonIndex === 0) {
    return true;
  }

  return isLessonComplete(profile, trackId, track.lessons[lessonIndex - 1].id);
}

export function getCompletedCount(catalog, profile, trackId) {
  const track = getTrack(catalog, trackId);
  if (!track) {
    return 0;
  }
  return track.lessons.filter((lesson) => isLessonComplete(profile, trackId, lesson.id)).length;
}

export function getEarnedBadgeCount(profile) {
  return Object.values(profile?.progress?.earnedBadges || {}).reduce((total, trackBadges) => {
    return total + Object.values(trackBadges || {}).filter(Boolean).length;
  }, 0);
}

export function addRecentActivity(profile, message) {
  profile.progress.recentActivity = [{ message, time: new Date().toISOString() }, ...(profile.progress.recentActivity || [])].slice(0, 10);
}

export function getLastActiveAt(profile) {
  const recentTime = profile?.progress?.recentActivity?.[0]?.time;
  return recentTime ? new Date(recentTime) : null;
}

export function getLessonCompletedAt(profile, trackId, lessonId) {
  const iso = profile?.progress?.completedLessonAt?.[trackId]?.[lessonId];
  return iso ? new Date(iso) : null;
}

export function markLessonComplete(profile, trackId, lessonId) {
  ensureTrackContainers(profile, trackId);
  profile.progress.completedLessons[trackId][lessonId] = true;
  profile.progress.completedLessonAt[trackId][lessonId] = new Date().toISOString();
}

export function markBadgeEarned(profile, trackId, lessonId) {
  ensureTrackContainers(profile, trackId);
  profile.progress.earnedBadges[trackId][lessonId] = true;
}

export function setLessonRunResult(profile, trackId, lessonId, result) {
  ensureTrackContainers(profile, trackId);
  profile.progress.lastResultByLesson[trackId][lessonId] = result;
}

export function saveDraft(profile, trackId, lessonId, code) {
  ensureTrackContainers(profile, trackId);
  profile.progress.codeDrafts[trackId][lessonId] = code;
  profile.progress.activeTrackId = trackId;
  profile.progress.activeLessonIdByTrack[trackId] = lessonId;
}

export function getCompletedCheckpointSteps(profile, trackId, lessonId) {
  return profile?.progress?.completedCheckpointSteps?.[trackId]?.[lessonId] || [];
}

export function setCompletedCheckpointSteps(profile, trackId, lessonId, stepIds) {
  ensureTrackContainers(profile, trackId);
  profile.progress.completedCheckpointSteps[trackId][lessonId] = stepIds;
}

export function getHintLevel(profile, trackId, lessonId) {
  return Number(profile?.progress?.hintLevelByLesson?.[trackId]?.[lessonId] || 0);
}

export function setHintLevel(profile, trackId, lessonId, hintLevel) {
  ensureTrackContainers(profile, trackId);
  profile.progress.hintLevelByLesson[trackId][lessonId] = Math.max(0, Math.floor(Number(hintLevel) || 0));
}

export function getNoProgressRuns(profile, trackId, lessonId) {
  return Number(profile?.progress?.noProgressRunsByLesson?.[trackId]?.[lessonId] || 0);
}

export function setNoProgressRuns(profile, trackId, lessonId, count) {
  ensureTrackContainers(profile, trackId);
  profile.progress.noProgressRunsByLesson[trackId][lessonId] = Math.max(0, Math.floor(Number(count) || 0));
}

export function getDraft(profile, trackId, lessonId) {
  return profile?.progress?.codeDrafts?.[trackId]?.[lessonId] || "";
}

export function getLessonNotes(profile, trackId, lessonId) {
  return profile?.progress?.lessonNotes?.[trackId]?.[lessonId] || null;
}

export function setLessonNotes(profile, trackId, lessonId, notes) {
  ensureTrackContainers(profile, trackId);
  const next = notes && typeof notes === "object" ? notes : {};
  profile.progress.lessonNotes[trackId][lessonId] = {
    learnerText: typeof next.learnerText === "string" ? next.learnerText : "",
    parentText: typeof next.parentText === "string" ? next.parentText : "",
    updatedAt: new Date().toISOString(),
  };
}

export function getUnlockAllLessons(profile) {
  return Boolean(profile?.progress?.teacherOverrides?.unlockAllLessons);
}

export function setUnlockAllLessons(profile, enabled) {
  if (!profile) {
    return;
  }
  profile.progress.teacherOverrides = profile.progress.teacherOverrides || {};
  profile.progress.teacherOverrides.unlockAllLessons = Boolean(enabled);
}

export async function loadLessonCatalog() {
  const response = await fetch("../public/lessons.json");
  if (!response.ok) {
    throw new Error(`Lesson catalog request failed with ${response.status}.`);
  }
  return response.json();
}

export function getProfileInitials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

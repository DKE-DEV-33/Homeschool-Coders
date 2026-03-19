const STORAGE_KEY = "homeschool-coders-app-v4";
const LEGACY_STORAGE_KEY = "homeschool-coders-progress-v2";
const PROFILE_COLORS = ["#e86e3b", "#2e8d9b", "#457bff", "#7d5cff", "#f29f05", "#4e9f69"];

function createEmptyProgress(defaultTrackId = "kids") {
  return {
    activeTrackId: defaultTrackId,
    activeLessonIdByTrack: {},
    codeDrafts: {},
    completedLessons: {},
    earnedBadges: {},
    lastResultByLesson: {},
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
      completedLessons: progress.completedLessons || {},
      earnedBadges: progress.earnedBadges || {},
      lastResultByLesson: progress.lastResultByLesson || {},
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
            completedLessons: learner.completedLessons || {},
            earnedBadges: learner.earnedBadges || {},
            lastResultByLesson: learner.lastResultByLesson || {},
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

export function ensureTrackContainers(profile, trackId) {
  if (!profile) {
    return;
  }

  const progress = profile.progress;
  progress.codeDrafts[trackId] = progress.codeDrafts[trackId] || {};
  progress.completedLessons[trackId] = progress.completedLessons[trackId] || {};
  progress.earnedBadges[trackId] = progress.earnedBadges[trackId] || {};
  progress.lastResultByLesson[trackId] = progress.lastResultByLesson[trackId] || {};
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

export function markLessonComplete(profile, trackId, lessonId) {
  ensureTrackContainers(profile, trackId);
  profile.progress.completedLessons[trackId][lessonId] = true;
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

export function getDraft(profile, trackId, lessonId) {
  return profile?.progress?.codeDrafts?.[trackId]?.[lessonId] || "";
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

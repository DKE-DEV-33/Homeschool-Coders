const TEACHER_PIN_KEY = "homeschool-coders-teacher-pin-v1";
const TEACHER_SESSION_KEY = "homeschool-coders-teacher-session-v1";

export function isTeacherModeUnlocked() {
  return window.sessionStorage.getItem(TEACHER_SESSION_KEY) === "1";
}

export function lockTeacherModeSession() {
  window.sessionStorage.removeItem(TEACHER_SESSION_KEY);
}

function setTeacherModeSessionUnlocked() {
  window.sessionStorage.setItem(TEACHER_SESSION_KEY, "1");
}

export function ensureTeacherModeUnlocked({ purpose = "Teacher tools" } = {}) {
  if (isTeacherModeUnlocked()) {
    return true;
  }

  const storedPin = window.localStorage.getItem(TEACHER_PIN_KEY);
  if (!storedPin) {
    const nextPin = window.prompt(`Set a parent code to unlock ${purpose} (letters/numbers). Keep it simple to type:`);
    if (nextPin === null) {
      return false;
    }
    const trimmed = String(nextPin).trim();
    if (!trimmed) {
      window.alert("Parent code can’t be empty.");
      return false;
    }
    const confirmPin = window.prompt("Confirm parent code:");
    if (confirmPin === null) {
      return false;
    }
    if (String(confirmPin).trim() !== trimmed) {
      window.alert("Codes didn’t match. Teacher mode stays locked.");
      return false;
    }
    window.localStorage.setItem(TEACHER_PIN_KEY, trimmed);
    setTeacherModeSessionUnlocked();
    return true;
  }

  const attempt = window.prompt(`Enter parent code to unlock ${purpose}:`);
  if (attempt === null) {
    return false;
  }
  if (String(attempt).trim() !== storedPin) {
    window.alert("Not quite. Teacher mode stays locked.");
    return false;
  }

  setTeacherModeSessionUnlocked();
  return true;
}


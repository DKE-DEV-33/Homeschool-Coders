import {
  addRecentActivity,
  ensureTrackContainers,
  getCompletedCheckpointSteps,
  getCompletedCount,
  getDraft,
  getEarnedBadgeCount,
  getHintLevel,
  getLesson,
  getLessonIndex,
  getLessonNotes,
  getExampleRevealed,
  getUnlockAllLessons,
  getNextLesson,
  getNoProgressRuns,
  getProfile,
  getTrack,
  isLessonComplete,
  isLessonUnlocked,
  loadAppState,
  loadLessonCatalog,
  markBadgeEarned,
  markLessonComplete,
  saveAppState,
  saveDraft,
  setCompletedCheckpointSteps,
  setActiveProfile,
  setHintLevel,
  setExampleRevealed,
  setLessonNotes,
  setNoProgressRuns,
  setLessonRunResult,
} from "./state.js";

import "./swRegister.js";
import "./offlineStatus.js";
import { COMMAND_REFERENCE } from "./commands.js";
import { ensureTeacherModeUnlocked } from "./teacherGate.js";
import { CURRICULUM_UNITS, getUnitForLesson } from "./curriculum.js";

const PYODIDE_VERSION = "0.27.7";
const pyodideModuleUrl = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.mjs`;

const profileSelect = document.querySelector("#workspace-profile-select");
const trackKidsButton = document.querySelector("#track-kids");
const trackExplorerButton = document.querySelector("#track-explorer");
const workspaceTitle = document.querySelector("#workspace-title");
const lessonTitle = document.querySelector("#lesson-title");
const lessonUnit = document.querySelector("#lesson-unit");
const lessonDescription = document.querySelector("#lesson-description");
const lessonMission = document.querySelector("#lesson-mission");
const lessonSteps = document.querySelector("#lesson-steps");
const checkpointCopy = document.querySelector("#checkpoint-copy");
const checkpointSteps = document.querySelector("#checkpoint-steps");
const lessonHint = document.querySelector("#lesson-hint");
const trackTitle = document.querySelector("#track-title");
const trackProgress = document.querySelector("#track-progress");
const lessonList = document.querySelector("#lesson-list");
const badgeShelf = document.querySelector("#badge-shelf");
const toggleSidebarButton = document.querySelector("#toggle-sidebar");
const studioGrid = document.querySelector(".studio-grid");
const tabMissions = document.querySelector("#tab-missions");
const tabBadges = document.querySelector("#tab-badges");
const panelMissions = document.querySelector("#panel-missions");
const panelBadges = document.querySelector("#panel-badges");
const runPythonButton = document.querySelector("#run-python");
const cachePythonButton = document.querySelector("#cache-python");
const resetWorkspaceButton = document.querySelector("#reset-workspace");
const editorMicroHint = document.querySelector("#editor-micro-hint");
const showHintButton = document.querySelector("#show-hint");
const stuckHelpButton = document.querySelector("#stuck-help");
const codeEditor = document.querySelector("#code-editor");
const editorStatus = document.querySelector("#editor-status");
const lessonStatus = document.querySelector("#lesson-status");
const runtimeLog = document.querySelector("#runtime-log");
const checkpointResult = document.querySelector("#checkpoint-result");
const functionReference = document.querySelector("#function-reference");
const exampleCode = document.querySelector("#example-code");
const revealExampleButton = document.querySelector("#reveal-example");
const copyExampleButton = document.querySelector("#copy-example");
const learnerNotes = document.querySelector("#learner-notes");
const parentNotes = document.querySelector("#parent-notes");
const notesStatus = document.querySelector("#notes-status");
const drawingSurface = document.querySelector("#drawing-surface");
const drawingContext = drawingSurface.getContext("2d");
const targetPreviewCanvas = document.querySelector("#target-preview-canvas");
const targetPreviewContext = targetPreviewCanvas.getContext("2d");
const targetPreviewCopy = document.querySelector("#target-preview-copy");
const celebrationModal = document.querySelector("#celebration-modal");
const celebrationTitle = document.querySelector("#celebration-title");
const celebrationCopy = document.querySelector("#celebration-copy");
const nextLessonButton = document.querySelector("#next-lesson-button");
const closeCelebrationButton = document.querySelector("#close-celebration");
const confettiLayer = document.querySelector("#confetti-layer");
const toastLayer = document.querySelector("#toast-layer");
const openReportLink = document.querySelector("#open-report-link");
const printLessonLink = document.querySelector("#print-lesson-link");
const teacherOverridePill = document.querySelector("#teacher-override-pill");

let appState = loadAppState();
let lessonCatalog = { tracks: [] };
let activeProfile = null;
let activeTrackId = "kids";
let activeLessonId = "";
let saveDraftTimeoutId;
let saveNotesTimeoutId;
let pyodide;
let pyodideReadyPromise;

const turtleState = {
  x: drawingSurface.width / 2,
  y: drawingSurface.height / 2,
  angle: 0,
  penDown: true,
  strokeStyle: "#214e5f",
  lineWidth: 4,
};

const runMetrics = {
  segments: 0,
  turns: 0,
  colorChanges: 0,
  writes: 0,
  commandCalls: {},
  functionCalls: {},
};

function formatDateShort(date) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function resetMetrics() {
  runMetrics.segments = 0;
  runMetrics.turns = 0;
  runMetrics.colorChanges = 0;
  runMetrics.writes = 0;
  runMetrics.commandCalls = {};
  runMetrics.functionCalls = {};
}

function recordCommandCall(commandName) {
  const safeName = String(commandName);
  runMetrics.commandCalls[safeName] = (runMetrics.commandCalls[safeName] || 0) + 1;
}

function setStatus(message) {
  editorStatus.textContent = message;
}

function setLog(message) {
  runtimeLog.textContent = message;
}

function appendLogLine(message) {
  if (runtimeLog.textContent === "Runtime log will appear here.") {
    runtimeLog.textContent = "";
  }
  runtimeLog.textContent += `${message}\n`;
}

function getActiveTrack() {
  return getTrack(lessonCatalog, activeTrackId);
}

function getActiveLesson() {
  return getLesson(lessonCatalog, activeTrackId, activeLessonId);
}

function collectLessonCommandKeys(lesson) {
  if (Array.isArray(lesson?.allowedCommands) && lesson.allowedCommands.length) {
    return lesson.allowedCommands.filter((key) => COMMAND_REFERENCE[key]);
  }

  const check = lesson?.check || {};
  const commandKeys = new Set(check.requiredCommands || []);

  if (check.minSegments) {
    commandKeys.add("move");
  }
  if (check.minTurns) {
    commandKeys.add("turn");
  }
  if (check.minColorChanges) {
    commandKeys.add("pen_color");
  }
  if (check.requiresWrite) {
    commandKeys.add("write");
  }
  if (check.requiresRepeat) {
    commandKeys.add("repeat");
  }
  if (check.requiresFunctionDefinition || check.minFunctionCalls) {
    commandKeys.add("def");
  }
  if (!commandKeys.size) {
    commandKeys.add("move");
  }

  return [...commandKeys].filter((key) => COMMAND_REFERENCE[key]);
}

function buildCheckLabel(check) {
  const pieces = [];

  if (check.minSegments) {
    pieces.push(`${check.minSegments}+ line segment${check.minSegments === 1 ? "" : "s"}`);
  }
  if (check.minTurns) {
    pieces.push(`${check.minTurns}+ turn${check.minTurns === 1 ? "" : "s"}`);
  }
  if (check.minColorChanges) {
    pieces.push(`${check.minColorChanges}+ color change${check.minColorChanges === 1 ? "" : "s"}`);
  }
  if (check.requiresWrite) {
    pieces.push("a write message");
  }
  if (check.requiresRepeat) {
    pieces.push("a repeat loop");
  }
  if (check.requiresFunctionDefinition) {
    pieces.push("your own helper function");
  }
  if (check.requiredCommands?.length) {
    pieces.push(check.requiredCommands.join(", "));
  }

  return pieces.join(", ");
}

function makeSoftCheck(check) {
  const softCheck = {};

  if (check.minSegments && check.minSegments > 1) {
    softCheck.minSegments = Math.max(1, Math.ceil(check.minSegments / 2));
  }
  if (check.minTurns && check.minTurns > 1) {
    softCheck.minTurns = Math.max(1, Math.ceil(check.minTurns / 2));
  }
  if (check.minColorChanges && check.minColorChanges > 1) {
    softCheck.minColorChanges = Math.max(1, Math.ceil(check.minColorChanges / 2));
  }
  if (check.minFunctionCalls && check.minFunctionCalls > 1) {
    softCheck.minFunctionCalls = Math.max(1, Math.ceil(check.minFunctionCalls / 2));
  }
  if (check.requiresWrite && !check.minSegments) {
    softCheck.requiresWrite = true;
  }
  if (check.requiresRepeat && !check.requiredCommands?.length) {
    softCheck.requiresRepeat = true;
  }

  return softCheck;
}

function getLessonMilestones(lesson) {
  if (Array.isArray(lesson?.milestones) && lesson.milestones.length) {
    return lesson.milestones.map((step) => ({
      id: step.id,
      title: step.title,
      description: step.description,
      hint: step.hint,
      check: step.check || {},
    }));
  }

  const check = lesson?.check || {};
  const commandKeys = collectLessonCommandKeys(lesson);
  const milestones = [];

  const toolboxCheck = {};
  if (check.requiredCommands?.length) {
    toolboxCheck.requiredCommands = [...check.requiredCommands];
  }
  if (check.requiresRepeat) {
    toolboxCheck.requiresRepeat = true;
  }
  if (check.requiresWrite) {
    toolboxCheck.requiresWrite = true;
  }
  if (check.requiresFunctionDefinition) {
    toolboxCheck.requiresFunctionDefinition = true;
  }
  if (check.minFunctionCalls) {
    toolboxCheck.minFunctionCalls = 1;
  }

  milestones.push({
    id: "toolbox",
    title: "Use the lesson tools",
    description: `Use: ${commandKeys.map((key) => COMMAND_REFERENCE[key].signature).join(", ")}.`,
    hint: `Try ${COMMAND_REFERENCE[commandKeys[0]].signature} first.`,
    check: toolboxCheck,
  });

  const softCheck = makeSoftCheck(check);
  if (Object.keys(softCheck).length > 0) {
    milestones.push({
      id: "progress",
      title: "Make the picture start to happen",
      description: `Show visible progress with ${buildCheckLabel(softCheck)}.`,
      hint: lesson.targetSteps?.[0] || lesson.hint,
      check: softCheck,
    });
  }

  milestones.push({
    id: "finish",
    title: "Finish the mission",
    description: lesson.successMessage,
    hint: lesson.hint,
    check,
  });

  return milestones;
}

function getCurrentMilestone(lesson) {
  if (!lesson || !activeProfile) {
    return null;
  }
  const completedSteps = new Set(getCompletedCheckpointSteps(activeProfile, activeTrackId, lesson.id));
  return getLessonMilestones(lesson).find((step) => !completedSteps.has(step.id)) || null;
}

function setSidebarTab(tabId) {
  const isMissions = tabId === "missions";
  tabMissions.classList.toggle("active", isMissions);
  tabBadges.classList.toggle("active", !isMissions);
  panelMissions.classList.toggle("active", isMissions);
  panelBadges.classList.toggle("active", !isMissions);
}

function toggleSidebar() {
  const collapsed = studioGrid.classList.toggle("sidebar-collapsed");
  studioGrid.classList.toggle("sidebar-open", !collapsed);
  toggleSidebarButton.textContent = collapsed ? "Expand" : "Collapse";
  toggleSidebarButton.setAttribute("aria-expanded", String(!collapsed));
}

function resetCanvasState() {
  turtleState.x = drawingSurface.width / 2;
  turtleState.y = drawingSurface.height / 2;
  turtleState.angle = 0;
  turtleState.penDown = true;
  turtleState.strokeStyle = "#214e5f";
  turtleState.lineWidth = 4;
}

function prepareCanvas() {
  drawingContext.clearRect(0, 0, drawingSurface.width, drawingSurface.height);
  drawingContext.fillStyle = "#fffdf8";
  drawingContext.fillRect(0, 0, drawingSurface.width, drawingSurface.height);
  drawingContext.strokeStyle = turtleState.strokeStyle;
  drawingContext.fillStyle = turtleState.strokeStyle;
  drawingContext.lineWidth = turtleState.lineWidth;
  drawingContext.lineCap = "round";
  drawingContext.lineJoin = "round";
}

function drawWelcomeScene() {
  prepareCanvas();
  drawingContext.fillStyle = "#eef6f8";
  drawingContext.fillRect(30, 30, drawingSurface.width - 60, drawingSurface.height - 60);
  drawingContext.strokeStyle = "#214e5f";
  drawingContext.lineWidth = 6;
  drawingContext.strokeRect(110, 120, 220, 180);
  drawingContext.beginPath();
  drawingContext.arc(610, 205, 80, 0, Math.PI * 2);
  drawingContext.stroke();
  drawingContext.fillStyle = "#19333d";
  drawingContext.font = '700 26px "Baloo 2", sans-serif';
  drawingContext.fillText("Run Python to start drawing", 52, 82);
}

function clearTargetPreview() {
  targetPreviewContext.clearRect(0, 0, targetPreviewCanvas.width, targetPreviewCanvas.height);
  targetPreviewContext.fillStyle = "#fffdf8";
  targetPreviewContext.fillRect(0, 0, targetPreviewCanvas.width, targetPreviewCanvas.height);
  targetPreviewContext.lineCap = "round";
  targetPreviewContext.lineJoin = "round";
  targetPreviewContext.lineWidth = 5;
}

function drawFlower(context, centerX, centerY, radius, color, petalCount) {
  context.strokeStyle = color;
  for (let index = 0; index < petalCount; index += 1) {
    const angle = (Math.PI * 2 * index) / petalCount;
    const petalX = centerX + Math.cos(angle) * radius;
    const petalY = centerY + Math.sin(angle) * radius;
    context.beginPath();
    context.arc(petalX, petalY, radius, 0, Math.PI * 2);
    context.stroke();
  }
}

function drawTargetPreview(lesson) {
  const preview = lesson?.preview || {};
  const palette = preview.palette || ["#214e5f"];
  clearTargetPreview();

  switch (preview.kind) {
    case "line-message":
      targetPreviewContext.strokeStyle = palette[0];
      targetPreviewContext.beginPath();
      targetPreviewContext.moveTo(60, 115);
      targetPreviewContext.lineTo(220, 72);
      targetPreviewContext.stroke();
      targetPreviewContext.fillStyle = palette[1] || palette[0];
      targetPreviewContext.font = '700 18px "Baloo 2", sans-serif';
      targetPreviewContext.fillText("hello", 250, 82);
      break;
    case "line-lengths":
      targetPreviewContext.strokeStyle = palette[0];
      targetPreviewContext.beginPath();
      targetPreviewContext.moveTo(60, 135);
      targetPreviewContext.lineTo(120, 135);
      targetPreviewContext.moveTo(60, 98);
      targetPreviewContext.lineTo(200, 98);
      targetPreviewContext.moveTo(60, 60);
      targetPreviewContext.lineTo(328, 60);
      targetPreviewContext.stroke();
      break;
    case "zigzag":
      targetPreviewContext.strokeStyle = palette[0];
      targetPreviewContext.beginPath();
      targetPreviewContext.moveTo(50, 132);
      targetPreviewContext.lineTo(115, 68);
      targetPreviewContext.lineTo(180, 132);
      targetPreviewContext.lineTo(245, 68);
      targetPreviewContext.lineTo(310, 132);
      targetPreviewContext.stroke();
      break;
    case "square":
      targetPreviewContext.strokeStyle = palette[0];
      targetPreviewContext.strokeRect(140, 34, 120, 120);
      break;
    case "repeat-pattern":
      targetPreviewContext.strokeStyle = palette[0];
      targetPreviewContext.strokeRect(125, 62, 70, 70);
      targetPreviewContext.strokeRect(215, 62, 70, 70);
      targetPreviewContext.strokeRect(170, 20, 70, 70);
      break;
    case "polygons":
      targetPreviewContext.strokeStyle = palette[0];
      targetPreviewContext.beginPath();
      targetPreviewContext.moveTo(92, 138);
      targetPreviewContext.lineTo(142, 48);
      targetPreviewContext.lineTo(192, 138);
      targetPreviewContext.closePath();
      targetPreviewContext.stroke();
      targetPreviewContext.strokeStyle = palette[1] || palette[0];
      targetPreviewContext.beginPath();
      for (let side = 0; side < 6; side += 1) {
        const angle = (Math.PI / 3) * side;
        const x = 316 + Math.cos(angle) * 42;
        const y = 94 + Math.sin(angle) * 42;
        if (side === 0) {
          targetPreviewContext.moveTo(x, y);
        } else {
          targetPreviewContext.lineTo(x, y);
        }
      }
      targetPreviewContext.closePath();
      targetPreviewContext.stroke();
      break;
    case "spinner":
      targetPreviewContext.strokeStyle = palette[0];
      for (let step = 0; step < 8; step += 1) {
        targetPreviewContext.save();
        targetPreviewContext.translate(205, 90);
        targetPreviewContext.rotate((Math.PI / 4) * step);
        targetPreviewContext.strokeRect(-24, -24, 48, 48);
        targetPreviewContext.restore();
      }
      break;
    case "color-bands":
      targetPreviewContext.lineWidth = 10;
      palette.forEach((color, index) => {
        targetPreviewContext.strokeStyle = color;
        targetPreviewContext.beginPath();
        targetPreviewContext.moveTo(94 + index * 94, 132);
        targetPreviewContext.lineTo(94 + index * 94, 50);
        targetPreviewContext.stroke();
      });
      break;
    case "pen-hop":
      targetPreviewContext.strokeStyle = palette[0];
      targetPreviewContext.strokeRect(62, 62, 70, 70);
      targetPreviewContext.setLineDash([8, 8]);
      targetPreviewContext.strokeStyle = "#8b96a4";
      targetPreviewContext.beginPath();
      targetPreviewContext.moveTo(138, 95);
      targetPreviewContext.lineTo(250, 95);
      targetPreviewContext.stroke();
      targetPreviewContext.setLineDash([]);
      targetPreviewContext.strokeStyle = palette[1] || palette[0];
      targetPreviewContext.beginPath();
      targetPreviewContext.moveTo(300, 132);
      targetPreviewContext.lineTo(344, 62);
      targetPreviewContext.lineTo(388, 132);
      targetPreviewContext.closePath();
      targetPreviewContext.stroke();
      break;
    case "placed-shapes":
      targetPreviewContext.strokeStyle = palette[0];
      targetPreviewContext.beginPath();
      targetPreviewContext.moveTo(78, 132);
      targetPreviewContext.lineTo(122, 58);
      targetPreviewContext.lineTo(166, 132);
      targetPreviewContext.closePath();
      targetPreviewContext.stroke();
      targetPreviewContext.strokeStyle = palette[1] || palette[0];
      targetPreviewContext.strokeRect(275, 52, 80, 80);
      break;
    case "tiny-scene":
      targetPreviewContext.strokeStyle = palette[0];
      targetPreviewContext.strokeRect(150, 96, 85, 62);
      targetPreviewContext.beginPath();
      targetPreviewContext.moveTo(150, 96);
      targetPreviewContext.lineTo(192, 58);
      targetPreviewContext.lineTo(235, 96);
      targetPreviewContext.stroke();
      targetPreviewContext.strokeStyle = palette[1] || palette[0];
      drawFlower(targetPreviewContext, 330, 68, 18, palette[1] || palette[0], 8);
      targetPreviewContext.strokeStyle = palette[2] || palette[0];
      targetPreviewContext.beginPath();
      targetPreviewContext.moveTo(50, 160);
      targetPreviewContext.lineTo(390, 160);
      targetPreviewContext.stroke();
      break;
    case "layered-scene":
      targetPreviewContext.strokeStyle = palette[0];
      targetPreviewContext.strokeRect(115, 55, 160, 96);
      targetPreviewContext.strokeStyle = palette[1] || palette[0];
      targetPreviewContext.strokeRect(165, 94, 70, 57);
      targetPreviewContext.strokeStyle = palette[2] || palette[0];
      drawFlower(targetPreviewContext, 326, 74, 18, palette[2] || palette[0], 10);
      break;
    default:
      targetPreviewContext.fillStyle = "#314550";
      targetPreviewContext.font = '700 16px "Atkinson Hyperlegible", sans-serif';
      targetPreviewContext.fillText("Run the lesson to make your own version.", 70, 92);
      break;
  }
}

function renderProfileSelect() {
  profileSelect.innerHTML = "";
  appState.profiles.filter((profile) => !profile.archivedAt).forEach((profile) => {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = `${profile.name} · age ${profile.age}`;
    profileSelect.append(option);
  });
  profileSelect.value = activeProfile?.id || "";
}

function renderReportLink() {
  if (!openReportLink) {
    return;
  }
  if (!activeProfile) {
    openReportLink.href = "./report.html";
    return;
  }
  openReportLink.href = `./report.html?profile=${encodeURIComponent(activeProfile.id)}`;
}

function renderPrintLessonLink() {
  if (!printLessonLink) {
    return;
  }
  if (!activeProfile || !activeTrackId || !activeLessonId) {
    printLessonLink.href = "./lesson.html";
    return;
  }
  printLessonLink.href = `./lesson.html?profile=${encodeURIComponent(activeProfile.id)}&track=${encodeURIComponent(activeTrackId)}&lesson=${encodeURIComponent(activeLessonId)}`;
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

if (printLessonLink) {
  printLessonLink.addEventListener("click", (event) => {
    event.preventDefault();
    const ok = ensureTeacherModeUnlocked({ purpose: "printing lesson sheets" });
    if (!ok) {
      return;
    }
    window.location.href = printLessonLink.href;
  });
}

function renderTeacherOverridePill() {
  if (!teacherOverridePill) {
    return;
  }
  const enabled = activeProfile ? getUnlockAllLessons(activeProfile) : false;
  teacherOverridePill.classList.toggle("show", enabled);
  teacherOverridePill.setAttribute("aria-hidden", enabled ? "false" : "true");
}

function renderTrackSwitcher() {
  trackKidsButton.classList.toggle("active", activeTrackId === "kids");
  trackExplorerButton.classList.toggle("active", activeTrackId === "explorer");
}

function renderBadgeShelf() {
  const track = getActiveTrack();
  badgeShelf.innerHTML = "";
  if (!track || !activeProfile) {
    return;
  }

  track.lessons.forEach((lesson) => {
    const badge = document.createElement("div");
    const earned = Boolean(activeProfile.progress.earnedBadges?.[track.id]?.[lesson.id]);
    badge.className = `badge-chip ${earned ? "" : "locked"}`.trim();
    badge.textContent = earned ? lesson.reward?.title || lesson.title : `Locked: ${lesson.reward?.title || lesson.title}`;
    badgeShelf.append(badge);
  });
}

function renderFunctionReference() {
  const lesson = getActiveLesson();
  functionReference.innerHTML = "";

  collectLessonCommandKeys(lesson).forEach((key) => {
    const item = COMMAND_REFERENCE[key];
    const row = document.createElement("article");
    row.className = "reference-item";
    row.innerHTML = `
      <code>${item.signature}</code>
      <p>${item.description}</p>
    `;
    functionReference.append(row);
  });
}

function renderCheckpointSteps(lesson) {
  const completedStepIds = new Set(getCompletedCheckpointSteps(activeProfile, activeTrackId, lesson.id));
  const currentStep = getCurrentMilestone(lesson);

  checkpointSteps.innerHTML = "";

  getLessonMilestones(lesson).forEach((step, index) => {
    const item = document.createElement("article");
    const isDone = completedStepIds.has(step.id);
    const isActive = !isDone && currentStep?.id === step.id;

    item.className = `checkpoint-step ${isDone ? "done" : ""} ${isActive ? "active" : ""}`.trim();
    item.innerHTML = `
      <strong>${index + 1}. ${step.title}${isDone ? " - done" : ""}</strong>
      <p>${step.description}</p>
    `;
    checkpointSteps.append(item);
  });
}

function renderLessonList() {
  const track = getActiveTrack();
  lessonList.innerHTML = "";
  if (!track || !activeProfile) {
    return;
  }

  const units = CURRICULUM_UNITS[track.id] || [];
  const usedLessonIds = new Set();

  const renderLessonButton = (lesson, index) => {
    const active = lesson.id === activeLessonId;
    const complete = isLessonComplete(activeProfile, track.id, lesson.id);
    const unlocked = isLessonUnlocked(lessonCatalog, activeProfile, track.id, lesson.id);
    const milestones = getLessonMilestones(lesson);
    const totalMilestones = milestones.length;
    const completedMilestones = complete
      ? totalMilestones
      : getCompletedCheckpointSteps(activeProfile, track.id, lesson.id).length;

    const button = document.createElement("button");
    button.type = "button";
    button.className = `lesson-card ${active ? "active" : ""} ${complete ? "completed" : ""} ${unlocked ? "" : "locked"}`.trim();
    button.dataset.lessonId = lesson.id;
    button.dataset.short = String(index + 1);
    button.innerHTML = `
      <strong>${index + 1}. ${lesson.title}</strong>
      <span>${unlocked ? lesson.description : "Finish the previous lesson to unlock this one."}</span>
      <span class="lesson-progress">${completedMilestones}/${totalMilestones} steps</span>
    `;
    return button;
  };

  const orderedLessons = track.lessons.map((lesson, index) => ({ lesson, index }));

  if (units.length) {
    units.forEach((unit, unitIndex) => {
      const details = document.createElement("details");
      details.className = "unit-group";
      details.open = unitIndex === 0;

      const unitLessons = unit.lessonIds
        .map((lessonId) => orderedLessons.find((item) => item.lesson.id === lessonId))
        .filter(Boolean);

      unitLessons.forEach(({ lesson }) => usedLessonIds.add(lesson.id));

      const unitDone = unitLessons.filter(({ lesson }) => isLessonComplete(activeProfile, track.id, lesson.id)).length;
      const unitTotal = unitLessons.length;

      const summary = document.createElement("summary");
      summary.className = "unit-summary";
      summary.innerHTML = `
        <div>
          <strong>${unit.title}</strong>
          <span>${unitDone}/${unitTotal} complete</span>
        </div>
      `;
      details.append(summary);

      const list = document.createElement("div");
      list.className = "unit-lesson-list";
      unitLessons.forEach(({ lesson, index }) => list.append(renderLessonButton(lesson, index)));
      details.append(list);

      lessonList.append(details);
    });
  }

  const ungrouped = orderedLessons.filter(({ lesson }) => !usedLessonIds.has(lesson.id));
  if (ungrouped.length) {
    const details = document.createElement("details");
    details.className = "unit-group";
    details.open = !units.length;
    const summary = document.createElement("summary");
    summary.className = "unit-summary";
    summary.innerHTML = `
      <div>
        <strong>Other Lessons</strong>
        <span>${ungrouped.length}</span>
      </div>
    `;
    details.append(summary);
    const list = document.createElement("div");
    list.className = "unit-lesson-list";
    ungrouped.forEach(({ lesson, index }) => list.append(renderLessonButton(lesson, index)));
    details.append(list);
    lessonList.append(details);
  }
}

function renderLessonHeader() {
  const lesson = getActiveLesson();
  const track = getActiveTrack();
  const lessonNumber = getLessonIndex(lessonCatalog, activeTrackId, activeLessonId) + 1;
  const currentMilestone = getCurrentMilestone(lesson);
  if (!lesson || !track || !activeProfile) {
    return;
  }
  const milestoneCount = getLessonMilestones(lesson).length;
  const completedMilestoneCount = getCompletedCheckpointSteps(activeProfile, activeTrackId, lesson.id).length;

  workspaceTitle.textContent = `${activeProfile.name}'s Python Canvas Missions`;
  lessonTitle.textContent = `${track.title} · Lesson ${lessonNumber}: ${lesson.title}`;
  if (lessonUnit) {
    lessonUnit.textContent = getUnitForLesson(activeTrackId, lesson.id)?.title || "";
  }
  lessonDescription.textContent = lesson.description;
  lessonMission.textContent = lesson.mission;
  checkpointCopy.textContent = buildCheckpointSummary(track, lesson);
  renderCheckpointSteps(lesson);
  const microHints = Array.isArray(lesson.microHints) ? lesson.microHints : [];
  const hintLevel = getHintLevel(activeProfile, activeTrackId, lesson.id);
  const selectedMicroHint =
    microHints.length && hintLevel > 0 ? microHints[Math.min(hintLevel - 1, microHints.length - 1)] : "";
  const noProgressRuns = getNoProgressRuns(activeProfile, activeTrackId, lesson.id);

  lessonHint.textContent = `Hint: ${currentMilestone?.hint || lesson.hint}`;
  editorMicroHint.textContent = selectedMicroHint ? `Hint revealed: ${selectedMicroHint}` : "Need a hint? Press Show hint.";
  if (showHintButton) {
    // Avoid spoilers: require at least one no-progress run before hints unlock.
    const hintsUnlocked = noProgressRuns > 0;
    showHintButton.disabled = !microHints.length || hintLevel >= microHints.length || !hintsUnlocked;
    showHintButton.textContent = hintLevel ? "Show next hint" : "Show hint";
  }
  if (stuckHelpButton) {
    stuckHelpButton.disabled = !microHints.length || hintLevel >= microHints.length || noProgressRuns < 2;
  }
  targetPreviewCopy.textContent = lesson.visualGoal || "Create your own version of the target idea.";
  trackTitle.textContent = track.title;
  trackProgress.textContent = `${getCompletedCount(lessonCatalog, activeProfile, activeTrackId)} of ${track.lessons.length} lessons complete · ${getEarnedBadgeCount(activeProfile)} badges earned`;
  lessonStatus.textContent = isLessonComplete(activeProfile, activeTrackId, activeLessonId)
    ? "Completed"
    : `${completedMilestoneCount}/${milestoneCount} milestones`;
  lessonSteps.innerHTML = "";
  (lesson.targetSteps || []).forEach((step) => {
    const chip = document.createElement("span");
    chip.textContent = step;
    lessonSteps.append(chip);
  });
  drawTargetPreview(lesson);
}

function buildCheckpointSummary(track, lesson) {
  return `${track.checkpointPrompt} Clear each milestone below to finish the lesson.`;
}

function renderEditor() {
  const lesson = getActiveLesson();
  if (!lesson || !activeProfile) {
    return;
  }

  const savedDraft = getDraft(activeProfile, activeTrackId, lesson.id);
  const shouldClearEditor = !savedDraft || savedDraft === lesson.starterCode;

  codeEditor.value = shouldClearEditor ? "" : savedDraft;
  codeEditor.placeholder = `Type your Python here for ${lesson.title}...`;
}

function renderLessonNotes() {
  const lesson = getActiveLesson();
  if (!lesson || !activeProfile || !learnerNotes || !parentNotes || !notesStatus) {
    return;
  }

  const notes = getLessonNotes(activeProfile, activeTrackId, lesson.id);
  learnerNotes.value = notes?.learnerText || "";
  parentNotes.value = notes?.parentText || "";
  notesStatus.textContent = notes?.updatedAt ? `Last saved: ${formatDateShort(new Date(notes.updatedAt))}` : "Notes save automatically on this device.";
}

function getExampleRevealAllowed(lesson) {
  if (!lesson || !activeProfile) {
    return false;
  }
  if (isLessonComplete(activeProfile, activeTrackId, lesson.id)) {
    return true;
  }
  const noProgressRuns = getNoProgressRuns(activeProfile, activeTrackId, lesson.id);
  return noProgressRuns >= 3;
}

function renderExamplePanel() {
  const lesson = getActiveLesson();
  if (!lesson || !activeProfile || !exampleCode || !revealExampleButton || !copyExampleButton) {
    return;
  }

  const revealed = getExampleRevealed(activeProfile, activeTrackId, lesson.id);
  const canReveal = getExampleRevealAllowed(lesson);

  revealExampleButton.disabled = !canReveal && !revealed;

  if (revealed) {
    exampleCode.textContent = lesson.starterCode || "(No example available for this lesson.)";
    copyExampleButton.disabled = !(lesson.starterCode || "").trim();
  } else {
    exampleCode.textContent = canReveal
      ? "Click “Reveal example” to see a sample solution."
      : "Example is hidden. Try running your code a few times first.";
    copyExampleButton.disabled = true;
  }
}

function renderAll() {
  renderProfileSelect();
  renderReportLink();
  renderPrintLessonLink();
  renderTeacherOverridePill();
  renderTrackSwitcher();
  renderLessonList();
  renderBadgeShelf();
  renderFunctionReference();
  renderLessonHeader();
  renderEditor();
  renderExamplePanel();
  renderLessonNotes();
}

function saveCurrentDraft() {
  if (!activeProfile || !activeTrackId || !activeLessonId) {
    return;
  }
  saveDraft(activeProfile, activeTrackId, activeLessonId, codeEditor.value);
  saveAppState(appState);
}

function scheduleDraftSave() {
  window.clearTimeout(saveDraftTimeoutId);
  saveDraftTimeoutId = window.setTimeout(saveCurrentDraft, 160);
}

function saveCurrentNotes() {
  if (!activeProfile || !activeTrackId || !activeLessonId || !learnerNotes || !parentNotes || !notesStatus) {
    return;
  }
  setLessonNotes(activeProfile, activeTrackId, activeLessonId, {
    learnerText: learnerNotes.value,
    parentText: parentNotes.value,
  });
  saveAppState(appState);
  notesStatus.textContent = `Last saved: ${formatDateShort(new Date())}`;
}

function scheduleNotesSave() {
  if (notesStatus) {
    notesStatus.textContent = "Saving...";
  }
  window.clearTimeout(saveNotesTimeoutId);
  saveNotesTimeoutId = window.setTimeout(saveCurrentNotes, 220);
}

function setStrokeStyle(color) {
  turtleState.strokeStyle = color;
  drawingContext.strokeStyle = color;
  drawingContext.fillStyle = color;
  runMetrics.colorChanges += 1;
  recordCommandCall("pen_color");
}

function setLineWidth(width) {
  const parsedWidth = Number(width);
  if (!Number.isFinite(parsedWidth) || parsedWidth <= 0) {
    throw new Error("line_width expects a positive number.");
  }
  turtleState.lineWidth = parsedWidth;
  drawingContext.lineWidth = parsedWidth;
  recordCommandCall("line_width");
}

function turnBy(degrees) {
  const parsedDegrees = Number(degrees);
  if (!Number.isFinite(parsedDegrees)) {
    throw new Error("turn expects a number.");
  }
  turtleState.angle += parsedDegrees;
  runMetrics.turns += 1;
  recordCommandCall("turn");
}

function moveBy(distance) {
  const parsedDistance = Number(distance);
  if (!Number.isFinite(parsedDistance)) {
    throw new Error("move expects a number.");
  }

  const radians = (turtleState.angle * Math.PI) / 180;
  const nextX = turtleState.x + Math.cos(radians) * parsedDistance;
  const nextY = turtleState.y + Math.sin(radians) * parsedDistance;

  if (turtleState.penDown) {
    drawingContext.beginPath();
    drawingContext.moveTo(turtleState.x, turtleState.y);
    drawingContext.lineTo(nextX, nextY);
    drawingContext.stroke();
    runMetrics.segments += 1;
  }

  turtleState.x = nextX;
  turtleState.y = nextY;
  recordCommandCall("move");
}

function goTo(x, y) {
  const nextX = Number(x);
  const nextY = Number(y);
  if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) {
    throw new Error("go_to expects two numbers.");
  }
  if (turtleState.penDown) {
    drawingContext.beginPath();
    drawingContext.moveTo(turtleState.x, turtleState.y);
    drawingContext.lineTo(nextX, nextY);
    drawingContext.stroke();
    runMetrics.segments += 1;
  }
  turtleState.x = nextX;
  turtleState.y = nextY;
  recordCommandCall("go_to");
}

function writeText(message, size = 20) {
  const fontSize = Number(size);
  if (!Number.isFinite(fontSize) || fontSize <= 0) {
    throw new Error("write expects a positive font size.");
  }
  drawingContext.save();
  drawingContext.translate(turtleState.x, turtleState.y);
  drawingContext.fillStyle = turtleState.strokeStyle;
  drawingContext.font = `700 ${fontSize}px "Baloo 2", sans-serif`;
  drawingContext.fillText(String(message), 0, 0);
  drawingContext.restore();
  runMetrics.writes += 1;
  recordCommandCall("write");
}

function recordFunctionCall(functionName) {
  const safeName = String(functionName);
  runMetrics.functionCalls[safeName] = (runMetrics.functionCalls[safeName] || 0) + 1;
}

function preprocessCode(source) {
  const normalized = source.replace(/\r\n/g, "\n");
  return normalized.replace(/^(\s*)repeat\((.+)\):/gm, "$1for _ in range($2):");
}

function buildCodeFacts(source) {
  const normalized = source.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const nonDefSource = lines.filter((line) => !/^\s*def\s+/.test(line)).join("\n");
  const assignedNames = new Set(
    [...nonDefSource.matchAll(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=/gm)].map((match) => match[1]),
  );
  const ifCount = [...nonDefSource.matchAll(/^\s*(if|elif)\b/gm)].length;
  const elseCount = [...nonDefSource.matchAll(/^\s*else\s*:/gm)].length;
  return {
    usesRepeat: /(^|\n)\s*repeat\(/.test(normalized),
    functionDefinitions: [...normalized.matchAll(/^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm)].map((match) => match[1]),
    commands: new Set([...normalized.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g)].map((match) => match[1])),
    calledCommands: new Set([...nonDefSource.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g)].map((match) => match[1])),
    assignedNames,
    ifCount,
    elseCount,
  };
}

function getFunctionCallCount(facts) {
  return facts.functionDefinitions.reduce((total, functionName) => {
    return total + (runMetrics.functionCalls[functionName] || 0);
  }, 0);
}

function passesCheck(check, facts) {
  if (check.minSegments && runMetrics.segments < check.minSegments) {
    return false;
  }
  if (check.minTurns && runMetrics.turns < check.minTurns) {
    return false;
  }
  if (check.minColorChanges && runMetrics.colorChanges < check.minColorChanges) {
    return false;
  }
  if (check.requiresWrite && runMetrics.writes < 1) {
    return false;
  }
  if (check.requiresRepeat && !facts.usesRepeat) {
    return false;
  }
  if (check.requiredCommands?.some((commandName) => !(runMetrics.commandCalls[commandName] > 0))) {
    return false;
  }
  if (check.minAssignments && facts.assignedNames.size < check.minAssignments) {
    return false;
  }
  if (check.requiredAssignments?.some((name) => !facts.assignedNames.has(name))) {
    return false;
  }
  if (check.minIfStatements && facts.ifCount < check.minIfStatements) {
    return false;
  }
  if (check.requiresElse && facts.elseCount < 1) {
    return false;
  }
  if (check.requiresFunctionDefinition && facts.functionDefinitions.length === 0) {
    return false;
  }
  if (check.minFunctionCalls && getFunctionCallCount(facts) < check.minFunctionCalls) {
    return false;
  }
  return true;
}

function describeFailures(check, facts) {
  const failures = [];

  if (check.minSegments && runMetrics.segments < check.minSegments) {
    failures.push(`draw at least ${check.minSegments} line segments`);
  }
  if (check.minTurns && runMetrics.turns < check.minTurns) {
    failures.push(`use turn at least ${check.minTurns} times`);
  }
  if (check.minColorChanges && runMetrics.colorChanges < check.minColorChanges) {
    failures.push(`use at least ${check.minColorChanges} colors`);
  }
  if (check.requiresWrite && runMetrics.writes < 1) {
    failures.push("add a write message to the canvas");
  }
  if (check.requiresRepeat && !facts.usesRepeat) {
    failures.push("use repeat(...) in your code");
  }
  if (check.requiredCommands) {
    check.requiredCommands.forEach((commandName) => {
      if (!(runMetrics.commandCalls[commandName] > 0)) {
        failures.push(`include ${commandName}(...)`);
      }
    });
  }
  if (check.minAssignments && facts.assignedNames.size < check.minAssignments) {
    failures.push(`create at least ${check.minAssignments} variable${check.minAssignments === 1 ? "" : "s"} with name = value`);
  }
  if (check.requiredAssignments) {
    check.requiredAssignments.forEach((name) => {
      if (!facts.assignedNames.has(name)) {
        failures.push(`create a variable named ${name}`);
      }
    });
  }
  if (check.minIfStatements && facts.ifCount < check.minIfStatements) {
    failures.push(`use at least ${check.minIfStatements} if statement${check.minIfStatements === 1 ? "" : "s"}`);
  }
  if (check.requiresElse && facts.elseCount < 1) {
    failures.push("include an else: branch");
  }
  if (check.requiresFunctionDefinition && facts.functionDefinitions.length === 0) {
    failures.push("define your own helper function with def");
  }
  if (check.minFunctionCalls && getFunctionCallCount(facts) < check.minFunctionCalls) {
    failures.push(`call your helper function at least ${check.minFunctionCalls} times`);
  }

  return failures;
}

function hideCelebration() {
  celebrationModal.classList.remove("open");
  celebrationModal.setAttribute("aria-hidden", "true");
  confettiLayer.innerHTML = "";
}

function spawnConfetti() {
  confettiLayer.innerHTML = "";
  const colors = ["#e86e3b", "#2e8d9b", "#457bff", "#f4bf4f", "#4e9f69", "#f78fb3"];
  for (let index = 0; index < 42; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.animationDuration = `${3 + Math.random() * 2}s`;
    piece.style.animationDelay = `${Math.random() * 0.6}s`;
    piece.style.setProperty("--drift", `${-120 + Math.random() * 240}px`);
    piece.style.setProperty("--spin", `${180 + Math.random() * 540}deg`);
    confettiLayer.append(piece);
  }
}

function showToast(title, body, tone = "success") {
  if (!toastLayer) {
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast ${tone}`.trim();
  toast.innerHTML = `
    <strong>${title}</strong>
    <p>${body}</p>
  `;
  toastLayer.append(toast);

  window.setTimeout(() => {
    toast.classList.add("fade-out");
  }, 2400);

  window.setTimeout(() => {
    toast.remove();
  }, 2900);
}

function classifyPythonRuntimeIssue(message) {
  const text = String(message || "");

  if (text.includes("Execution limit reached")) {
    return {
      title: "Loop alert",
      status: "Loop alert: the code ran too long.",
      checkpoint:
        "That run went on for a really long time. Try a smaller repeat count, and avoid infinite loops.",
      toast: "That run took too long. Try lowering repeat(...) or simplifying the code.",
    };
  }

  if (text.includes("IndentationError") || text.includes("expected an indented block")) {
    return {
      title: "Indentation fix",
      status: "Indentation fix needed.",
      checkpoint:
        "Your code needs indentation. After `repeat(...)` add a new indented line (4 spaces) for the code inside.",
      toast: "After repeat(...): indent the next lines by 4 spaces.",
    };
  }

  if (text.includes("SyntaxError") && (text.includes("expected ':'") || text.includes("expected ':'"))) {
    return {
      title: "Missing colon",
      status: "Syntax fix needed.",
      checkpoint: "It looks like you forgot a `:` at the end of a line like `repeat(4):`.",
      toast: "Add a `:` at the end of repeat(4):",
    };
  }

  if (text.includes("SyntaxError")) {
    return {
      title: "Syntax fix",
      status: "Syntax fix needed.",
      checkpoint:
        "Python didn't understand one line. Check for missing `:` after repeat(...), and make sure parentheses and quotes match.",
      toast: "Check `:` after repeat(...), plus matching () and quotes.",
    };
  }

  const nameErrorMatch = text.match(/NameError: name '([^']+)' is not defined/);
  if (nameErrorMatch) {
    const unknownName = nameErrorMatch[1];
    return {
      title: "Name not found",
      status: "Spelling check needed.",
      checkpoint: `Python doesn't know \`${unknownName}\`. Check spelling (like move/turn/pen_up/go_to) and use the Function Reference list.`,
      toast: `Check spelling: ${unknownName}`,
    };
  }

  const typeErrorMatch = text.match(/TypeError: ([^\n]+)/);
  if (typeErrorMatch) {
    return {
      title: "Wrong inputs",
      status: "Input fix needed.",
      checkpoint:
        "One command was called with the wrong kind of input. Check the Function Reference and match the parentheses and numbers.",
      toast: typeErrorMatch[1],
    };
  }

  return null;
}

function showCelebration(lesson, nextLesson) {
  celebrationTitle.textContent = lesson.reward?.title || "Lesson complete";
  celebrationCopy.textContent = nextLesson
    ? `${lesson.successMessage} Three stars for this mission. Ready to load ${nextLesson.title}?`
    : `${lesson.successMessage} You finished this track, which is a very nice moment.`;
  nextLessonButton.textContent = nextLesson ? "Next Lesson" : "Track Complete";
  nextLessonButton.disabled = !nextLesson;
  celebrationModal.classList.add("open");
  celebrationModal.setAttribute("aria-hidden", "false");
  spawnConfetti();
}

function evaluateCheckpoint(lesson, source) {
  const facts = buildCodeFacts(source);
  const milestones = getLessonMilestones(lesson);
  const completedStepIds = new Set(getCompletedCheckpointSteps(activeProfile, activeTrackId, lesson.id));
  const newlyCompleted = [];

  milestones.forEach((step) => {
    if (!completedStepIds.has(step.id) && passesCheck(step.check, facts)) {
      completedStepIds.add(step.id);
      newlyCompleted.push(step.title);
    }
  });

  setCompletedCheckpointSteps(activeProfile, activeTrackId, lesson.id, [...completedStepIds]);
  if (newlyCompleted.length) {
    setHintLevel(activeProfile, activeTrackId, lesson.id, 0);
    setNoProgressRuns(activeProfile, activeTrackId, lesson.id, 0);
  }

  const nextMilestone = milestones.find((step) => !completedStepIds.has(step.id)) || null;
  const finalMilestone = milestones[milestones.length - 1];
  const finalPassed = passesCheck(finalMilestone.check, facts);

    if (!finalPassed) {
      hideCelebration();
      if (!newlyCompleted.length) {
        const currentNoProgressRuns = getNoProgressRuns(activeProfile, activeTrackId, lesson.id);
        setNoProgressRuns(activeProfile, activeTrackId, lesson.id, currentNoProgressRuns + 1);
      }
    const finalFailures = describeFailures(finalMilestone.check, facts);
    checkpointResult.textContent = newlyCompleted.length
      ? `Nice. You cleared ${newlyCompleted.join(", ")}. Next up: ${nextMilestone?.title || "keep going"}. ${nextMilestone?.hint || finalFailures.join(", ")}`
      : `Next milestone: ${nextMilestone?.title || "keep going"}. ${nextMilestone?.hint || finalFailures.join(", ")}`;
    setLessonRunResult(
      activeProfile,
      activeTrackId,
      lesson.id,
      `${completedStepIds.size}/${milestones.length} checkpoints cleared`,
    );
    addRecentActivity(
      activeProfile,
      newlyCompleted.length
        ? `${lesson.title}: cleared ${completedStepIds.size} of ${milestones.length} checkpoints`
        : `${lesson.title}: working on checkpoint ${nextMilestone ? milestones.indexOf(nextMilestone) + 1 : milestones.length}`,
    );
    saveAppState(appState);
    renderLessonList();
    renderLessonHeader();
    renderExamplePanel();

    if (newlyCompleted.length) {
      const nextLabel = nextMilestone?.title ? `Next: ${nextMilestone.title}` : "Next step ready";
      showToast("Step cleared!", `${newlyCompleted.join(", ")}. ${nextLabel}`);
    }
    return false;
  }

  checkpointResult.textContent = lesson.successMessage;
  markLessonComplete(activeProfile, activeTrackId, lesson.id);
  markBadgeEarned(activeProfile, activeTrackId, lesson.id);
  setLessonRunResult(activeProfile, activeTrackId, lesson.id, "Checkpoint passed");
  addRecentActivity(activeProfile, `${lesson.title}: checkpoint passed`);
  saveAppState(appState);
  renderLessonList();
  renderBadgeShelf();
  renderLessonHeader();
  renderExamplePanel();
  showCelebration(lesson, getNextLesson(lessonCatalog, activeTrackId, lesson.id));
  return true;
}

async function ensurePyodide() {
  if (pyodideReadyPromise) {
    return pyodideReadyPromise;
  }

  pyodideReadyPromise = (async () => {
    setStatus("Loading Python runtime for the browser...");
    setLog("Loading Pyodide from the CDN. The first run can take a little longer.");

    const { loadPyodide } = await import(pyodideModuleUrl);
    pyodide = await loadPyodide({
      stdout: (message) => appendLogLine(message),
      stderr: (message) => appendLogLine(`stderr: ${message}`),
    });

    pyodide.registerJsModule("canvas_api", {
      move_by: moveBy,
      turn_by: turnBy,
      pen_up: () => {
        turtleState.penDown = false;
        recordCommandCall("pen_up");
      },
      pen_down: () => {
        turtleState.penDown = true;
        recordCommandCall("pen_down");
      },
      pen_color: setStrokeStyle,
      line_width: setLineWidth,
      go_to: goTo,
      write_text: writeText,
      record_function_call: recordFunctionCall,
      reset_canvas: () => {
        resetCanvasState();
        resetMetrics();
        prepareCanvas();
      },
    });

    await pyodide.runPythonAsync(`
import ast
import sys
from canvas_api import (
    move_by as canvas_move_by,
    turn_by as canvas_turn_by,
    pen_up as canvas_pen_up,
    pen_down as canvas_pen_down,
    pen_color as canvas_pen_color,
    line_width as canvas_line_width,
    go_to as canvas_go_to,
    write_text as canvas_write_text,
    record_function_call as canvas_record_function_call,
    reset_canvas as canvas_reset,
)

def move(distance):
    canvas_move_by(distance)

def turn(degrees):
    canvas_turn_by(degrees)

def pen_up():
    canvas_pen_up()

def pen_down():
    canvas_pen_down()

def pen_color(color_name):
    canvas_pen_color(color_name)

def line_width(amount):
    canvas_line_width(amount)

def go_to(x, y):
    canvas_go_to(x, y)

def write(message, size=20):
    canvas_write_text(message, size)

def reset_drawing():
    canvas_reset()

MAX_TRACE_STEPS = 25000

class StepLimitReached(RuntimeError):
    pass

def _make_step_tracer(limit):
    counter = {"steps": 0}

    def tracer(frame, event, arg):
        if event == "line":
            counter["steps"] += 1
            if counter["steps"] > limit:
                raise StepLimitReached(f"Execution limit reached ({limit} steps).")
        return tracer

    return tracer

class FunctionCallTracker(ast.NodeTransformer):
    def __init__(self, function_names):
        self.function_names = set(function_names)

    def visit_Expr(self, node):
        node = self.generic_visit(node)
        if isinstance(node.value, ast.Call) and isinstance(node.value.func, ast.Name) and node.value.func.id in self.function_names:
            tracker_call = ast.Expr(
                value=ast.Call(
                    func=ast.Name(id="__record_function_call__", ctx=ast.Load()),
                    args=[ast.Constant(value=node.value.func.id)],
                    keywords=[],
                )
            )
            return [tracker_call, node]
        return node

def __record_function_call__(name):
    canvas_record_function_call(name)

def run_user_code(source):
    module = ast.parse(source, mode="exec")
    function_names = [node.name for node in module.body if isinstance(node, ast.FunctionDef)]
    tracked_module = FunctionCallTracker(function_names).visit(module)
    ast.fix_missing_locations(tracked_module)
    namespace = {
        "move": move,
        "turn": turn,
        "pen_up": pen_up,
        "pen_down": pen_down,
        "pen_color": pen_color,
        "line_width": line_width,
        "go_to": go_to,
        "write": write,
        "reset_drawing": reset_drawing,
        "range": range,
        "__record_function_call__": __record_function_call__,
    }
    tracer = _make_step_tracer(MAX_TRACE_STEPS)
    sys.settrace(tracer)
    try:
        exec(compile(tracked_module, "<lesson>", "exec"), namespace, namespace)
    finally:
        sys.settrace(None)
`);

    setStatus("Python runtime ready.");
    setLog("Runtime ready. Press Run Python to execute the code in the editor.");
    return pyodide;
  })();

  return pyodideReadyPromise;
}

async function cachePythonOffline() {
  if (!cachePythonButton) {
    return;
  }

  cachePythonButton.disabled = true;
  appendLogLine("Caching Python runtime for offline use...");

  try {
    await ensurePyodide();

    if (!navigator.serviceWorker?.controller) {
      showToast(
        "Python cached",
        "Python is ready. Reload once so the service worker can cache updates for offline use.",
        "success",
      );
      appendLogLine("Python runtime ready. Reload once to enable offline caching if needed.");
      return;
    }

    showToast("Python cached", "This device can now run lessons offline (after the first load).", "success");
    appendLogLine("Python runtime cached for offline use.");
  } catch (error) {
    const message = error?.message || String(error);
    showToast("Cache failed", message, "danger");
    appendLogLine(`Cache failed: ${message}`);
  } finally {
    cachePythonButton.disabled = false;
  }
}

async function runPythonCode() {
  const lesson = getActiveLesson();
  if (!lesson) {
    return;
  }

  runPythonButton.disabled = true;
  setStatus("Preparing Python runtime...");

  try {
    const runtime = await ensurePyodide();
    const originalSource = codeEditor.value;
    const preparedCode = preprocessCode(originalSource).trim();

    if (!preparedCode) {
      throw new Error("Write a few commands first, then press Run Python.");
    }

    saveCurrentDraft();
    resetCanvasState();
    resetMetrics();
    prepareCanvas();
    hideCelebration();
    setLog("Running Python code...");
    setStatus("Running lesson code...");

    runtime.globals.set("source_code", preparedCode);
    await runtime.runPythonAsync(`
reset_drawing()
run_user_code(source_code)
`);
    runtime.globals.delete("source_code");

    const passed = evaluateCheckpoint(lesson, originalSource);
    appendLogLine("Run complete.");
    appendLogLine(passed ? "Checkpoint passed." : "Checkpoint not passed yet.");
    setStatus(passed ? "Checkpoint passed. Nice work." : "The code ran. Tweak it and try again.");
  } catch (error) {
    hideCelebration();
    const message = error?.message || String(error);
    const issue = classifyPythonRuntimeIssue(message);

    checkpointResult.textContent = issue?.checkpoint || "The mission checkpoint is waiting for a successful run.";
    setLessonRunResult(activeProfile, activeTrackId, activeLessonId, "Code needs a fix");
    addRecentActivity(activeProfile, `${lesson.title}: code needs a fix`);
    saveAppState(appState);
    setStatus(issue?.status || "The code needs a small fix before it can run.");
    appendLogLine(message);
    if (issue) {
      showToast(issue.title, issue.toast, "success");
    }
  } finally {
    runPythonButton.disabled = false;
  }
}

function openLesson(lessonId) {
  const lesson = getLesson(lessonCatalog, activeTrackId, lessonId);
  if (!lesson || !isLessonUnlocked(lessonCatalog, activeProfile, activeTrackId, lessonId)) {
    checkpointResult.textContent = "Finish the previous lesson before opening this one.";
    return;
  }
  saveCurrentDraft();
  activeLessonId = lessonId;
  activeProfile.progress.activeLessonIdByTrack[activeTrackId] = lessonId;
  setHintLevel(activeProfile, activeTrackId, lessonId, 0);
  setNoProgressRuns(activeProfile, activeTrackId, lessonId, 0);
  saveAppState(appState);
  hideCelebration();
  renderAll();
  drawWelcomeScene();
  checkpointResult.textContent = "Run your code to see whether the mission checkpoint passes.";
  setStatus(`Loaded lesson: ${lesson.title}`);
  setLog(`Lesson loaded: ${lesson.title}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openNextLesson() {
  const nextLesson = getNextLesson(lessonCatalog, activeTrackId, activeLessonId);
  if (!nextLesson || !isLessonUnlocked(lessonCatalog, activeProfile, activeTrackId, nextLesson.id)) {
    return;
  }
  hideCelebration();
  openLesson(nextLesson.id);
}

function switchTrack(trackId) {
  if (!activeProfile || !getTrack(lessonCatalog, trackId)) {
    return;
  }
  saveCurrentDraft();
  ensureTrackContainers(activeProfile, trackId);
  activeTrackId = trackId;
  activeProfile.progress.activeTrackId = trackId;
  const track = getActiveTrack();
  const preferredLessonId = activeProfile.progress.activeLessonIdByTrack[trackId] || track?.lessons?.[0]?.id || "";
  activeLessonId = isLessonUnlocked(lessonCatalog, activeProfile, trackId, preferredLessonId)
    ? preferredLessonId
    : track?.lessons?.[0]?.id || "";
  activeProfile.progress.activeLessonIdByTrack[trackId] = activeLessonId;
  setHintLevel(activeProfile, activeTrackId, activeLessonId, 0);
  setNoProgressRuns(activeProfile, activeTrackId, activeLessonId, 0);
  saveAppState(appState);
  hideCelebration();
  renderAll();
  drawWelcomeScene();
  checkpointResult.textContent = "Run your code to see whether the mission checkpoint passes.";
  setStatus(`${track?.title || "Track"} loaded.`);
}

function switchProfile(profileId) {
  saveCurrentDraft();
  const nextProfile = getProfile(appState, profileId);
  if (!nextProfile) {
    return;
  }
  activeProfile = nextProfile;
  setActiveProfile(appState, profileId);
  const preferredTrack = getTrack(lessonCatalog, activeProfile.progress.activeTrackId)
    ? activeProfile.progress.activeTrackId
    : activeProfile.age <= 9
      ? "kids"
      : "explorer";
  activeTrackId = preferredTrack;
  ensureTrackContainers(activeProfile, activeTrackId);
  const track = getActiveTrack();
  activeLessonId = activeProfile.progress.activeLessonIdByTrack[activeTrackId] || track?.lessons?.[0]?.id || "";
  setHintLevel(activeProfile, activeTrackId, activeLessonId, 0);
  setNoProgressRuns(activeProfile, activeTrackId, activeLessonId, 0);
  renderAll();
  drawWelcomeScene();
  hideCelebration();
  checkpointResult.textContent = "Run your code to see whether the mission checkpoint passes.";
  setStatus(`Switched to ${activeProfile.name}.`);
}

function resetWorkspace() {
  const lesson = getActiveLesson();
  if (!lesson || !activeProfile) {
    return;
  }
  codeEditor.value = "";
  // Store starterCode as the "baseline" for this lesson while keeping the editor empty.
  // This keeps our "no prefilled code" UX but still remembers what the lesson example was.
  saveDraft(activeProfile, activeTrackId, activeLessonId, lesson.starterCode || "");
  setHintLevel(activeProfile, activeTrackId, activeLessonId, 0);
  setNoProgressRuns(activeProfile, activeTrackId, activeLessonId, 0);
  setExampleRevealed(activeProfile, activeTrackId, activeLessonId, false);
  saveAppState(appState);
  resetCanvasState();
  resetMetrics();
  drawWelcomeScene();
  hideCelebration();
  checkpointResult.textContent = "Run your code to see whether the mission checkpoint passes.";
  setLog("Workspace reset. The editor is cleared and the canvas is ready.");
  setStatus("Workspace reset.");
  renderExamplePanel();
}

lessonList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const button = target.closest("[data-lesson-id]");
  if (!(button instanceof HTMLElement)) {
    return;
  }
  openLesson(button.dataset.lessonId);
});

profileSelect.addEventListener("change", () => {
  switchProfile(profileSelect.value);
});

trackKidsButton.addEventListener("click", () => switchTrack("kids"));
trackExplorerButton.addEventListener("click", () => switchTrack("explorer"));
toggleSidebarButton.addEventListener("click", toggleSidebar);
tabMissions.addEventListener("click", () => setSidebarTab("missions"));
tabBadges.addEventListener("click", () => setSidebarTab("badges"));
runPythonButton.addEventListener("click", runPythonCode);
cachePythonButton?.addEventListener("click", cachePythonOffline);
resetWorkspaceButton.addEventListener("click", resetWorkspace);
nextLessonButton.addEventListener("click", openNextLesson);
closeCelebrationButton.addEventListener("click", hideCelebration);
if (revealExampleButton) {
  revealExampleButton.addEventListener("click", () => {
    const lesson = getActiveLesson();
    if (!lesson || !activeProfile) {
      return;
    }
    const revealed = getExampleRevealed(activeProfile, activeTrackId, lesson.id);
    if (revealed) {
      return;
    }
    if (!getExampleRevealAllowed(lesson)) {
      showToast("Try a bit more", "Run your code a few times first. Then you can reveal an example.");
      return;
    }
    setExampleRevealed(activeProfile, activeTrackId, lesson.id, true);
    saveAppState(appState);
    renderExamplePanel();
    showToast("Example revealed", "Read it line-by-line and try changing one tiny thing.");
  });
}

if (copyExampleButton) {
  copyExampleButton.addEventListener("click", async () => {
    const lesson = getActiveLesson();
    if (!lesson || !activeProfile) {
      return;
    }
    const revealed = getExampleRevealed(activeProfile, activeTrackId, lesson.id);
    if (!revealed) {
      showToast("Hidden", "Reveal the example first.");
      return;
    }
    const code = (lesson.starterCode || "").trim();
    if (!code) {
      return;
    }
    codeEditor.value = code;
    scheduleDraftSave();
    showToast("Copied", "Example code copied into the editor. Now tweak it!");
  });
}

if (showHintButton) {
  showHintButton.addEventListener("click", () => {
    const lesson = getActiveLesson();
    if (!lesson || !activeProfile) {
      return;
    }
    const microHints = Array.isArray(lesson.microHints) ? lesson.microHints : [];
    if (!microHints.length) {
      return;
    }
    const noProgressRuns = getNoProgressRuns(activeProfile, activeTrackId, lesson.id);
    if (noProgressRuns < 1) {
      showToast("Try once first", "Run your code once. If you're still stuck, I'll reveal a hint.");
      return;
    }
    const hintLevel = getHintLevel(activeProfile, activeTrackId, lesson.id);
    setHintLevel(activeProfile, activeTrackId, lesson.id, Math.min(hintLevel + 1, microHints.length));
    saveAppState(appState);
    renderLessonHeader();
  });
}
if (stuckHelpButton) {
  stuckHelpButton.addEventListener("click", () => {
    const lesson = getActiveLesson();
    if (!lesson || !activeProfile) {
      return;
    }
    const microHints = Array.isArray(lesson.microHints) ? lesson.microHints : [];
    if (!microHints.length) {
      return;
    }
    const noProgressRuns = getNoProgressRuns(activeProfile, activeTrackId, lesson.id);
    if (noProgressRuns < 2) {
      showToast("Almost there", "Try running your code a couple times first. Then I'll give a stronger hint.");
      return;
    }
    const hintLevel = getHintLevel(activeProfile, activeTrackId, lesson.id);
    setHintLevel(activeProfile, activeTrackId, lesson.id, Math.min(hintLevel + 1, microHints.length));
    saveAppState(appState);
    renderLessonHeader();
    showToast("Hint unlocked", "Check the hint line above the editor.");
  });
}
codeEditor.addEventListener("input", () => {
  const lesson = getActiveLesson();
  const milestoneCount = lesson ? getLessonMilestones(lesson).length : 0;
  const completedMilestoneCount = lesson ? getCompletedCheckpointSteps(activeProfile, activeTrackId, lesson.id).length : 0;
  lessonStatus.textContent = isLessonComplete(activeProfile, activeTrackId, activeLessonId)
    ? "Completed"
    : `${completedMilestoneCount}/${milestoneCount} milestones`;
  scheduleDraftSave();
});

if (learnerNotes) {
  learnerNotes.addEventListener("input", scheduleNotesSave);
}

if (parentNotes) {
  parentNotes.addEventListener("input", scheduleNotesSave);
}

async function boot() {
  try {
    lessonCatalog = await loadLessonCatalog();
  } catch (error) {
    setStatus(`Lesson data could not be loaded: ${error.message}`);
    setLog(error.message);
    return;
  }

  if (!appState.profiles.length) {
    window.location.href = "./index.html";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const requestedProfile = params.get("profile");
  const requestedTrack = params.get("track");
  const requestedLesson = params.get("lesson");
  activeProfile =
    getProfile(appState, requestedProfile) ||
    getProfile(appState, appState.activeProfileId) ||
    appState.profiles.find((profile) => !profile.archivedAt);

  if (!activeProfile) {
    window.location.href = "./index.html";
    return;
  }

  setActiveProfile(appState, activeProfile.id);
  activeTrackId = getTrack(lessonCatalog, requestedTrack)
    ? requestedTrack
    : getTrack(lessonCatalog, activeProfile.progress.activeTrackId)
      ? activeProfile.progress.activeTrackId
      : activeProfile.age <= 9
        ? "kids"
        : "explorer";
  ensureTrackContainers(activeProfile, activeTrackId);
  const track = getActiveTrack();
  activeLessonId =
    requestedLesson &&
    getLesson(lessonCatalog, activeTrackId, requestedLesson) &&
    isLessonUnlocked(lessonCatalog, activeProfile, activeTrackId, requestedLesson)
      ? requestedLesson
      : activeProfile.progress.activeLessonIdByTrack[activeTrackId] || track?.lessons?.[0]?.id || "";
  activeProfile.progress.activeTrackId = activeTrackId;
  if (activeLessonId) {
    activeProfile.progress.activeLessonIdByTrack[activeTrackId] = activeLessonId;
  }
  saveAppState(appState);
  setSidebarTab("missions");
  renderAll();
  resetCanvasState();
  resetMetrics();
  drawWelcomeScene();
  checkpointResult.textContent = "Run your code to see whether the mission checkpoint passes.";
  setStatus("Pick the starter code apart, then press Run Python.");
}

boot();

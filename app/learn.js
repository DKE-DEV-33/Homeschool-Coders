import {
  addRecentActivity,
  ensureTrackContainers,
  getCompletedCount,
  getDraft,
  getEarnedBadgeCount,
  getLesson,
  getLessonIndex,
  getNextLesson,
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
  setActiveProfile,
  setLessonRunResult,
} from "./state.js";

const PYODIDE_VERSION = "0.27.7";
const pyodideModuleUrl = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.mjs`;

const profileSelect = document.querySelector("#workspace-profile-select");
const trackKidsButton = document.querySelector("#track-kids");
const trackExplorerButton = document.querySelector("#track-explorer");
const workspaceTitle = document.querySelector("#workspace-title");
const lessonTitle = document.querySelector("#lesson-title");
const lessonDescription = document.querySelector("#lesson-description");
const lessonMission = document.querySelector("#lesson-mission");
const lessonSteps = document.querySelector("#lesson-steps");
const checkpointCopy = document.querySelector("#checkpoint-copy");
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
const resetWorkspaceButton = document.querySelector("#reset-workspace");
const codeEditor = document.querySelector("#code-editor");
const editorStatus = document.querySelector("#editor-status");
const lessonStatus = document.querySelector("#lesson-status");
const runtimeLog = document.querySelector("#runtime-log");
const checkpointResult = document.querySelector("#checkpoint-result");
const functionReference = document.querySelector("#function-reference");
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

let appState = loadAppState();
let lessonCatalog = { tracks: [] };
let activeProfile = null;
let activeTrackId = "kids";
let activeLessonId = "";
let saveDraftTimeoutId;
let pyodide;
let pyodideReadyPromise;

const COMMAND_REFERENCE = [
  { signature: 'move(distance)', description: 'Draw forward by a number of pixels.' },
  { signature: 'turn(degrees)', description: 'Turn the turtle before the next move.' },
  { signature: 'pen_color("color")', description: 'Change the drawing color.' },
  { signature: 'line_width(size)', description: 'Make lines thinner or thicker.' },
  { signature: 'write("text", size)', description: 'Write a message on the canvas.' },
  { signature: 'pen_up()', description: 'Move without drawing a line.' },
  { signature: 'pen_down()', description: 'Start drawing again after lifting the pen.' },
  { signature: 'go_to(x, y)', description: 'Jump to a new spot on the canvas.' },
  { signature: 'repeat(4):', description: 'Repeat the indented code block multiple times.' },
  { signature: 'def shape_name():', description: 'Create your own reusable command in later lessons.' },
];

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
  functionCalls: {},
};

function resetMetrics() {
  runMetrics.segments = 0;
  runMetrics.turns = 0;
  runMetrics.colorChanges = 0;
  runMetrics.writes = 0;
  runMetrics.functionCalls = {};
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
  functionReference.innerHTML = "";

  COMMAND_REFERENCE.forEach((item) => {
    const row = document.createElement("article");
    row.className = "reference-item";
    row.innerHTML = `
      <code>${item.signature}</code>
      <p>${item.description}</p>
    `;
    functionReference.append(row);
  });
}

function renderLessonList() {
  const track = getActiveTrack();
  lessonList.innerHTML = "";
  if (!track || !activeProfile) {
    return;
  }

  track.lessons.forEach((lesson, index) => {
    const active = lesson.id === activeLessonId;
    const complete = isLessonComplete(activeProfile, track.id, lesson.id);
    const unlocked = isLessonUnlocked(lessonCatalog, activeProfile, track.id, lesson.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `lesson-card ${active ? "active" : ""} ${complete ? "completed" : ""} ${unlocked ? "" : "locked"}`.trim();
    button.dataset.lessonId = lesson.id;
    button.dataset.short = String(index + 1);
    button.innerHTML = `
      <strong>${index + 1}. ${lesson.title}</strong>
      <span>${unlocked ? lesson.description : "Finish the previous lesson to unlock this one."}</span>
    `;
    lessonList.append(button);
  });
}

function renderLessonHeader() {
  const lesson = getActiveLesson();
  const track = getActiveTrack();
  const lessonNumber = getLessonIndex(lessonCatalog, activeTrackId, activeLessonId) + 1;
  if (!lesson || !track || !activeProfile) {
    return;
  }

  workspaceTitle.textContent = `${activeProfile.name}'s Python Canvas Missions`;
  lessonTitle.textContent = `${track.title} · Lesson ${lessonNumber}: ${lesson.title}`;
  lessonDescription.textContent = lesson.description;
  lessonMission.textContent = lesson.mission;
  checkpointCopy.textContent = buildCheckpointSummary(track, lesson);
  lessonHint.textContent = `Hint: ${lesson.hint}`;
  targetPreviewCopy.textContent = lesson.visualGoal || "Create your own version of the target idea.";
  trackTitle.textContent = track.title;
  trackProgress.textContent = `${getCompletedCount(lessonCatalog, activeProfile, activeTrackId)} of ${track.lessons.length} lessons complete · ${getEarnedBadgeCount(activeProfile)} badges earned`;
  lessonStatus.textContent = isLessonComplete(activeProfile, activeTrackId, activeLessonId) ? "Completed" : "In progress";
  lessonSteps.innerHTML = "";
  (lesson.targetSteps || []).forEach((step) => {
    const chip = document.createElement("span");
    chip.textContent = step;
    lessonSteps.append(chip);
  });
  drawTargetPreview(lesson);
}

function buildCheckpointSummary(track, lesson) {
  const parts = [track.checkpointPrompt];
  const check = lesson.check || {};
  if (check.minSegments) {
    parts.push(`Draw at least ${check.minSegments} line segment${check.minSegments === 1 ? "" : "s"}.`);
  }
  if (check.minTurns) {
    parts.push(`Use turn at least ${check.minTurns} times.`);
  }
  if (check.minColorChanges) {
    parts.push(`Change colors at least ${check.minColorChanges} times.`);
  }
  if (check.requiresWrite) {
    parts.push("Include a write(...) message.");
  }
  if (check.requiresRepeat) {
    parts.push("Use repeat(...) to show a loop.");
  }
  if (check.requiredCommands?.length) {
    parts.push(`Include: ${check.requiredCommands.join(", ")}.`);
  }
  return parts.join(" ");
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

function renderAll() {
  renderProfileSelect();
  renderTrackSwitcher();
  renderLessonList();
  renderBadgeShelf();
  renderFunctionReference();
  renderLessonHeader();
  renderEditor();
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

function setStrokeStyle(color) {
  turtleState.strokeStyle = color;
  drawingContext.strokeStyle = color;
  drawingContext.fillStyle = color;
  runMetrics.colorChanges += 1;
}

function setLineWidth(width) {
  const parsedWidth = Number(width);
  if (!Number.isFinite(parsedWidth) || parsedWidth <= 0) {
    throw new Error("line_width expects a positive number.");
  }
  turtleState.lineWidth = parsedWidth;
  drawingContext.lineWidth = parsedWidth;
}

function turnBy(degrees) {
  const parsedDegrees = Number(degrees);
  if (!Number.isFinite(parsedDegrees)) {
    throw new Error("turn expects a number.");
  }
  turtleState.angle += parsedDegrees;
  runMetrics.turns += 1;
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
  return {
    usesRepeat: /(^|\n)\s*repeat\(/.test(normalized),
    functionDefinitions: [...normalized.matchAll(/^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm)].map((match) => match[1]),
    commands: new Set([...normalized.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g)].map((match) => match[1])),
  };
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
  const check = lesson.check || {};
  const facts = buildCodeFacts(source);
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
      if (!facts.commands.has(commandName)) {
        failures.push(`include ${commandName}(...)`);
      }
    });
  }
  if (check.requiresFunctionDefinition && facts.functionDefinitions.length === 0) {
    failures.push("define your own helper function with def");
  }
  if (check.minFunctionCalls) {
    const helperCalls = facts.functionDefinitions.reduce((total, functionName) => {
      return total + (runMetrics.functionCalls[functionName] || 0);
    }, 0);
    if (helperCalls < check.minFunctionCalls) {
      failures.push(`call your helper function at least ${check.minFunctionCalls} times`);
    }
  }

  if (failures.length) {
    hideCelebration();
    checkpointResult.textContent = `Checkpoint not passed yet. Next try: ${failures.join(", ")}.`;
    setLessonRunResult(activeProfile, activeTrackId, lesson.id, "Needs another try");
    addRecentActivity(activeProfile, `${lesson.title}: needs another try`);
    saveAppState(appState);
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
      },
      pen_down: () => {
        turtleState.penDown = true;
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
    exec(compile(tracked_module, "<lesson>", "exec"), namespace, namespace)
`);

    setStatus("Python runtime ready.");
    setLog("Runtime ready. Press Run Python to execute the code in the editor.");
    return pyodide;
  })();

  return pyodideReadyPromise;
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
    checkpointResult.textContent = "The mission checkpoint is waiting for a successful run.";
    setLessonRunResult(activeProfile, activeTrackId, activeLessonId, "Code needs a fix");
    addRecentActivity(activeProfile, `${lesson.title}: code needs a fix`);
    saveAppState(appState);
    setStatus("The code needs a small fix before it can run.");
    appendLogLine(error?.message || String(error));
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
  saveDraft(activeProfile, activeTrackId, activeLessonId, "");
  saveAppState(appState);
  resetCanvasState();
  resetMetrics();
  drawWelcomeScene();
  hideCelebration();
  checkpointResult.textContent = "Run your code to see whether the mission checkpoint passes.";
  setLog("Canvas reset. Starter code restored for this lesson.");
  setStatus("Workspace reset.");
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
resetWorkspaceButton.addEventListener("click", resetWorkspace);
nextLessonButton.addEventListener("click", openNextLesson);
closeCelebrationButton.addEventListener("click", hideCelebration);
codeEditor.addEventListener("input", () => {
  lessonStatus.textContent = isLessonComplete(activeProfile, activeTrackId, activeLessonId) ? "Completed" : "In progress";
  scheduleDraftSave();
});

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
  activeProfile = getProfile(appState, requestedProfile) || getProfile(appState, appState.activeProfileId) || appState.profiles[0];

  if (!activeProfile) {
    window.location.href = "./index.html";
    return;
  }

  setActiveProfile(appState, activeProfile.id);
  activeTrackId = getTrack(lessonCatalog, activeProfile.progress.activeTrackId)
    ? activeProfile.progress.activeTrackId
    : activeProfile.age <= 9
      ? "kids"
      : "explorer";
  ensureTrackContainers(activeProfile, activeTrackId);
  const track = getActiveTrack();
  activeLessonId = activeProfile.progress.activeLessonIdByTrack[activeTrackId] || track?.lessons?.[0]?.id || "";
  setSidebarTab("missions");
  renderAll();
  resetCanvasState();
  resetMetrics();
  drawWelcomeScene();
  checkpointResult.textContent = "Run your code to see whether the mission checkpoint passes.";
  setStatus("Pick the starter code apart, then press Run Python.");
}

boot();

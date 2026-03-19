const PYODIDE_VERSION = "0.27.7";
const pyodideModuleUrl = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.mjs`;
const STORAGE_KEY = "homeschool-coders-progress-v1";

const trackTitle = document.querySelector("#track-title");
const trackProgress = document.querySelector("#track-progress");
const lessonList = document.querySelector("#lesson-list");
const lessonTitle = document.querySelector("#lesson-title");
const lessonStatus = document.querySelector("#lesson-status");
const lessonDescription = document.querySelector("#lesson-description");
const lessonConcept = document.querySelector("#lesson-concept");
const lessonMission = document.querySelector("#lesson-mission");
const lessonHint = document.querySelector("#lesson-hint");
const checkpointCopy = document.querySelector("#checkpoint-copy");
const checkpointResult = document.querySelector("#checkpoint-result");
const celebrationCard = document.querySelector("#celebration-card");
const celebrationTitle = document.querySelector("#celebration-title");
const celebrationCopy = document.querySelector("#celebration-copy");
const nextLessonButton = document.querySelector("#next-lesson-button");
const codeEditor = document.querySelector("#code-editor");
const editorStatus = document.querySelector("#editor-status");
const runtimeLog = document.querySelector("#runtime-log");
const runDemoButton = document.querySelector("#run-demo");
const resetDemoButton = document.querySelector("#reset-demo");
const loadKidsTrackButton = document.querySelector("#load-kids-track");
const loadExplorerTrackButton = document.querySelector("#load-explorer-track");
const canvas = document.querySelector("#drawing-surface");
const context = canvas.getContext("2d");

const fallbackLessonCatalog = {
  tracks: [],
};

let lessonCatalog = fallbackLessonCatalog;
let progressState = cloneDefaultProgressState();
let activeTrackId = "kids";
let activeLessonId = "";
let pyodide;
let pyodideReadyPromise;
let saveDraftTimeoutId;

const turtleState = {
  x: canvas.width / 2,
  y: canvas.height / 2,
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

function cloneDefaultProgressState() {
  return {
    activeTrackId: "kids",
    activeLessonIdByTrack: {},
    codeDrafts: {},
    completedLessons: {},
  };
}

function loadProgressState() {
  try {
    const savedProgress = window.localStorage.getItem(STORAGE_KEY);

    if (!savedProgress) {
      progressState = cloneDefaultProgressState();
      return;
    }

    const parsedProgress = JSON.parse(savedProgress);
    progressState = {
      activeTrackId: parsedProgress.activeTrackId || "kids",
      activeLessonIdByTrack: parsedProgress.activeLessonIdByTrack || {},
      codeDrafts: parsedProgress.codeDrafts || {},
      completedLessons: parsedProgress.completedLessons || {},
    };
  } catch (error) {
    progressState = cloneDefaultProgressState();
    appendLogLine(`Progress could not be restored: ${error.message}`);
  }
}

function persistProgressState() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progressState));
  } catch (error) {
    appendLogLine(`Progress could not be saved: ${error.message}`);
  }
}

function ensureTrackContainers(trackId) {
  progressState.codeDrafts[trackId] = progressState.codeDrafts[trackId] || {};
  progressState.completedLessons[trackId] = progressState.completedLessons[trackId] || {};
}

function getTrack(trackId) {
  return lessonCatalog.tracks.find((track) => track.id === trackId);
}

function getLesson(trackId, lessonId) {
  const track = getTrack(trackId);
  return track?.lessons.find((lesson) => lesson.id === lessonId);
}

function getLessonIndex(trackId, lessonId) {
  const track = getTrack(trackId);
  return track?.lessons.findIndex((lesson) => lesson.id === lessonId) ?? -1;
}

function getNextLesson(trackId, lessonId) {
  const track = getTrack(trackId);
  const currentIndex = getLessonIndex(trackId, lessonId);

  if (!track || currentIndex < 0) {
    return null;
  }

  return track.lessons[currentIndex + 1] || null;
}

function getActiveLesson() {
  return getLesson(activeTrackId, activeLessonId);
}

function getSavedDraft(trackId, lessonId) {
  return progressState.codeDrafts[trackId]?.[lessonId];
}

function isLessonComplete(trackId, lessonId) {
  return Boolean(progressState.completedLessons[trackId]?.[lessonId]);
}

function isLessonUnlocked(trackId, lessonId) {
  const track = getTrack(trackId);
  const lessonIndex = getLessonIndex(trackId, lessonId);

  if (!track || lessonIndex < 0) {
    return false;
  }

  if (lessonIndex === 0) {
    return true;
  }

  const previousLesson = track.lessons[lessonIndex - 1];
  return isLessonComplete(trackId, previousLesson.id);
}

function getCompletedCount(trackId) {
  const track = getTrack(trackId);

  if (!track) {
    return 0;
  }

  return track.lessons.filter((lesson) => isLessonComplete(trackId, lesson.id)).length;
}

function saveCurrentDraft() {
  if (!activeTrackId || !activeLessonId) {
    return;
  }

  ensureTrackContainers(activeTrackId);
  progressState.codeDrafts[activeTrackId][activeLessonId] = codeEditor.value;
  progressState.activeTrackId = activeTrackId;
  progressState.activeLessonIdByTrack[activeTrackId] = activeLessonId;
  persistProgressState();
}

function scheduleDraftSave() {
  window.clearTimeout(saveDraftTimeoutId);
  saveDraftTimeoutId = window.setTimeout(() => {
    saveCurrentDraft();
  }, 180);
}

function markLessonComplete(trackId, lessonId) {
  ensureTrackContainers(trackId);
  progressState.completedLessons[trackId][lessonId] = true;
  persistProgressState();
}

function getTrackProgressLabel(trackId) {
  const track = getTrack(trackId);
  return `${getCompletedCount(trackId)} of ${track?.lessons.length || 0} missions complete`;
}

function hideCelebration() {
  celebrationCard.classList.add("hidden");
  celebrationCopy.textContent = "";
  nextLessonButton.textContent = "Next Mission";
}

function showCelebration(currentLesson, nextLesson) {
  celebrationCard.classList.remove("hidden");

  if (nextLesson) {
    celebrationTitle.textContent = "Mission complete";
    celebrationCopy.textContent = `You unlocked "${nextLesson.title}". Keep the momentum going with the next drawing challenge.`;
    nextLessonButton.textContent = `Open ${nextLesson.title}`;
    nextLessonButton.disabled = false;
  } else {
    celebrationTitle.textContent = "Track complete";
    celebrationCopy.textContent = "You finished every mission in this track. You can replay them, remix them, or switch tracks for a new challenge.";
    nextLessonButton.textContent = "All Missions Complete";
    nextLessonButton.disabled = true;
  }
}

async function loadLessonCatalog() {
  try {
    const response = await fetch("../public/lessons.json");

    if (!response.ok) {
      throw new Error(`Lesson catalog request failed with ${response.status}.`);
    }

    lessonCatalog = await response.json();
  } catch (error) {
    lessonCatalog = fallbackLessonCatalog;
    setLog(`Could not load lesson catalog.\n${error.message}`);
    setStatus("Lesson data could not be loaded.");
  }
}

function renderTrack(trackId) {
  const track = getTrack(trackId);

  if (!track) {
    return;
  }

  ensureTrackContainers(trackId);
  activeTrackId = trackId;
  progressState.activeTrackId = trackId;

  const preferredLessonId = progressState.activeLessonIdByTrack[trackId] || track.lessons[0]?.id || "";
  activeLessonId = isLessonUnlocked(trackId, preferredLessonId) ? preferredLessonId : track.lessons[0]?.id || "";
  progressState.activeLessonIdByTrack[trackId] = activeLessonId;

  trackTitle.textContent = track.title;
  trackProgress.textContent = getTrackProgressLabel(trackId);
  checkpointCopy.textContent = track.checkpointPrompt;
  renderLessonList(track);
  renderLessonDetails();
  hideCelebration();
  persistProgressState();
}

function renderLessonList(track) {
  lessonList.innerHTML = "";

  track.lessons.forEach((lesson) => {
    const isActive = lesson.id === activeLessonId;
    const isComplete = isLessonComplete(track.id, lesson.id);
    const isUnlocked = isLessonUnlocked(track.id, lesson.id);
    const item = document.createElement("button");

    item.type = "button";
    item.className = `lesson-card ${isActive ? "active" : ""} ${isComplete ? "completed" : ""} ${isUnlocked ? "" : "locked"}`.trim();
    item.innerHTML = `
      <strong>${lesson.title}</strong>
      <span>${isUnlocked ? lesson.description : "Finish the mission before this one to unlock it."}</span>
    `;

    item.addEventListener("click", () => {
      if (!isUnlocked) {
        setStatus("That mission is still locked.");
        checkpointResult.textContent = "Finish the mission before it to unlock this one.";
        return;
      }

      saveCurrentDraft();
      activeLessonId = lesson.id;
      progressState.activeLessonIdByTrack[track.id] = lesson.id;
      renderLessonList(track);
      renderLessonDetails();
      hideCelebration();
      checkpointResult.textContent = "Run your code to see whether the mission checkpoint passes.";
      setStatus(`Loaded lesson: ${lesson.title}`);
      setLog(`Lesson loaded: ${lesson.title}`);
      persistProgressState();
    });
    lessonList.append(item);
  });
}

function renderLessonDetails() {
  const lesson = getActiveLesson();

  if (!lesson) {
    return;
  }

  const savedDraft = getSavedDraft(activeTrackId, lesson.id);
  const completed = isLessonComplete(activeTrackId, lesson.id);
  const nextLesson = getNextLesson(activeTrackId, lesson.id);

  lessonTitle.textContent = lesson.title;
  lessonStatus.textContent = completed ? "Completed" : "In progress";
  lessonDescription.textContent = lesson.description;
  lessonConcept.textContent = `Concept: ${lesson.concept}`;
  lessonMission.textContent = `Mission: ${lesson.mission}`;
  lessonHint.textContent = completed
    ? nextLesson
      ? `Hint: You can replay this mission or jump into "${nextLesson.title}" next.`
      : "Hint: You finished the whole track. Try remixing your art or switch tracks."
    : `Hint: ${lesson.hint}`;
  codeEditor.value = savedDraft || lesson.starterCode;
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

function resetCanvasState() {
  turtleState.x = canvas.width / 2;
  turtleState.y = canvas.height / 2;
  turtleState.angle = 0;
  turtleState.penDown = true;
  turtleState.strokeStyle = "#214e5f";
  turtleState.lineWidth = 4;
}

function drawWelcomeScene() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#fffdf8";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#eef6f8";
  context.fillRect(18, 18, canvas.width - 36, canvas.height - 36);

  context.strokeStyle = "#214e5f";
  context.lineWidth = 4;
  context.lineJoin = "round";

  context.beginPath();
  context.moveTo(120, 220);
  context.lineTo(200, 140);
  context.lineTo(280, 220);
  context.lineTo(200, 300);
  context.closePath();
  context.stroke();

  context.strokeStyle = "#de5b31";
  context.lineWidth = 6;
  context.beginPath();
  context.arc(390, 150, 60, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = "#ffcf84";
  context.fillRect(328, 230, 126, 28);

  context.fillStyle = "#1f252b";
  context.font = '700 18px "Avenir Next", sans-serif';
  context.fillText("Python canvas studio", 28, 42);

  context.font = '500 14px "Atkinson Hyperlegible", sans-serif';
  context.fillText("Click Run Python to draw with real code.", 28, 68);
}

function prepareCanvas() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#fffdf8";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = turtleState.strokeStyle;
  context.lineWidth = turtleState.lineWidth;
  context.lineCap = "round";
  context.lineJoin = "round";
}

function setStrokeStyle(color) {
  turtleState.strokeStyle = color;
  context.strokeStyle = color;
  context.fillStyle = color;
  runMetrics.colorChanges += 1;
}

function setLineWidth(width) {
  const parsedWidth = Number(width);

  if (!Number.isFinite(parsedWidth) || parsedWidth <= 0) {
    throw new Error("line_width expects a positive number.");
  }

  turtleState.lineWidth = parsedWidth;
  context.lineWidth = parsedWidth;
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
    context.beginPath();
    context.moveTo(turtleState.x, turtleState.y);
    context.lineTo(nextX, nextY);
    context.stroke();
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
    context.beginPath();
    context.moveTo(turtleState.x, turtleState.y);
    context.lineTo(nextX, nextY);
    context.stroke();
    runMetrics.segments += 1;
  }

  turtleState.x = nextX;
  turtleState.y = nextY;
}

function writeText(message, size = 20) {
  const fontSize = Number(size);

  if (!Number.isFinite(fontSize) || fontSize <= 0) {
    throw new Error("write expects the font size to be a positive number.");
  }

  context.save();
  context.translate(turtleState.x, turtleState.y);
  context.fillStyle = turtleState.strokeStyle;
  context.font = `700 ${fontSize}px "Avenir Next", sans-serif`;
  context.fillText(String(message), 0, 0);
  context.restore();
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
    functionDefinitions: [...normalized.matchAll(/^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm)].map(
      (match) => match[1],
    ),
    commands: new Set([...normalized.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g)].map((match) => match[1])),
  };
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

  if (failures.length > 0) {
    hideCelebration();
    checkpointResult.textContent = `Checkpoint not yet passed. Next try: ${failures.join(", ")}.`;
    return false;
  }

  checkpointResult.textContent = lesson.successMessage;
  markLessonComplete(activeTrackId, lesson.id);
  trackProgress.textContent = getTrackProgressLabel(activeTrackId);
  lessonStatus.textContent = "Completed";
  renderLessonList(getTrack(activeTrackId));
  renderLessonDetails();
  showCelebration(lesson, getNextLesson(activeTrackId, lesson.id));
  return true;
}

async function ensurePyodide() {
  if (pyodideReadyPromise) {
    return pyodideReadyPromise;
  }

  pyodideReadyPromise = (async () => {
    setStatus("Loading Python runtime for the browser...");
    setLog("Loading Pyodide from the official CDN. This first run can take a little longer.");

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
  runDemoButton.disabled = true;
  setStatus("Preparing Python runtime...");

  try {
    const runtime = await ensurePyodide();
    const lesson = getActiveLesson();
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
    appendLogLine(
      passed
        ? "Checkpoint passed."
        : "Checkpoint not passed yet. Use the mission note for the next tweak.",
    );
    setStatus(
      passed
        ? "Checkpoint passed. Nice work."
        : "The code ran, and the checkpoint has a clue for your next try.",
    );
  } catch (error) {
    hideCelebration();
    setStatus("The code needs a small fix before it can run.");
    checkpointResult.textContent = "The mission checkpoint is waiting for a successful run.";
    appendLogLine(error?.message || String(error));
  } finally {
    runDemoButton.disabled = false;
  }
}

function openLesson(lessonId) {
  const lesson = getLesson(activeTrackId, lessonId);

  if (!lesson || !isLessonUnlocked(activeTrackId, lessonId)) {
    return;
  }

  saveCurrentDraft();
  activeLessonId = lessonId;
  progressState.activeLessonIdByTrack[activeTrackId] = lessonId;
  renderLessonList(getTrack(activeTrackId));
  renderLessonDetails();
  hideCelebration();
  checkpointResult.textContent = "Run your code to see whether the mission checkpoint passes.";
  setStatus(`Loaded lesson: ${lesson.title}`);
  setLog(`Lesson loaded: ${lesson.title}`);
  persistProgressState();
}

function openNextLesson() {
  const nextLesson = getNextLesson(activeTrackId, activeLessonId);

  if (!nextLesson || !isLessonUnlocked(activeTrackId, nextLesson.id)) {
    return;
  }

  openLesson(nextLesson.id);
}

function resetWorkspace() {
  const lesson = getActiveLesson();

  if (!lesson) {
    return;
  }

  ensureTrackContainers(activeTrackId);
  codeEditor.value = lesson.starterCode;
  progressState.codeDrafts[activeTrackId][activeLessonId] = lesson.starterCode;
  persistProgressState();
  resetCanvasState();
  resetMetrics();
  drawWelcomeScene();
  hideCelebration();
  checkpointResult.textContent = "Run your code to see whether the mission checkpoint passes.";
  setLog("Canvas reset. Starter code restored for this lesson.");
  setStatus("Workspace reset.");
}

loadKidsTrackButton.addEventListener("click", () => {
  saveCurrentDraft();
  renderTrack("kids");
  checkpointResult.textContent = "Run your code to see whether the mission checkpoint passes.";
  setStatus("Kids track loaded.");
  setLog("Little Learners track loaded with beginner-friendly drawing prompts.");
});

loadExplorerTrackButton.addEventListener("click", () => {
  saveCurrentDraft();
  renderTrack("explorer");
  checkpointResult.textContent = "Run your code to see whether the mission checkpoint passes.";
  setStatus("Explorer track loaded.");
  setLog("Explorer track loaded with the same concepts and more open-ended patterns.");
});

runDemoButton.addEventListener("click", () => {
  runPythonCode();
});

resetDemoButton.addEventListener("click", () => {
  resetWorkspace();
});

nextLessonButton.addEventListener("click", () => {
  openNextLesson();
});

codeEditor.addEventListener("input", () => {
  lessonStatus.textContent = isLessonComplete(activeTrackId, activeLessonId) ? "Completed" : "In progress";
  scheduleDraftSave();
});

async function boot() {
  loadProgressState();
  await loadLessonCatalog();

  if (!lessonCatalog.tracks.length) {
    return;
  }

  const preferredTrack = getTrack(progressState.activeTrackId) ? progressState.activeTrackId : "kids";
  renderTrack(preferredTrack);
  resetCanvasState();
  resetMetrics();
  drawWelcomeScene();
  checkpointResult.textContent = "Run your code to see whether the mission checkpoint passes.";
  setStatus("Pick a track, then run the starter Python code.");
}

boot();

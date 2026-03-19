const lessonTracks = {
  kids: {
    title: "Little Learners",
    checkpoint:
      "Draw a square with four equal sides, then explain what the loop is doing.",
    starterCode: `pen_color("skyblue")
line_width(6)
repeat(4):
    move(90)
    turn(90)

turn(45)
pen_color("goldenrod")
move(60)
write("Square complete!", 22)`,
    lessons: [
      {
        title: "Meet the Turtle",
        description: "Tell the turtle where to move and watch lines appear.",
      },
      {
        title: "Corners and Squares",
        description: "Use turn commands to make your first neat shape.",
      },
      {
        title: "Repeat Magic",
        description: "Learn how loops help the turtle do the same job again.",
      },
      {
        title: "Color Party",
        description: "Change line colors and make your drawing feel alive.",
      },
    ],
  },
  explorer: {
    title: "Explorer",
    checkpoint:
      "Refactor repeated drawing instructions into a reusable helper and describe why that makes the program easier to change.",
    starterCode: `pen_color("coral")
line_width(4)

def petal():
    repeat(6):
        move(70)
        turn(60)

repeat(8):
    petal()
    turn(45)

write("Loops create patterns", 18)`,
    lessons: [
      {
        title: "Drawing with Intent",
        description: "Map motion commands to geometric outcomes on the canvas.",
      },
      {
        title: "Loops and Patterns",
        description: "Use repetition to simplify code and generate visuals.",
      },
      {
        title: "Functions as Tools",
        description: "Bundle drawing logic into reusable building blocks.",
      },
      {
        title: "Challenge Missions",
        description: "Recreate a target pattern with less code and more clarity.",
      },
    ],
  },
};

const PYODIDE_VERSION = "0.27.7";
const pyodideModuleUrl = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.mjs`;

const trackTitle = document.querySelector("#track-title");
const lessonList = document.querySelector("#lesson-list");
const checkpointCopy = document.querySelector("#checkpoint-copy");
const codeEditor = document.querySelector("#code-editor");
const editorStatus = document.querySelector("#editor-status");
const runtimeLog = document.querySelector("#runtime-log");
const runDemoButton = document.querySelector("#run-demo");
const resetDemoButton = document.querySelector("#reset-demo");
const loadKidsTrackButton = document.querySelector("#load-kids-track");
const loadExplorerTrackButton = document.querySelector("#load-explorer-track");
const canvas = document.querySelector("#drawing-surface");
const context = canvas.getContext("2d");

let activeTrackKey = "kids";
let pyodide;
let pyodideReadyPromise;

const turtleState = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  angle: 0,
  penDown: true,
  strokeStyle: "#214e5f",
  lineWidth: 4,
};

function renderTrack(trackKey) {
  const track = lessonTracks[trackKey];

  activeTrackKey = trackKey;
  trackTitle.textContent = track.title;
  checkpointCopy.textContent = track.checkpoint;
  codeEditor.value = track.starterCode;
  lessonList.innerHTML = "";

  track.lessons.forEach((lesson, index) => {
    const item = document.createElement("article");
    item.className = `lesson-card ${index === 0 ? "active" : ""}`;
    item.innerHTML = `
      <strong>${lesson.title}</strong>
      <span>${lesson.description}</span>
    `;
    lessonList.append(item);
  });
}

function setStatus(message) {
  editorStatus.textContent = message;
}

function setLog(message) {
  runtimeLog.textContent = message;
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
}

function preprocessCode(source) {
  const normalized = source.replace(/\r\n/g, "\n");
  return normalized.replace(/^(\s*)repeat\((.+)\):/gm, "$1for _ in range($2):");
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
      reset_canvas: () => {
        resetCanvasState();
        prepareCanvas();
      },
    });

    await pyodide.runPythonAsync(`
from canvas_api import (
    move_by as canvas_move_by,
    turn_by as canvas_turn_by,
    pen_up as canvas_pen_up,
    pen_down as canvas_pen_down,
    pen_color as canvas_pen_color,
    line_width as canvas_line_width,
    go_to as canvas_go_to,
    write_text as canvas_write_text,
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
`);

    setStatus("Python runtime ready.");
    setLog("Runtime ready. Press Run Python to execute the code in the editor.");
    return pyodide;
  })();

  return pyodideReadyPromise;
}

function appendLogLine(message) {
  if (runtimeLog.textContent === "Runtime log will appear here.") {
    runtimeLog.textContent = "";
  }

  runtimeLog.textContent += `${message}\n`;
}

async function runPythonCode() {
  runDemoButton.disabled = true;
  setStatus("Preparing Python runtime...");

  try {
    const runtime = await ensurePyodide();
    const preparedCode = preprocessCode(codeEditor.value).trim();

    resetCanvasState();
    prepareCanvas();
    setLog("Running Python code...");
    setStatus("Running lesson code...");

    if (!preparedCode) {
      throw new Error("Write a few commands first, then press Run Python.");
    }

    await runtime.runPythonAsync(`
reset_drawing()
${preparedCode}
`);

    appendLogLine("Run complete.");
    setStatus("Python finished. Tweak the code and run again to explore.");
  } catch (error) {
    setStatus("The code needs a small fix before it can run.");
    appendLogLine(error?.message || String(error));
  } finally {
    runDemoButton.disabled = false;
  }
}

function resetWorkspace() {
  renderTrack(activeTrackKey);
  resetCanvasState();
  drawWelcomeScene();
  setLog("Canvas reset. Starter code restored for this track.");
  setStatus("Workspace reset.");
}

loadKidsTrackButton.addEventListener("click", () => {
  renderTrack("kids");
  setStatus("Kids track loaded.");
  setLog("Little Learners track loaded with beginner-friendly drawing prompts.");
});

loadExplorerTrackButton.addEventListener("click", () => {
  renderTrack("explorer");
  setStatus("Explorer track loaded.");
  setLog("Explorer track loaded with the same concepts and more open-ended patterns.");
});

runDemoButton.addEventListener("click", () => {
  runPythonCode();
});

resetDemoButton.addEventListener("click", () => {
  resetWorkspace();
});

renderTrack("kids");
resetCanvasState();
drawWelcomeScene();
setStatus("Pick a track, then run the starter Python code.");

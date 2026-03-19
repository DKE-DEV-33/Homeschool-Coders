const lessonTracks = {
  kids: {
    title: "Little Learners",
    checkpoint:
      "Draw a square with four equal sides, then explain what the loop is doing.",
    starterCode: `pen_color("skyblue")
repeat(4):
    move(90)
    turn(90)`,
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
for _ in range(6):
    move(70)
    turn(60)`,
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

const trackTitle = document.querySelector("#track-title");
const lessonList = document.querySelector("#lesson-list");
const checkpointCopy = document.querySelector("#checkpoint-copy");
const codeEditor = document.querySelector("#code-editor");
const editorStatus = document.querySelector("#editor-status");
const runDemoButton = document.querySelector("#run-demo");
const resetDemoButton = document.querySelector("#reset-demo");
const loadKidsTrackButton = document.querySelector("#load-kids-track");
const loadExplorerTrackButton = document.querySelector("#load-explorer-track");
const canvas = document.querySelector("#drawing-surface");
const context = canvas.getContext("2d");

function renderTrack(trackKey) {
  const track = lessonTracks[trackKey];

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

function drawScene() {
  context.clearRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#fffdf8";
  context.fillRect(0, 0, canvas.width, canvas.height);

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
  context.fillRect(340, 230, 100, 26);

  context.fillStyle = "#1f252b";
  context.font = '700 18px "Avenir Next", sans-serif';
  context.fillText("Canvas mission preview", 28, 36);
}

function setStatus(message) {
  editorStatus.textContent = message;
}

loadKidsTrackButton.addEventListener("click", () => {
  renderTrack("kids");
  setStatus("Kids track loaded. Next step is wiring these lesson cards to real exercises and checks.");
});

loadExplorerTrackButton.addEventListener("click", () => {
  renderTrack("explorer");
  setStatus("Explorer track loaded. This mode will share concepts but add deeper explanations and open prompts.");
});

runDemoButton.addEventListener("click", () => {
  drawScene();
  setStatus("Demo canvas refreshed. The future Python runner will translate lesson code into drawings here.");
});

resetDemoButton.addEventListener("click", () => {
  renderTrack("kids");
  drawScene();
  setStatus("Starter state restored.");
});

renderTrack("kids");
drawScene();


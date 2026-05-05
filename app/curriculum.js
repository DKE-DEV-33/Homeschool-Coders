export const CURRICULUM_UNITS = {
  kids: [
    {
      id: "u1",
      title: "Unit 1: Turtle Basics",
      lessonIds: ["meet-the-turtle", "long-and-short-lines", "turn-left-turn-right"],
    },
    {
      id: "u2",
      title: "Unit 2: Shapes With Loops",
      lessonIds: ["draw-a-square", "repeat-magic", "polygon-party", "pattern-spinner", "color-changes"],
    },
    {
      id: "u3",
      title: "Unit 3: Position And Scenes",
      lessonIds: ["pen-up-pen-down", "move-to-a-new-spot", "build-a-tiny-scene", "layer-shapes"],
    },
    {
      id: "u4",
      title: "Unit 4: Functions (Helpers)",
      lessonIds: ["make-a-stamp", "stamp-parade", "petal-power"],
    },
    {
      id: "u5",
      title: "Unit 5: Variables And Choices",
      lessonIds: [
        "name-a-number",
        "two-sizes",
        "color-variables",
        "if-color-choice",
        "if-two-paths",
        "elif-rainbow-choice",
      ],
    },
  ],
  explorer: [
    {
      id: "u1",
      title: "Unit 1: Fundamentals",
      lessonIds: ["sequence-and-side-effects", "numbers-and-parameters", "turning-and-angles"],
    },
    {
      id: "u2",
      title: "Unit 2: Loops And Patterns",
      lessonIds: ["loops-and-repetition", "polygons-and-iteration", "nested-loops-patterns", "state-and-style"],
    },
    {
      id: "u3",
      title: "Unit 3: Scenes And Composition",
      lessonIds: ["coordinates-and-placement", "scene-composition", "drawing-order-and-layering"],
    },
    {
      id: "u4",
      title: "Unit 4: Functions (Abstractions)",
      lessonIds: ["defining-reusable-shapes", "parameters-for-reuse", "composing-helpers"],
    },
    {
      id: "u5",
      title: "Unit 5: Variables And Branching",
      lessonIds: ["variables-as-names", "variables-for-style", "reassignment-and-change", "if-statements", "if-else-branches", "elif-ladders"],
    },
  ],
};

export function getUnitForLesson(trackId, lessonId) {
  const units = CURRICULUM_UNITS[trackId] || [];
  for (const unit of units) {
    if (unit.lessonIds.includes(lessonId)) {
      return unit;
    }
  }
  return null;
}


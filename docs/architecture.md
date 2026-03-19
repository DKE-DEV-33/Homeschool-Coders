# Architecture Notes

## Product direction

The first version should be a local browser app that feels like a small coding studio instead of a traditional course page. The experience needs to support two audiences with the same core concepts:

- `Little Learners` for ages 6 to 9, with short missions, friendlier language, and fast visual reward loops.
- `Explorer` mode for adult learning, with more explanation and reflection.

## Proposed technical stack

### Phase 1

- Plain browser app shell for fast iteration.
- Static lesson data stored locally in JSON or JavaScript modules.
- Canvas renderer for turtle-style output.
- `localStorage` for saving progress and the last open lesson.

### Phase 2

- Browser-based Python runtime via Pyodide.
- Restricted drawing and helper API exposed to Python.
- A lesson engine that can evaluate completion conditions.

### Phase 3

- File-based content authoring for lessons, hints, and checkpoints.
- Optional packaging into a desktop wrapper if local browser usage feels limiting.

## Runtime model

The safest browser-first path is:

1. Load Pyodide in the browser.
2. Expose a narrow command surface such as `move`, `turn`, `pen_color`, `pen_up`, and `pen_down`.
3. Translate those commands into canvas drawing operations.
4. Intercept errors and return child-friendly feedback when possible.

This keeps execution local while making the environment feel cohesive.

## Core modules to build next

- `lesson engine`: lesson metadata, steps, hints, and checkpoint evaluation.
- `progress store`: track lesson status, saved code, and history.
- `python bridge`: runtime boot, command registration, and error handling.
- `drawing engine`: turtle state, animation timing, and canvas reset controls.

## Guardrails for child-friendly design

- Keep lesson prompts short and plain.
- Reward partial progress without blocking experimentation too hard.
- Default to visible feedback over text-heavy feedback.
- Make reset paths easy so mistakes feel safe.


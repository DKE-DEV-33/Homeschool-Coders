# Homeschool Coders

Homeschool Coders is a local-first learning suite for teaching programming through playful guided lessons, visual drawing, and hands-on experimentation. The first release is focused on Python, turtle-style canvas drawing, and a lesson experience that works for both adult learners and children ages 6 to 9.

## Why a local browser app

- Easier to launch and use across computers without platform-specific packaging.
- Safer to sandbox code execution and reset activities between lessons.
- Faster to build rich interactive lessons, checkpoints, and visual feedback.
- Flexible enough to wrap as a desktop app later if we decide that is helpful.

## Vision for v1

- Python lesson runner in a local browser-based workspace.
- Split learning modes for `Little Learners` and `Explorer`.
- Turtle or canvas drawing output in the same interface as the editor.
- Guided lessons with hints, checkpoints, and progress tracking.
- Self-contained content with no subscription dependency.

## Repository layout

```text
app/          Browser application shell
curriculum/   Lesson outlines and concept progression
docs/         Product and architecture notes
public/       Static lesson data and assets
```

## Getting started

This first scaffold is plain HTML, CSS, and JavaScript so the project stays easy to inspect and evolve.

1. Clone the repository.
2. Open a local static server in the repo root.
3. Visit the served address in your browser.

Example:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173/app/`.

Note: the current Python runtime uses Pyodide loaded from the official CDN on first run. The app itself is local, and we can vendor that runtime into the repo later if you want a more fully self-contained offline setup.

## What is included now

- A visual shell for the learning environment.
- A working in-browser Python runtime connected to a canvas drawing API.
- A lesson catalog with mission text, hints, and simple checkpoint rules.
- Local progress saving for selected lessons, code drafts, and completed checkpoints.
- A first-pass lesson map and child-friendly product direction.
- Architecture notes for adding a Python runner and lesson engine next.

## Planned next milestones

1. Add a browser-based Python runtime with a restricted drawing API.
2. Build the lesson engine, checkpoint logic, and progress persistence.
3. Implement the first guided missions for shapes, loops, and functions.
4. Add adult-friendly `Explorer` lessons that explain the same concepts with more depth.

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

Tip: once Pyodide loads successfully at least once, the service worker will cache the runtime so you can keep running lessons offline on that same device/browser.

## What is included now

- A two-page browser experience with a calmer home screen and a dedicated lesson studio.
- A working in-browser Python runtime connected to a canvas drawing API.
- Dynamic local learner profiles with names, ages, separate drafts, and separate progress.
- A home page with profile creation plus a parent overview of every learner.
- A lesson catalog with mission text, top-of-screen instructions, hints, and checkpoint rules.
- Local progress saving for lessons, code drafts, badges, and completed checkpoints.
- Guided mission flow with lesson unlocking and one-click next-lesson navigation.
- A collapsible lesson-path sidebar with `Explorer` and `Badge Shelf` tabs.
- Reward badges, target previews, and full-screen workspace focus for the code-and-canvas experience.
- A celebration modal with three stars, confetti, and next-lesson flow when checkpoints pass.
- The first full beginner path for both tracks, covering Units 1 through 3 of Python drawing foundations.
- A first-pass lesson map and child-friendly product direction.
- Architecture notes for continuing into later curriculum units and richer teaching tools.

## Planned next milestones

1. Add richer curriculum content for Units 4 and 5, especially functions and decisions.
2. Expand profile management with edit and archive controls.
3. Add stronger teacher-facing progress review, timestamps, and lesson summaries.
4. Vendor the browser Python runtime locally for a more fully offline setup.

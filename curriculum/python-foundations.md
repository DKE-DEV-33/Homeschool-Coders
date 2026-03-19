# Python Foundations

## Curriculum Goal

This sequence is the first full curriculum backbone for Homeschool Coders. It is designed to work for two audiences at once:

- `Little Learners`: ages 6 to 9, using short missions, visible rewards, and plain language.
- `Explorer`: older learners or adults who want the same concepts with deeper framing and reflection.

The main idea is to teach real Python through drawing, repetition, placement, reuse, and simple choices. Every lesson should feel visual, doable, and connected to the next one.

## Teaching Principles

- Keep each lesson focused on one main concept.
- Make visual success happen quickly.
- Use the same command language across tracks when possible.
- Let `Explorer` mirror the same ideas while adding more explanation and stretch thinking.
- End every unit with a small build or challenge, not just isolated drills.

## Unit Map

### Unit 1: First Commands

Core idea: code runs in order, and simple commands create visible change.

1. `Meet the Turtle`
2. `Long and Short Lines`
3. `Turn Left, Turn Right`
4. `Draw a Square`

### Unit 2: Repetition

Core idea: loops let us reuse instructions and create patterns.

5. `Repeat Magic`
6. `Triangles and Hexagons`
7. `Pattern Spinner`
8. `Color Changes`

### Unit 3: Placement and Scenes

Core idea: we can lift the pen, move to new positions, and combine shapes into a scene.

9. `Pen Up, Pen Down`
10. `Move to a New Spot`
11. `Build a Tiny Scene`
12. `Layer Shapes`

### Unit 4: Functions

Core idea: functions let us name and reuse sets of instructions.

13. `Make Your Own Command`
14. `Reuse a Shape`
15. `Build a Picture with Helpers`
16. `Function Challenge`

### Unit 5: Decisions and Mini Projects

Core idea: programs can react and branch, and learners can combine everything into a final project.

17. `Simple If Choices`
18. `Interactive Mini Project`

## Full Lesson Sequence

### Lesson 1: Meet the Turtle

- Focus: first command, visible feedback
- Kid mission: draw one line and add a word
- Explorer angle: sequence and side effects

### Lesson 2: Long and Short Lines

- Focus: arguments change behavior
- Kid mission: draw lines of different lengths
- Explorer angle: parameters as inputs

### Lesson 3: Turn Left, Turn Right

- Focus: heading and direction
- Kid mission: make corners and zigzags
- Explorer angle: angle, orientation, next instruction effect

### Lesson 4: Draw a Square

- Focus: combining move and turn in a simple shape
- Kid mission: make a square
- Explorer angle: repeated geometry and quarter turns

### Lesson 5: Repeat Magic

- Focus: first loop
- Kid mission: use `repeat(...)` to avoid writing the same code over and over
- Explorer angle: repetition as abstraction

### Lesson 6: Triangles and Hexagons

- Focus: loop count changes shapes
- Kid mission: compare a triangle and hexagon
- Explorer angle: matching turn angles to regular polygons

### Lesson 7: Pattern Spinner

- Focus: nested visual repetition
- Kid mission: spin a shape to make a pattern
- Explorer angle: combining loops and turning between shapes

### Lesson 8: Color Changes

- Focus: state changes inside patterns
- Kid mission: make a multicolor drawing
- Explorer angle: stateful commands and visual styling

### Lesson 9: Pen Up, Pen Down

- Focus: drawing versus moving
- Kid mission: move without leaving a line
- Explorer angle: separating path creation from positioning

### Lesson 10: Move to a New Spot

- Focus: absolute placement
- Kid mission: place a new shape somewhere else on the canvas
- Explorer angle: coordinates and scene layout

### Lesson 11: Build a Tiny Scene

- Focus: combine multiple shapes into one picture
- Kid mission: make a house, sun, or simple garden
- Explorer angle: composition from smaller pieces

### Lesson 12: Layer Shapes

- Focus: ordering and overlapping
- Kid mission: make a scene with at least three parts
- Explorer angle: drawing order and structure

### Lesson 13: Make Your Own Command

- Focus: first function
- Kid mission: create one named helper
- Explorer angle: function definition and naming

### Lesson 14: Reuse a Shape

- Focus: calling a function more than once
- Kid mission: reuse a helper in different places
- Explorer angle: abstraction and duplication removal

### Lesson 15: Build a Picture with Helpers

- Focus: multiple helpers in one project
- Kid mission: build a bigger picture from named pieces
- Explorer angle: decomposition and readable structure

### Lesson 16: Function Challenge

- Focus: open-ended function design
- Kid mission: create a reusable art tool
- Explorer angle: cleaner organization and stretch challenge

### Lesson 17: Simple If Choices

- Focus: first branching behavior
- Kid mission: choose one drawing action when a simple condition is true and another when it is false
- Explorer angle: boolean decisions and branching flow

### Lesson 18: Interactive Mini Project

- Focus: combine commands, loops, placement, and functions into a final build
- Kid mission: make a favorite scene or badge poster
- Explorer angle: synthesis and reflection

## First Implementation Target

The first serious curriculum release should fully implement Units 1 through 3, which gives us `12` lessons and a complete beginner path before moving into functions and conditionals.

### Priority order

1. `Unit 1: First Commands`
2. `Unit 2: Repetition`
3. `Unit 3: Placement and Scenes`
4. `Unit 4: Functions`
5. `Unit 5: Decisions and Mini Projects`

## Lesson Template

Every implemented lesson should include:

- title
- short description
- mission
- visual goal
- target steps
- reward badge
- starter code
- checkpoint rule set
- success message
- target preview
- optional stretch prompt

## Track Translation Notes

The `Little Learners` and `Explorer` tracks should stay aligned by concept, not necessarily by wording.

- `Little Learners`: use playful language such as `make a zigzag` or `build a tiny scene`
- `Explorer`: explain the same lesson with terms like `sequence`, `parameter`, `state`, and `abstraction`

This lets one shared code engine support both audiences while the content stays age-appropriate.

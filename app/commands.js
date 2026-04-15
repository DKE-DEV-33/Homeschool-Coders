export const COMMAND_REFERENCE = {
  move: { signature: "move(distance)", description: "Draw forward by a number of pixels." },
  turn: { signature: "turn(degrees)", description: "Turn the turtle before the next move." },
  pen_color: { signature: 'pen_color("color")', description: "Change the drawing color." },
  line_width: { signature: "line_width(size)", description: "Make lines thinner or thicker." },
  write: { signature: 'write("text", size)', description: "Write a message on the canvas." },
  pen_up: { signature: "pen_up()", description: "Move without drawing a line." },
  pen_down: { signature: "pen_down()", description: "Start drawing again after lifting the pen." },
  go_to: { signature: "go_to(x, y)", description: "Jump to a new spot on the canvas." },
  repeat: { signature: "repeat(4):", description: "Repeat the indented code block multiple times." },
  def: { signature: "def shape_name():", description: "Create your own reusable command in later lessons." },
};


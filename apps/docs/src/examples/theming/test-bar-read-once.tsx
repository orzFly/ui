import { useEffect, useRef } from "react";

const PASSED = 16;
const FAILED = 1;

export function TestBarReadOnce() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    const css = getComputedStyle(document.documentElement);
    const color = (name: string) => css.getPropertyValue(`--${name}`);
    const width = context.canvas.width / (PASSED + FAILED);
    context.fillStyle = color("terminal-background");
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);
    for (let test = 0; test < PASSED + FAILED; test++) {
      context.fillStyle =
        test < PASSED ? color("ansi-green") : color("ansi-red");
      context.fillRect(test * width + 1, 4, width - 2, 16);
    }
  }, []);
  return (
    <figure className="grid gap-2">
      <canvas
        ref={canvas}
        width={340}
        height={24}
        aria-hidden
        className="h-6 w-full rounded-md"
      />
      <figcaption className="text-sm">
        {PASSED} passed, {FAILED} failed
      </figcaption>
    </figure>
  );
}

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(join(import.meta.dirname, "..", path), "utf8");

it("resets every motion variable tw-animate-css's enter and exit read", () => {
  // A tw-animate-css release that draws with a new variable would slide or
  // zoom again under reduced motion with nothing else failing.
  const animate = read("node_modules/tw-animate-css/dist/tw-animate.css");
  const keyframes = animate.match(/@keyframes (enter|exit)\s*\{[^@]*/g) ?? [];
  expect(keyframes).toHaveLength(2);
  const used = new Set(
    keyframes.flatMap((k) =>
      [...k.matchAll(/var\((--tw-(?:enter|exit)-[\w-]+)/g)].map((m) => m[1]),
    ),
  );
  const motion = [...used].filter((v) => !v.endsWith("-opacity")).sort();
  expect(motion.length).toBeGreaterThan(0);

  const styles = read("styles.css");
  const block = styles.slice(
    styles.indexOf("@media (prefers-reduced-motion: reduce)"),
  );
  const reset = [...block.matchAll(/(--tw-[\w-]+):\s*initial !important;/g)]
    .map((m) => m[1])
    .sort();
  expect(reset).toEqual(motion);
});

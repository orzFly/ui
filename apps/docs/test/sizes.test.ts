import { describe, expect, it } from "vitest";
import {
  classes,
  css,
  font,
  gap,
  hit,
  minWidth,
  ms,
  px,
  touch,
} from "../src/sizes.ts";

describe("sizes", () => {
  it("reads a height from h-*, size-*, or the line and its padding", () => {
    expect(px("h-8 touch:h-10")).toBe(32);
    expect(px("size-4")).toBe(16);
    expect(px("py-1.5 text-sm")).toBe(32);
    expect(px("border py-1 text-xs")).toBe(26);
    expect(px("h-[18px]")).toBe(18);
  });

  it("applies touch: and data-[size=…]: only where they match", () => {
    const trigger =
      "data-[size=default]:h-8 touch:data-[size=default]:h-10 data-[size=sm]:h-7";
    expect(px(trigger)).toBe(32);
    expect(px(trigger, { size: "sm" })).toBe(28);
    expect(touch(trigger)).toBe(40);
    expect(touch(trigger, { size: "sm" })).toBe("unchanged");
    expect(px("hover:h-12 h-8")).toBe(32);
  });

  it("grows a hit area to the utility's minimum on a coarse pointer only", () => {
    expect(hit("size-4 touch:hit-area")).toBe(css.hitArea);
    expect(hit("size-4")).toBe(16);
    expect(hit("h-12 touch:hit-area")).toBe(48);
  });

  it("reads font size, gap, duration and a breakpoint", () => {
    expect(font("text-base md:text-sm")).toBe(14);
    expect(
      font("text-base md:text-sm touch:text-base", { pointer: "coarse" }),
    ).toBe(16);
    expect(gap("grid gap-3 touch:gap-7", { pointer: "coarse" })).toBe(28);
    expect(ms("animate-in duration-200")).toBe(200);
    expect(ms("data-open:animate-in fade-in-0")).toBe(
      css.animateDefault * 1000,
    );
    expect(() => ms("flex")).toThrow();
    expect(minWidth("(min-width: 768px)")).toBe(768);
  });

  it("finds every part's classes in @orz/ui's source", () => {
    for (const [part, text] of Object.entries(classes)) {
      expect(text, part).toMatch(/\S+ \S+/);
    }
  });
});

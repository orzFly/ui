import { describe, expect, it } from "vitest";
import {
  button,
  classes,
  coarse,
  css,
  font,
  gap,
  hit,
  leastWidth,
  minWidth,
  ms,
  px,
  touch,
  touchSpacing,
} from "../src/sizes.ts";

describe("sizes", () => {
  it("reads a height from h-*, size-*, or the line and its padding", () => {
    expect(px("h-8 touch:h-field-touch")).toBe(32);
    expect(px("size-4")).toBe(16);
    expect(px("py-1.5 text-sm")).toBe(32);
    expect(px("border py-1 text-xs")).toBe(26);
    expect(px("h-[18px]")).toBe(18);
  });

  it("applies touch: and data-[size=…]: only where they match", () => {
    const trigger =
      "data-[size=default]:h-7 touch:data-[size=default]:h-field-touch data-[size=sm]:h-6";
    expect(px(trigger)).toBe(28);
    expect(px(trigger, { size: "sm" })).toBe(24);
    expect(touch(trigger)).toBe(32);
    expect(touch(trigger, { size: "sm" })).toBe("unchanged");
    expect(px("hover:h-12 h-8")).toBe(32);
  });

  it("reads the touch tokens, those theme.css works out from others included", () => {
    expect(touchSpacing).toBe(36);
    expect(px("min-h-row touch:min-h-touch", coarse)).toBe(36);
    // max(control, 2rem): the default style's 28px control is shorter.
    expect(px("h-control touch:h-field-touch", coarse)).toBe(32);
    expect(px("touch:h-hit-xs", coarse)).toBe((36 - 22) / 2);
    expect(leastWidth(button("xs"), coarse)).toBe(36);
    expect(() => leastWidth(button("xs"))).toThrow();
  });

  it("grows a hit area to the touch spacing on a coarse pointer only", () => {
    expect(hit("size-4 touch:hit-area")).toBe(touchSpacing);
    expect(hit("size-4")).toBe(16);
    expect(hit("h-12 touch:hit-area")).toBe(48);
  });

  it("reads font size, gap, duration and a breakpoint", () => {
    expect(font("text-base md:text-sm")).toBe(14);
    expect(
      font("text-base md:text-sm touch:text-base", { pointer: "coarse" }),
    ).toBe(16);
    expect(
      gap("grid gap-3 touch:gap-[calc(var(--spacing-touch)-1rem)]", coarse),
    ).toBe(20);
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

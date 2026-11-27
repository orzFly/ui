import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Avatar, AvatarFallback } from "../src/components/avatar.tsx";

/** Reports the widths a test names, as the first callback of a real one would. */
class ReportingResizeObserver {
  static last: ReportingResizeObserver | undefined;
  readonly targets: Element[] = [];
  private readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ReportingResizeObserver.last = this;
  }
  observe(target: Element) {
    this.targets.push(target);
  }
  unobserve() {}
  disconnect() {}
  report(widths: [Element, number][]) {
    this.callback(
      widths.map(([target, width]) => ({
        target,
        contentRect: { width } as DOMRectReadOnly,
      })) as unknown as ResizeObserverEntry[],
      this as unknown as ResizeObserver,
    );
  }
}

function renderFallback(text: string) {
  vi.stubGlobal("ResizeObserver", ReportingResizeObserver);
  const { container } = render(
    <Avatar>
      <AvatarFallback>{text}</AvatarFallback>
    </Avatar>,
  );
  const box = container.querySelector<HTMLElement>(
    '[data-slot="avatar-fallback"]',
  );
  const glyph = container.querySelector<HTMLElement>(
    '[data-slot="avatar-fallback-glyph"]',
  );
  const observer = ReportingResizeObserver.last;
  if (!box || !glyph || !observer) throw new Error("no fallback measured");
  return { box, glyph, observer };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AvatarFallback", () => {
  it("scales letters wider than the box down to fit it", () => {
    const { box, glyph, observer } = renderFallback("WWW");
    expect(observer.targets).toEqual([glyph, box]);
    observer.report([
      [glyph, 40],
      [box, 32],
    ]);
    expect(Number(glyph.style.scale)).toBeCloseTo((32 * 0.84) / 40);
  });

  it("leaves letters that fit at their size", () => {
    const { box, glyph, observer } = renderFallback("AL");
    observer.report([
      [glyph, 18],
      [box, 32],
    ]);
    expect(glyph.style.scale).toBe("");
  });

  it("measures again when the letters change width, as a web font lands", () => {
    const { box, glyph, observer } = renderFallback("KGM");
    observer.report([
      [glyph, 30],
      [box, 32],
    ]);
    expect(glyph.style.scale).not.toBe("");
    observer.report([[glyph, 26]]);
    expect(glyph.style.scale).toBe("");
  });

  it("keeps the letters out of flow, so a selection across them copies no line break", () => {
    const { box, glyph } = renderFallback("AL");
    expect(box.className).toMatch(/(^| )absolute( |$)/);
    expect(glyph.className).toMatch(/(^| )absolute( |$)/);
    expect(glyph.textContent).toBe("AL");
  });
});

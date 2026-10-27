// @vitest-environment happy-dom
import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Window as HappyWindow } from "happy-dom";
import { act, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LogViewer } from "../src/demos/log-viewer/log-viewer.tsx";

// The asciinema player needs canvas and WASM, which happy-dom has neither of;
// left loading, the recording draws its frame and nothing more.
vi.mock("../../../packages/ui-asciinema/src/load-player.ts", () => ({
  loadPlayer: () => new Promise(() => {}),
}));

/** Every page under content/demos/, by its file name, and the component it shows. */
const DEMOS: Record<string, ComponentType> = {
  "log-viewer": LogViewer,
};

const WIDTHS = { desktop: 1280, phone: 390 };

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let unmount = () => {};
afterEach(() => unmount());

async function draw(Demo: ComponentType, width: number) {
  (window as unknown as HappyWindow).happyDOM.setViewport({
    width,
    height: 900,
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<Demo />));
  unmount = () => {
    act(() => root.unmount());
    container.remove();
  };
  return container;
}

/** Shows each tab in turn, the way a reader would, and waits out what it loads. */
async function visitTabs(container: HTMLElement) {
  const tabs = [...container.querySelectorAll<HTMLElement>("[role=tab]")];
  for (const tab of tabs) {
    await act(async () => {
      tab.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, button: 0 }),
      );
      tab.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      tab.click();
    });
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(tab.getAttribute("aria-selected"), tab.textContent ?? "").toBe(
      "true",
    );
  }
  return tabs.length;
}

describe("demos", () => {
  it("has a component under test for every demo page", () => {
    const pages = readdirSync(join(import.meta.dirname, "../src/content/demos"))
      .filter((file) => file.endsWith(".mdx") && file !== "index.mdx")
      .map((file) => file.replace(/\.mdx$/, ""));
    expect(Object.keys(DEMOS).sort()).toEqual(pages.sort());
  });

  for (const [name, Demo] of Object.entries(DEMOS)) {
    for (const [label, width] of Object.entries(WIDTHS)) {
      it(`${name} renders every tab at a ${label} width`, async () => {
        const container = await draw(Demo, width);
        expect(container.textContent).not.toBe("");
        await visitTabs(container);
      });
    }
  }
});

describe("log-viewer", () => {
  it("opens on the failed job's log, drawn by the log renderer", async () => {
    const container = await draw(LogViewer, WIDTHS.desktop);
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    const current = container.querySelector(
      "nav[aria-label=Jobs] [aria-current]",
    );
    expect(current?.textContent).toContain("Test");
    expect(container.textContent).toContain("test.log");
  });
});

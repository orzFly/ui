// @vitest-environment happy-dom
import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Window as HappyWindow } from "happy-dom";
import { act, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LogViewer } from "../src/demos/log-viewer/log-viewer.tsx";
import { Settings } from "../src/demos/settings/settings.tsx";

// The asciinema player needs canvas and WASM, which happy-dom has neither of;
// left loading, the recording draws its frame and nothing more.
vi.mock("../../../packages/ui-asciinema/src/load-player.ts", () => ({
  loadPlayer: () => new Promise(() => {}),
}));

/** Every page under content/demos/, by its file name, and the component it shows. */
const DEMOS: Record<string, ComponentType> = {
  "log-viewer": LogViewer,
  settings: Settings,
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

describe("settings", () => {
  const section = (container: HTMLElement, name: string) =>
    [
      ...container.querySelectorAll<HTMLElement>(
        "nav[aria-label=Settings] button",
      ),
    ].find((button) => button.textContent === name);
  const click = (element: HTMLElement | null | undefined) =>
    act(async () => element?.click());
  const dialog = () => document.querySelector<HTMLElement>("[role=dialog]");
  const button = (root: ParentNode, name: string) =>
    [...root.querySelectorAll<HTMLElement>("button")].find(
      (each) => each.textContent === name,
    );
  const type = (input: HTMLInputElement, value: string) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

  it("visits every section at a desktop and a phone width", async () => {
    for (const width of Object.values(WIDTHS)) {
      const container = await draw(Settings, width);
      const names = [
        ...container.querySelectorAll("nav[aria-label=Settings] button"),
      ].map((each) => each.textContent ?? "");
      expect(names).toHaveLength(5);
      for (const name of names) {
        await click(section(container, name));
        expect(
          container.querySelector("#settings-section-title")?.textContent,
        ).toBe(name);
      }
      unmount();
    }
  });

  it("asks before leaving the profile with unsaved edits", async () => {
    const container = await draw(Settings, WIDTHS.desktop);
    await click(section(container, "Profile"));
    const name = container.querySelector<HTMLInputElement>("#settings-name");
    if (!name) throw new Error("no name field");
    await type(name, "alice2");

    await click(section(container, "Editor"));
    expect(dialog()?.textContent).toContain("Leave with unsaved changes?");
    await click(button(dialog() ?? document, "Keep editing"));
    expect(dialog()).toBeNull();
    expect(
      container.querySelector<HTMLInputElement>("#settings-name")?.value,
    ).toBe("alice2");

    await click(section(container, "Editor"));
    await click(button(dialog() ?? document, "Discard and leave"));
    expect(
      container.querySelector("#settings-section-title")?.textContent,
    ).toBe("Editor");
    await click(section(container, "Profile"));
    expect(
      container.querySelector<HTMLInputElement>("#settings-name")?.value,
    ).toBe("alice");
  });

  it("leaves a saved profile without asking", async () => {
    const container = await draw(Settings, WIDTHS.desktop);
    await click(section(container, "Profile"));
    const name = container.querySelector<HTMLInputElement>("#settings-name");
    if (!name) throw new Error("no name field");
    await type(name, "alice2");
    await click(button(container, "Save profile"));
    await click(section(container, "Editor"));
    expect(dialog()).toBeNull();
    expect(
      container.querySelector("#settings-section-title")?.textContent,
    ).toBe("Editor");
  });

  it("revokes a token only once the confirmation is accepted", async () => {
    const container = await draw(Settings, WIDTHS.desktop);
    await click(section(container, "Access tokens"));
    const revoke = () =>
      container.querySelector<HTMLElement>("[aria-label='Revoke ci-runner']");
    await click(revoke());
    expect(dialog()?.textContent).toContain("Revoke the token for ci-runner?");
    await click(button(dialog() ?? document, "Cancel"));
    expect(revoke()).not.toBeNull();
    await click(revoke());
    await click(button(dialog() ?? document, "Revoke"));
    expect(revoke()).toBeNull();
  });
});

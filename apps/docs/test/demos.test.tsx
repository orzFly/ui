// @vitest-environment happy-dom
import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Window as HappyWindow } from "happy-dom";
import { act, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Inbox } from "../src/demos/inbox/inbox.tsx";
import { LATENCY_MS, PAGE_SIZE } from "../src/demos/inbox/mailbox.ts";
import { tagsOf, titleOf } from "../src/demos/notes/notebook.ts";
import { Notes } from "../src/demos/notes/notes.tsx";
import { PullRequest } from "../src/demos/pull-request/pull-request.tsx";
import { Settings } from "../src/demos/settings/settings.tsx";

// The asciinema player needs canvas and WASM, which happy-dom has neither of;
// left loading, the recording draws its frame and nothing more.
vi.mock("../../../packages/ui-asciinema/src/load-player.ts", () => ({
  loadPlayer: () => new Promise(() => {}),
}));

// mermaid lays a diagram out by measuring text, which happy-dom cannot; any source draws as one
// fixed picture here.
vi.mock(
  "../../../packages/ui-mermaid/src/render.ts",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    renderDiagram: async () => ({
      ok: true,
      svg: '<svg data-testid="diagram"></svg>',
      width: 100,
    }),
  }),
);

/** Every page under content/demos/, by its file name, and the component it shows. */
const DEMOS: Record<string, ComponentType> = {
  inbox: Inbox,
  notes: Notes,
  "pull-request": PullRequest,
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

describe("pull-request", () => {
  const click = (element: HTMLElement | null | undefined) =>
    act(async () => element?.click());
  const wait = () =>
    act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  const button = (root: ParentNode, name: string) =>
    [...root.querySelectorAll<HTMLElement>("button")].find(
      (each) => each.textContent === name,
    );
  const selectedTab = (container: HTMLElement) =>
    container.querySelector("[role=tab][aria-selected=true]")?.textContent;

  it("opens on the conversation, and a check's Details opens its log", async () => {
    const container = await draw(PullRequest, WIDTHS.desktop);
    expect(selectedTab(container)).toContain("Conversation");
    expect(container.textContent).toContain("Some checks were not successful");
    await click(
      container.querySelector<HTMLElement>("[aria-label='Details for Build']"),
    );
    await wait();
    expect(selectedTab(container)).toContain("Checks");
    expect(
      container.querySelector("ul[aria-label=Jobs] [aria-current]")
        ?.textContent,
    ).toContain("Build");
    expect(container.textContent).toContain("build.log");
  });

  it("adds a posted comment to the timeline", async () => {
    const container = await draw(PullRequest, WIDTHS.desktop);
    const comments = () =>
      container.querySelectorAll("ol[aria-label=Timeline] article").length;
    const before = comments();
    const form = container.querySelector<HTMLFormElement>(
      "form[aria-label=Comment]",
    );
    const editor = form?.querySelector<HTMLElement>(".cm-content");
    if (!form || !editor) throw new Error("no comment box");
    await act(async () => {
      editor.textContent = "Looks good once the test is green.";
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    await act(async () => form.requestSubmit());
    expect(comments()).toBe(before + 1);
    expect(container.textContent).toContain(
      "Looks good once the test is green.",
    );
  });

  it("says which repository tabs are not in the demo, and leads back", async () => {
    const container = await draw(PullRequest, WIDTHS.phone);
    await click(button(container, "Issues4"));
    expect(container.textContent).toContain("Issues is not part of this demo");
    await click(button(container, "Open pull request #12"));
    expect(selectedTab(container)).toContain("Conversation");
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

describe("inbox", () => {
  afterEach(() => history.replaceState(null, "", "/demos/inbox/"));

  const rows = (container: HTMLElement) => [
    ...container.querySelectorAll<HTMLAnchorElement>(
      "ul[aria-label=Conversations] a",
    ),
  ];
  const wait = (ms: number) =>
    act(() => new Promise((resolve) => setTimeout(resolve, ms)));

  async function searchFor(container: HTMLElement, query: string) {
    const input = container.querySelector<HTMLInputElement>(
      "input[aria-label='Search mail']",
    );
    if (!input) throw new Error("no search box");
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(input, query);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => input.form?.requestSubmit());
  }

  it("lists a page, and the next one after a round trip", async () => {
    const container = await draw(Inbox, WIDTHS.desktop);
    expect(rows(container)).toHaveLength(PAGE_SIZE);
    const more = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Load more",
    );
    await act(async () => more?.click());
    expect(container.textContent).toContain("Loading…");
    await wait(LATENCY_MS + 50);
    expect(rows(container)).toHaveLength(PAGE_SIZE * 2);
  });

  it("filters by the query, and says so when nothing matches", async () => {
    const container = await draw(Inbox, WIDTHS.desktop);
    await searchFor(container, "is:starred label:design");
    expect(rows(container).map((row) => row.textContent)).toEqual([
      expect.stringContaining("Touch sizes for the toolbar icons"),
      expect.stringContaining("Contrast audit results"),
    ]);
    await searchFor(container, "nothing-has-this-word");
    expect(rows(container)).toHaveLength(0);
    expect(container.textContent).toContain("No conversations match");
  });

  it("opens a thread in the URL, marks it read, and goes back to the list", async () => {
    const container = await draw(Inbox, WIDTHS.phone);
    const list = container.querySelector("section[aria-label=Inbox]");
    const row = rows(container)[0];
    expect(row?.textContent).toContain("Unread");
    await act(async () => row?.click());
    expect(location.search).toBe("?thread=touch-sizes");
    expect(container.querySelector("#inbox-subject")?.textContent).toBe(
      "Touch sizes for the toolbar icons",
    );
    // On a phone the thread takes the list's place.
    expect(list?.className).toContain("max-md:hidden");
    expect(rows(container)[0]?.textContent).not.toContain("Unread");
    expect(container.querySelector("form[aria-label=Reply]")).not.toBeNull();

    const back = container.querySelector<HTMLButtonElement>(
      "button[aria-label='Back to inbox']",
    );
    await act(async () => back?.click());
    await wait(50);
    expect(location.search).toBe("");
    expect(container.querySelector("#inbox-subject")).toBeNull();
    expect(list?.className).not.toContain("max-md:hidden");
  });
});

describe("notes", () => {
  const rows = (container: HTMLElement) =>
    [
      ...container.querySelectorAll<HTMLButtonElement>(
        "nav[aria-label=Notebook] li button",
      ),
    ].map((row) => row.querySelector("span")?.textContent);
  const button = (container: HTMLElement, name: string) =>
    [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (each) => each.textContent === name,
    );
  const note = (container: HTMLElement, title: string) =>
    [
      ...container.querySelectorAll<HTMLButtonElement>(
        "nav[aria-label=Notebook] li button",
      ),
    ].find((row) => row.querySelector("span")?.textContent === title);
  const click = (element: HTMLElement | null | undefined) =>
    act(async () => {
      if (!element) throw new Error("nothing to click");
      element.click();
    });
  const settle = () =>
    act(() => new Promise((resolve) => setTimeout(resolve, 50)));

  it("titles a note by its first heading, and tags it by its #words outside code", () => {
    const body = [
      "Intro line",
      "## Plan #not-a-title",
      "Talks about #ci and #Design, see [x](page#anchor).",
      "`#inline` and",
      "```",
      "#fenced",
      "```",
    ].join("\n");
    expect(titleOf(body)).toBe("Plan #not-a-title");
    expect(titleOf("\n  First words\n")).toBe("First words");
    expect(titleOf("")).toBe("Untitled");
    expect(titleOf("```mermaid\n# not a title\n```\nAfter")).toBe("After");
    expect(tagsOf(body)).toEqual(["not-a-title", "ci", "design"]);
  });

  it("narrows the list by tag and by words, and clears both at once", async () => {
    const container = await draw(Notes, WIDTHS.desktop);
    expect(rows(container)).toHaveLength(7);
    await click(button(container, "#ci3"));
    expect(rows(container)).toEqual(["Job states", "Oct 28", "Oct 24"]);

    const filter = container.querySelector<HTMLInputElement>(
      "input[aria-label='Filter notes']",
    );
    if (!filter) throw new Error("no filter");
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(filter, "nothing-has-this-word");
      filter.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.textContent).toContain("No notes match");
    await click(button(container, "Clear filter"));
    expect(rows(container)).toHaveLength(7);
  });

  it("draws a mermaid fence in the preview as a diagram", async () => {
    const container = await draw(Notes, WIDTHS.desktop);
    await settle();
    const preview = container.querySelector("section[aria-label=Preview]");
    expect(container.querySelector("#note-title")?.textContent).toBe(
      "Retry design",
    );
    expect(preview?.querySelector("[data-testid=diagram]")).not.toBeNull();
    expect(preview?.querySelector("table")).not.toBeNull();
  });

  it("starts a new note in the editor, in the open note's folder", async () => {
    const container = await draw(Notes, WIDTHS.desktop);
    await click(note(container, "Job states"));
    expect(container.querySelector("#note-title")?.textContent).toBe(
      "Job states",
    );
    await click(button(container, "#ci3"));
    await click(button(container, "New note"));
    expect(container.querySelector("#note-title")?.textContent).toBe(
      "Untitled",
    );
    // The filter is cleared, so the new note can be seen in the list.
    expect(rows(container)).toHaveLength(8);
    const projects = container.querySelector(
      "#notes-folder-Projects",
    )?.parentElement;
    expect(projects?.textContent).toContain("Untitled");
    expect(
      container.querySelector("section[aria-label=Markdown] .cm-editor"),
    ).not.toBeNull();
  });

  it("on a phone, opens a note to read it, and writes only when asked", async () => {
    const container = await draw(Notes, WIDTHS.phone);
    const list = container.querySelector("nav[aria-label=Notebook]");
    const editor = () =>
      container.querySelector("section[aria-label=Markdown]")?.className;
    await click(note(container, "Sync, Oct 27"));
    expect(list?.className).toContain("max-md:hidden");
    expect(editor()).toContain("max-lg:hidden");

    const edit = container.querySelector<HTMLElement>(
      "fieldset[aria-label=View].lg\\:hidden button",
    );
    expect(edit?.textContent).toBe("Edit");
    await click(edit);
    expect(editor()).not.toContain("max-lg:hidden");

    await click(
      container.querySelector<HTMLElement>(
        "button[aria-label='Back to notes']",
      ),
    );
    expect(list?.className).not.toContain("max-md:hidden");
  });
});

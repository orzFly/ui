// @vitest-environment happy-dom
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { EditorView } from "@codemirror/view";
import { Toaster } from "@orz/ui/components/sonner";
import type { Window as HappyWindow } from "happy-dom";
import { act, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { toast } from "sonner";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { BinaryInspector } from "../src/demos/binary-inspector/binary-inspector.tsx";
import { ConfigEditor } from "../src/demos/config-editor/config-editor.tsx";
import { Inbox } from "../src/demos/inbox/inbox.tsx";
import { LATENCY_MS, PAGE_SIZE } from "../src/demos/inbox/mailbox.ts";
import { tagsOf, titleOf } from "../src/demos/notes/notebook.ts";
import { Notes } from "../src/demos/notes/notes.tsx";
import { PullRequest } from "../src/demos/pull-request/pull-request.tsx";
import { Settings } from "../src/demos/settings/settings.tsx";
import { LATENCY_MS as TASKS_LATENCY_MS } from "../src/demos/tasks/board.ts";
import { Tasks } from "../src/demos/tasks/tasks.tsx";

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
  "binary-inspector": BinaryInspector,
  "config-editor": ConfigEditor,
  inbox: Inbox,
  notes: Notes,
  "pull-request": PullRequest,
  settings: Settings,
  tasks: Tasks,
};

const WIDTHS = { desktop: 1280, phone: 390 };

// No server answers a fixture's asset URL here; the file is read from disk instead.
const realFetch = globalThis.fetch;
vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (!url.includes("/attachment/")) return realFetch(input, init);
  const name = basename(new URL(url, "http://localhost/").pathname);
  return Promise.resolve(
    new Response(
      readFileSync(
        join(import.meta.dirname, "../../fixtures/src/attachment", name),
      ),
    ),
  );
});

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
  // The site mounts one Toaster for every page; the demo's toasts need it here too.
  let toaster: Root;
  beforeAll(async () => {
    const host = document.createElement("div");
    document.body.append(host);
    toaster = createRoot(host);
    await act(async () => toaster.render(<Toaster />));
  });
  afterAll(() => act(() => toaster.unmount()));
  // Only the newest few toasts are drawn, so each test starts with none.
  beforeEach(() => act(() => toast.dismiss()));
  afterEach(() => {
    history.replaceState(null, "", "/demos/inbox/");
    localStorage.clear();
  });

  const rows = (container: HTMLElement) => [
    ...container.querySelectorAll<HTMLAnchorElement>(
      "ul[aria-label=Conversations] a",
    ),
  ];
  const subjects = (container: HTMLElement) =>
    rows(container).map(
      (row) => row.querySelector("span:nth-of-type(4)")?.textContent,
    );
  const wait = (ms: number) =>
    act(() => new Promise((resolve) => setTimeout(resolve, ms)));
  const click = (element: Element | null | undefined) =>
    act(async () => (element as HTMLElement | null)?.click());
  const labelled = (root: ParentNode, label: string) =>
    root.querySelector<HTMLElement>(`[aria-label='${label}']`);
  const press = (key: string) =>
    act(async () => {
      (document.activeElement ?? document.body).dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true }),
      );
    });
  const type = (input: HTMLInputElement | null, value: string) =>
    act(async () => {
      if (!input) throw new Error("no field");
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

  async function searchFor(container: HTMLElement, query: string) {
    const input = container.querySelector<HTMLInputElement>(
      "input[aria-label='Search mail']",
    );
    await type(input, query);
    await act(async () => input?.form?.requestSubmit());
  }

  /** Clicks a place in the wide screen's sidebar. */
  const showPlace = (container: HTMLElement, title: string) =>
    click(
      [
        ...container.querySelectorAll(
          "aside[data-width=wide] nav[aria-label=Folders] a",
        ),
      ].find((link) => link.textContent?.startsWith(title)),
    );

  const undo = () =>
    click(
      [...document.querySelectorAll("button")].findLast(
        (button) => button.textContent === "Undo",
      ),
    );

  it("lists a page of the inbox, and the next one after a round trip", async () => {
    const container = await draw(Inbox, WIDTHS.desktop);
    expect(rows(container)).toHaveLength(PAGE_SIZE);
    // A draft and a message nobody answered are filed elsewhere.
    expect(subjects(container)).not.toContain("Notes for the retry write-up");
    expect(subjects(container)).not.toContain(
      "Agenda for Thursday's design review",
    );
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
    expect(new URLSearchParams(location.search).get("q")).toBe(
      "is:starred label:design",
    );
    expect(subjects(container)).toEqual([
      "Touch sizes for the toolbar icons",
      "Contrast audit results",
    ]);
    await searchFor(container, "nothing-has-this-word");
    expect(rows(container)).toHaveLength(0);
    expect(container.textContent).toContain("No conversations match");
  });

  it("shows each folder as its search, and Back returns to the last", async () => {
    const container = await draw(Inbox, WIDTHS.desktop);
    await showPlace(container, "Sent");
    expect(new URLSearchParams(location.search).get("q")).toBe("in:sent");
    expect(
      container.querySelector<HTMLInputElement>(
        "input[aria-label='Search mail']",
      )?.value,
    ).toBe("in:sent");
    expect(subjects(container)).toContain(
      "Agenda for Thursday's design review",
    );

    await showPlace(container, "Drafts");
    expect(subjects(container)).toEqual(["Notes for the retry write-up"]);

    await act(async () => history.back());
    await wait(50);
    expect(new URLSearchParams(location.search).get("q")).toBe("in:sent");
    expect(subjects(container)).toContain(
      "Agenda for Thursday's design review",
    );
  });

  it("opens a thread in the URL, marks it read, and goes back to the list", async () => {
    const container = await draw(Inbox, WIDTHS.phone);
    const list = container.querySelector("section[aria-label='Mail list']");
    const row = rows(container)[0];
    expect(row?.textContent).toContain("Unread");
    await click(row);
    expect(location.search).toBe("?thread=touch-sizes");
    expect(container.querySelector("#inbox-subject")?.textContent).toBe(
      "Touch sizes for the toolbar icons",
    );
    // On a phone the thread takes the list's place.
    expect(list?.className).toContain("max-md:hidden");
    expect(rows(container)[0]?.textContent).not.toContain("Unread");
    expect(container.querySelector("form[aria-label=Reply]")).not.toBeNull();

    await click(labelled(container, "Back to inbox"));
    await wait(50);
    expect(location.search).toBe("");
    expect(container.querySelector("#inbox-subject")).toBeNull();
    expect(list?.className).not.toContain("max-md:hidden");
  });

  it("archives the open thread, and Undo puts it back", async () => {
    const container = await draw(Inbox, WIDTHS.desktop);
    await click(rows(container)[0]);
    await click(
      labelled(container.querySelector("article") ?? container, "Archive"),
    );
    await wait(50);
    expect(container.querySelector("#inbox-subject")).toBeNull();
    expect(subjects(container)).not.toContain(
      "Touch sizes for the toolbar icons",
    );
    expect(document.body.textContent).toContain("Conversation archived");
    await undo();
    expect(subjects(container)[0]).toBe("Touch sizes for the toolbar icons");

    await showPlace(container, "Archive");
    expect(subjects(container)).not.toContain(
      "Touch sizes for the toolbar icons",
    );
  });

  it("selects with a long press on a touch screen, then with a tap", async () => {
    const container = await draw(Inbox, WIDTHS.phone);
    const touch = (row: Element | undefined, type: string) =>
      row?.dispatchEvent(
        new PointerEvent(type, { bubbles: true, pointerType: "touch" }),
      );
    const [first, second] = rows(container);
    await act(async () => touch(first, "pointerdown"));
    await wait(500);
    await act(async () => touch(first, "pointerup"));
    await click(first);
    expect(container.textContent).toContain("1 selected");
    expect(location.search).toBe("");

    await act(async () => touch(second, "pointerdown"));
    await act(async () => touch(second, "pointerup"));
    await click(second);
    expect(container.textContent).toContain("2 selected");
    expect(location.search).toBe("");
  });

  it("acts on the selected threads at once", async () => {
    const container = await draw(Inbox, WIDTHS.desktop);
    const boxes = [
      ...container.querySelectorAll<HTMLElement>(
        "ul[aria-label=Conversations] [role=checkbox]",
      ),
    ];
    await click(boxes[1]);
    await click(boxes[2]);
    expect(container.textContent).toContain("2 selected");
    await click(labelled(container, "Delete"));
    expect(document.body.textContent).toContain(
      "2 conversations moved to Trash",
    );
    expect(rows(container)).toHaveLength(PAGE_SIZE - 2);
    await showPlace(container, "Trash");
    expect(subjects(container)).toEqual(
      expect.arrayContaining([
        "Release 0.9.0: changelog draft",
        "Flaky test: retry-once times out on the slow runner",
      ]),
    );
  });

  it("keeps a closed message as a draft, and files a sent one under Sent", async () => {
    const container = await draw(Inbox, WIDTHS.desktop);
    await click(
      [...container.querySelectorAll("button")].find(
        (button) => button.textContent === "Compose",
      ),
    );
    await type(
      container.querySelector<HTMLInputElement>("#compose-subject"),
      "Lunch on Friday",
    );
    const sendButton = () =>
      container.querySelector(
        "form[aria-label='New message'] button[type=submit]",
      );
    // Without a recipient it says so, and sends nothing.
    await click(sendButton());
    expect(container.textContent).toContain("Add at least one recipient.");

    await click(
      container.querySelector(
        "[data-compose-controls] [aria-label='Close and keep as a draft']",
      ),
    );
    expect(container.querySelector("#compose-subject")).toBeNull();
    expect(document.body.textContent).toContain("Saved to Drafts");
    await showPlace(container, "Drafts");
    expect(subjects(container)).toContain("Lunch on Friday");

    await click(rows(container)[0]);
    expect(
      container.querySelector<HTMLInputElement>("#compose-subject")?.value,
    ).toBe("Lunch on Friday");
    await type(
      container.querySelector<HTMLInputElement>("#compose-to"),
      "alice",
    );
    await click(sendButton());
    expect(document.body.textContent).toContain("Message sent");
    expect(subjects(container)).not.toContain("Lunch on Friday");
    await showPlace(container, "Sent");
    expect(subjects(container)[0]).toBe("Lunch on Friday");
  });

  it("walks and archives with single keys, and binds none once they are off", async () => {
    const container = await draw(Inbox, WIDTHS.desktop);
    await press("j");
    expect(document.activeElement).toBe(rows(container)[0]);
    await press("j");
    expect(document.activeElement).toBe(rows(container)[1]);
    await press("e");
    expect(subjects(container)).not.toContain("Release 0.9.0: changelog draft");

    await press("?");
    expect(document.querySelector("[role=dialog]")?.textContent).toContain(
      "Keyboard shortcuts",
    );
    await click(document.querySelector("#mail-character-keys"));
    await click(
      [...document.querySelectorAll("[role=dialog] button")].find(
        (button) => button.textContent === "Close",
      ),
    );
    const before = subjects(container);
    rows(container)[0]?.focus();
    await press("e");
    expect(subjects(container)).toEqual(before);
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

describe("binary-inspector", () => {
  const wait = (ms = 50) =>
    act(() => new Promise((resolve) => setTimeout(resolve, ms)));
  const click = (element: Element | null | undefined) =>
    act(async () => {
      if (!element) throw new Error("nothing to click");
      (element as HTMLElement).click();
    });
  const region = (container: HTMLElement, label: string) =>
    [
      ...container.querySelectorAll<HTMLElement>(
        "nav[aria-label=Structure] button",
      ),
    ].find((button) => button.firstElementChild?.textContent === label);
  const button = (root: ParentNode, name: string) =>
    [...root.querySelectorAll<HTMLElement>("button")].find(
      (each) => each.textContent === name,
    );
  const dialog = () => document.querySelector<HTMLElement>("[role=dialog]");
  const status = (container: HTMLElement) =>
    container.querySelector("footer p")?.textContent;
  const inspector = (container: HTMLElement) =>
    container.querySelector("aside[aria-label=Inspector]")?.textContent;

  async function open(width = WIDTHS.desktop) {
    const container = await draw(BinaryInspector, width);
    await wait();
    await wait();
    return container;
  }

  async function type(container: HTMLElement, key: string) {
    const editor = container.querySelector<HTMLElement>(
      "[aria-label='Bytes of gradient.png']",
    );
    if (!editor) throw new Error("no editor");
    await act(async () => {
      editor.focus();
      editor.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true }),
      );
    });
  }

  it("lists the sample's chunks, and selects the bytes of the one clicked", async () => {
    const container = await open();
    expect(
      container
        .querySelector("nav[aria-label=Structure] ul")
        ?.getAttribute("aria-label"),
    ).toBe("PNG image");
    expect(region(container, "Width")).toBeUndefined();

    await click(region(container, "IHDR"));
    expect(region(container, "IHDR")?.getAttribute("aria-current")).toBe(
      "location",
    );
    // The chunk opens to its fields while the selection is inside it.
    expect(region(container, "Width")).not.toBeUndefined();
    expect(inspector(container)).toContain("Offset 0x8 · 25 bytes");
    // A PNG writes its numbers big-endian, and the inspector reads them so.
    expect(
      container
        .querySelector("aside[aria-label=Inspector] [role=switch]")
        ?.getAttribute("aria-checked"),
    ).toBe("false");

    await click(region(container, "Width"));
    expect(inspector(container)).toContain("Offset 0x10 · 4 bytes");
    expect(inspector(container)).toContain("320");
  });

  it("counts an edit, and reverts it only once that is confirmed", async () => {
    const container = await open();
    expect(status(container)).toBe("Unmodified");
    await click(region(container, "Signature"));
    await type(container, "f");
    expect(status(container)).toBe("Modified · 1 byte written");

    await click(button(container, "Revert"));
    expect(dialog()?.textContent).toContain("Revert gradient.png?");
    await click(button(dialog() ?? document, "Cancel"));
    expect(status(container)).toBe("Modified · 1 byte written");

    await click(button(container, "Revert"));
    await click(button(dialog() ?? document, "Revert"));
    expect(status(container)).toBe("Unmodified");
  });

  it("asks before another file replaces unsaved edits", async () => {
    const container = await open();
    await click(region(container, "Signature"));
    await type(container, "0");
    const input = container.querySelector<HTMLInputElement>("input[type=file]");
    if (!input) throw new Error("no file input");
    const choose = (file: File) =>
      act(async () => {
        Object.defineProperty(input, "files", {
          value: [file],
          configurable: true,
        });
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });

    await choose(new File(["plain text"], "notes.txt"));
    expect(dialog()?.textContent).toContain("Leave with unsaved changes?");
    await click(button(dialog() ?? document, "Keep editing"));
    expect(
      container.querySelector("[aria-label='Bytes of gradient.png']"),
    ).not.toBeNull();

    await choose(new File(["plain text"], "notes.txt"));
    await click(button(dialog() ?? document, "Discard and leave"));
    await wait();
    expect(
      container.querySelector("[aria-label='Bytes of notes.txt']"),
    ).not.toBeNull();
    expect(container.textContent).toContain("Not a PNG or a ZIP");
    expect(status(container)).toBe("Unmodified");
  });

  it("on a phone, picks a region from a Select and reads it in a sheet", async () => {
    const container = await open(WIDTHS.phone);
    expect(
      container.querySelector("[aria-label='PNG image structure']"),
    ).not.toBeNull();
    await click(container.querySelector("button[aria-label=Inspector]"));
    expect(dialog()?.textContent).toContain("Little endian");
  });
});

describe("tasks", () => {
  // The site mounts one Toaster for every page; the demo's toasts need it here too.
  let toaster: Root;
  beforeAll(async () => {
    const host = document.createElement("div");
    document.body.append(host);
    toaster = createRoot(host);
    await act(async () => toaster.render(<Toaster />));
  });
  afterAll(() => act(() => toaster.unmount()));
  beforeEach(() => act(() => toast.dismiss()));
  afterEach(() => history.replaceState(null, "", "/demos/tasks/"));

  /** The task keys on screen, in order. */
  const keys = (container: HTMLElement) =>
    [...container.querySelectorAll<HTMLElement>("tr[data-task]")].map(
      (row) => `T-${row.dataset.task}`,
    );
  const row = (container: HTMLElement, key: string) =>
    container.querySelector<HTMLElement>(`tr[data-task='${key.slice(2)}']`);
  const wait = (ms: number) =>
    act(() => new Promise((resolve) => setTimeout(resolve, ms)));
  const click = (element: Element | null | undefined) =>
    act(async () => (element as HTMLElement | null)?.click());
  const button = (root: ParentNode, name: string) =>
    [...root.querySelectorAll<HTMLElement>("button")].find(
      (each) => each.textContent === name,
    );
  const dialog = () => document.querySelector<HTMLElement>("[role=dialog]");
  const select = (container: HTMLElement, key: string) =>
    click(row(container, key)?.querySelector("[role=checkbox]"));
  const type = (input: HTMLInputElement | null, value: string) =>
    act(async () => {
      if (!input) throw new Error("no field");
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  /** Opens a toolbar filter and picks a row of its menu. */
  async function pick(container: HTMLElement, name: string, option: string) {
    const trigger = [...container.querySelectorAll("button")].find((each) =>
      each.textContent?.startsWith(`${name}:`),
    );
    await click(trigger);
    const choice = [...document.querySelectorAll("[role=option]")].find(
      (each) => each.textContent === option,
    );
    if (!choice) throw new Error(`no ${option} in ${name}`);
    await click(choice);
  }

  it("lists a page of open tasks, newest first, and the next after a round trip", async () => {
    const container = await draw(Tasks, WIDTHS.desktop);
    const first = keys(container);
    expect(first).toHaveLength(20);
    expect(first[0]).toBe("T-60");
    expect(container.textContent).toContain("20 of");
    await click(button(container, "Load more"));
    expect(container.textContent).toContain("Loading…");
    await wait(TASKS_LATENCY_MS + 50);
    expect(keys(container).length).toBeGreaterThan(20);
    expect(keys(container).slice(0, 20)).toEqual(first);
  });

  it("narrows the list from the toolbar, and says so when nothing matches", async () => {
    const container = await draw(Tasks, WIDTHS.desktop);
    await pick(container, "Status", "Closed");
    expect(keys(container).length).toBeGreaterThan(0);
    for (const each of container.querySelectorAll("tr[data-task]")) {
      expect(each.textContent).toContain("Closed");
    }
    await pick(container, "Status", "Any status");
    await pick(container, "Assignee", "Nobody");
    expect(keys(container).length).toBeGreaterThan(0);
    for (const each of container.querySelectorAll("tr[data-task]")) {
      expect(each.textContent).toContain("Nobody");
    }
    await type(
      container.querySelector<HTMLInputElement>(
        "input[aria-label='Search tasks']",
      ),
      "no task has this word",
    );
    expect(keys(container)).toEqual([]);
    expect(container.textContent).toContain("No tasks match");
    await click(button(container, "Clear filters"));
    expect(keys(container)[0]).toBe("T-60");
  });

  it("shows a task's details beside the list, in the URL", async () => {
    const container = await draw(Tasks, WIDTHS.desktop);
    await click(row(container, "T-60")?.querySelector("td:nth-child(4)"));
    expect(location.search).toBe("?task=60");
    expect(container.querySelector("aside")?.textContent).toContain(
      "Keyboard help for the demos",
    );
    expect(dialog()).toBeNull();
    // A related task's chip shows that one in its place.
    await click(container.querySelector("aside [data-slot=link-chip]"));
    expect(location.search).toBe("?task=59");
    await click(container.querySelector("[aria-label='Close details']"));
    await wait(50);
    expect(location.search).toBe("");
    expect(container.querySelector("aside")).toBeNull();
  });

  it("shows a task's details in a sheet on a phone", async () => {
    const container = await draw(Tasks, WIDTHS.phone);
    await click(row(container, "T-60")?.querySelector("a"));
    expect(container.querySelector("aside")).toBeNull();
    expect(dialog()?.textContent).toContain("Keyboard help for the demos");
  });

  it("closes the selected tasks at once, and Undo brings them back", async () => {
    const container = await draw(Tasks, WIDTHS.desktop);
    const [a, b] = keys(container);
    if (!a || !b) throw new Error("too few tasks");
    await select(container, a);
    await select(container, b);
    await click(button(container, "Close 2 tasks"));
    expect(dialog()).toBeNull();
    expect(keys(container)).not.toContain(a);
    expect(keys(container)).not.toContain(b);
    // A toast dismissed by an earlier test may still be fading out, Undo and all.
    const closed = [...document.querySelectorAll("[data-sonner-toast]")].find(
      (each) => each.textContent?.includes("Closed 2 tasks"),
    );
    expect(closed).toBeDefined();
    await click(button(closed ?? document, "Undo"));
    expect(keys(container).slice(0, 2)).toEqual([a, b]);
  });

  it("deletes only once the confirmation is accepted", async () => {
    const container = await draw(Tasks, WIDTHS.desktop);
    await select(container, "T-60");
    await click(button(container, "Delete 1 task…"));
    expect(dialog()?.textContent).toContain("Delete T-60?");
    await click(button(dialog() ?? document, "Cancel"));
    expect(keys(container)).toContain("T-60");
    await click(button(container, "Delete 1 task…"));
    await click(button(dialog() ?? document, "Delete task"));
    expect(keys(container)).not.toContain("T-60");
    expect(document.body.textContent).toContain("Deleted T-60");
  });

  it("creates a task on top of the list, and shows it", async () => {
    const container = await draw(Tasks, WIDTHS.desktop);
    await click(button(container, "New"));
    const create = () => button(dialog() ?? document, "Create task");
    await click(create());
    expect(dialog()?.textContent).toContain("Give the task a title.");
    await type(
      document.querySelector<HTMLInputElement>("#new-task-title"),
      "Write the tasks demo",
    );
    await click(create());
    expect(keys(container)[0]).toBe("T-61");
    expect(location.search).toBe("?task=61");
    expect(container.querySelector("aside")?.textContent).toContain(
      "Write the tasks demo",
    );
  });
});

describe("config-editor", () => {
  // The site mounts one Toaster for every page; the demo's toasts need it here too.
  let toaster: Root;
  beforeAll(async () => {
    const host = document.createElement("div");
    document.body.append(host);
    toaster = createRoot(host);
    await act(async () => toaster.render(<Toaster />));
  });
  afterAll(() => act(() => toaster.unmount()));
  beforeEach(() => act(() => toast.dismiss()));

  const click = (element: Element | null | undefined) =>
    act(async () => {
      if (!element) throw new Error("nothing to click");
      (element as HTMLElement).click();
    });
  const button = (root: ParentNode, name: string) =>
    [...root.querySelectorAll<HTMLButtonElement>("button")].find(
      (each) => each.textContent === name,
    );
  const file = (container: HTMLElement, name: string) =>
    [
      ...container.querySelectorAll<HTMLElement>(
        "nav[aria-label=Files] button",
      ),
    ].find((each) => each.textContent?.startsWith(name));
  const dialog = () => document.querySelector<HTMLElement>("[role=dialog]");
  const title = (container: HTMLElement) =>
    container.querySelector("#config-file-title")?.textContent;
  const problem = (container: HTMLElement) =>
    container.querySelector("#config-problem")?.textContent;
  const editor = (container: HTMLElement) => {
    const content = container.querySelector<HTMLElement>(".cm-content");
    const view = content && EditorView.findFromDOM(content);
    if (!view) throw new Error("no editor");
    return view;
  };
  const text = (container: HTMLElement) =>
    editor(container).state.doc.toString();
  /** Puts `insert` after the first `after` in the open file. */
  const edit = (container: HTMLElement, after: string, insert: string) =>
    act(async () => {
      const view = editor(container);
      const at = view.state.doc.toString().indexOf(after) + after.length;
      view.dispatch({ changes: { from: at, insert } });
    });

  it("names the first syntax error by line, and saves only a file that parses", async () => {
    const container = await draw(ConfigEditor, WIDTHS.desktop);
    expect(button(container, "Save")?.disabled).toBe(true);
    await edit(container, '"timeout": "30s",', ",");
    expect(problem(container)).toBe('Line 7: Unexpected ","');
    expect(button(container, "Save")?.disabled).toBe(true);
    expect(
      container.querySelector(".cm-content")?.getAttribute("aria-invalid"),
    ).toBe("true");

    await act(async () => {
      const view = editor(container);
      const at = view.state.doc.toString().indexOf(",,") + 1;
      view.dispatch({
        changes: { from: at, to: at + 1, insert: ' "canary": true,' },
      });
    });
    expect(problem(container)).toContain("Valid JSON");
    await click(button(container, "Save"));
    expect(document.body.textContent).toContain("Saved deploy.json");
    expect(container.textContent).not.toContain("Unsaved");
  });

  it("asks before switching away from unsaved edits", async () => {
    const container = await draw(ConfigEditor, WIDTHS.desktop);
    await edit(container, '"replicas": ', "1");
    expect(file(container, "deploy.json")?.textContent).toContain("unsaved");

    await click(file(container, "alerts.json"));
    expect(dialog()?.textContent).toContain("Leave with unsaved changes?");
    await click(button(dialog() ?? document, "Keep editing"));
    expect(title(container)).toBe("deploy.json");
    expect(text(container)).toContain('"replicas": 13');

    await click(file(container, "alerts.json"));
    await click(button(dialog() ?? document, "Discard and leave"));
    expect(title(container)).toBe("alerts.json");
    await click(file(container, "deploy.json"));
    expect(dialog()).toBeNull();
    expect(text(container)).toContain('"replicas": 3,');
  });

  it("reviews the edits as a diff, and undoes a discard", async () => {
    const container = await draw(ConfigEditor, WIDTHS.desktop);
    expect(button(container, "Review changes")?.disabled).toBe(true);
    await edit(container, '"replicas": ', "1");
    await click(button(container, "Review changes"));
    expect(dialog()?.textContent).toContain("Changes to deploy.json");

    await click(button(dialog() ?? document, "Discard changes"));
    expect(dialog()).toBeNull();
    expect(text(container)).toContain('"replicas": 3,');
    await click(
      [...document.querySelectorAll("button")].findLast(
        (each) => each.textContent === "Undo",
      ),
    );
    expect(text(container)).toContain('"replicas": 13');
    expect(container.textContent).toContain("Unsaved");
  });
});

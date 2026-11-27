// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { type ContentRenderer, ContentRenderers } from "@orz/ui-content";
import {
  AttachmentViewerProvider,
  type AttachmentViewerState,
  type FileSource,
  useAttachmentViewer,
  type ViewerSource,
} from "@orz/ui-content/attachment";
import type { Window as HappyWindow } from "happy-dom";
import { act, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Notes } from "../src/demos/notes/notes.tsx";
import { PullRequest } from "../src/demos/pull-request/pull-request.tsx";
import { Repository } from "../src/demos/repository/repository.tsx";
import { useViewerHistory } from "../src/demos/viewer-history.ts";

// The asciinema player needs canvas and WASM, which happy-dom has neither of.
vi.mock("../../../packages/ui-asciinema/src/load-player.ts", () => ({
  loadPlayer: () => new Promise(() => {}),
}));

// mermaid lays a diagram out by measuring text, which happy-dom cannot.
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

const PAGE = "/demos/example/";

let unmount = () => {};
afterEach(() => {
  unmount();
  history.replaceState(null, "", "/");
});

async function draw(Demo: ComponentType) {
  (window as unknown as HappyWindow).happyDOM.setViewport({
    width: 1280,
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

const wait = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));
const click = (element: Element | null | undefined) =>
  act(async () => (element as HTMLElement | null | undefined)?.click());
const back = async () => {
  await act(async () => history.back());
  await wait();
};
const forward = async () => {
  await act(async () => history.forward());
  await wait();
};
const press = (key: string) =>
  act(async () => {
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true }),
    );
  });
const dialog = () => document.querySelector<HTMLElement>("[role=dialog]");
const title = () => dialog()?.querySelector("h2")?.textContent;
const view = () => new URLSearchParams(location.search).get("view");
const button = (root: ParentNode, name: string) =>
  [...root.querySelectorAll<HTMLElement>("button, a")].find(
    (each) =>
      each.getAttribute("aria-label") === name || each.textContent === name,
  );

const stub: ContentRenderer = {
  name: "stub",
  accepts: (source) =>
    source.kind === "inline" ||
    (source.kind === "file" && source.name.endsWith(".txt")),
  Component: () => <span>stub</span>,
};

const text = (name: string): FileSource => ({
  kind: "file",
  name,
  size: 1,
  url: `https://app.example/files/${name}`,
});
const ITEMS = [text("a.txt"), text("b.txt")];
const SNIPPET: ViewerSource[] = [
  { kind: "inline", text: "x", lang: "txt", title: "Snippet" },
];

const find = (name: string): AttachmentViewerState | null => {
  const index = ITEMS.findIndex((file) => file.name === name);
  return index === -1 ? null : { items: ITEMS, index };
};

function Openers() {
  const viewer = useAttachmentViewer();
  return (
    <>
      <button type="button" onClick={() => viewer?.open(ITEMS, 0)}>
        files
      </button>
      <button type="button" onClick={() => viewer?.open(SNIPPET, 0)}>
        snippet
      </button>
    </>
  );
}

function App() {
  const viewer = useViewerHistory(find);
  return (
    <ContentRenderers renderers={[stub]}>
      <AttachmentViewerProvider
        state={viewer.state}
        onStateChange={viewer.onStateChange}
      >
        <Openers />
      </AttachmentViewerProvider>
    </ContentRenderers>
  );
}

describe("useViewerHistory", () => {
  beforeEach(() => history.replaceState(null, "", PAGE));

  it("takes an entry naming the file, which Back closes", async () => {
    const container = await draw(App);
    const before = history.length;
    await click(button(container, "files"));
    expect(title()).toBe("a.txt");
    expect(view()).toBe("a.txt");
    expect(history.length).toBe(before + 1);
    await back();
    expect(dialog()).toBeNull();
    expect(location.pathname + location.search).toBe(PAGE);
  });

  it("replaces its entry on paging, so Back still closes it", async () => {
    const container = await draw(App);
    await click(button(container, "files"));
    const opened = history.length;
    await click(button(document, "next attachment"));
    expect(title()).toBe("b.txt");
    expect(view()).toBe("b.txt");
    expect(history.length).toBe(opened);
    await back();
    expect(dialog()).toBeNull();
  });

  it("steps back over its entry from the close button", async () => {
    const container = await draw(App);
    await click(button(container, "files"));
    await click(button(document, "Close"));
    await wait();
    expect(dialog()).toBeNull();
    expect(view()).toBeNull();
    // Forward is where the entry went: it is still there to come back to.
    await forward();
    expect(title()).toBe("a.txt");
  });

  it("steps back once for two closes the browser has not answered yet", async () => {
    const container = await draw(App);
    await click(button(container, "files"));
    const stepBack = vi.spyOn(history, "back").mockImplementation(() => {});
    try {
      await press("Escape");
      await press("Escape");
      expect(stepBack).toHaveBeenCalledTimes(1);
    } finally {
      stepBack.mockRestore();
    }
  });

  it("opens on the file a link names, and closes it in place", async () => {
    history.replaceState(null, "", `${PAGE}?view=b.txt`);
    const before = history.length;
    await draw(App);
    expect(title()).toBe("b.txt");
    await click(button(document, "Close"));
    await wait();
    expect(dialog()).toBeNull();
    expect(location.pathname + location.search).toBe(PAGE);
    expect(history.length).toBe(before);
  });

  it("names nothing it could not find again", async () => {
    const container = await draw(App);
    await click(button(container, "snippet"));
    expect(title()).toBe("Snippet");
    expect(view()).toBeNull();
    await back();
    expect(dialog()).toBeNull();
  });

  it("shows nothing on an entry an earlier load left marked", async () => {
    history.replaceState({ viewer: "earlier-1", pushed: true }, "", PAGE);
    const container = await draw(App);
    expect(dialog()).toBeNull();
    await click(button(container, "snippet"));
    await back();
    expect(history.state?.viewer).toBe("earlier-1");
    expect(dialog()).toBeNull();
  });
});

describe("the demos' viewers", () => {
  it("pull-request: an artifact takes an entry, which Back closes", async () => {
    history.replaceState(null, "", "/demos/pull-request/");
    const container = await draw(PullRequest);
    await click(container.querySelector("[aria-label='Details for Build']"));
    await wait();
    await click(
      [...container.querySelectorAll("a")].find((row) =>
        row.textContent?.startsWith("test.log"),
      ),
    );
    expect(title()).toBe("test.log");
    expect(view()).toBe("test.log");
    await back();
    expect(dialog()).toBeNull();
    expect(view()).toBeNull();
  });

  it("notes: a linked file takes an entry, which Back closes", async () => {
    history.replaceState(null, "", "/demos/notes/");
    const container = await draw(Notes);
    await wait();
    await click(button(container, "fetch-task.ts"));
    expect(title()).toBe("fetch-task.ts");
    expect(view()).toBe("fetch-task.ts");
    await back();
    expect(dialog()).toBeNull();
  });

  it("repository: an image's comparison takes an entry, which Back closes", async () => {
    history.replaceState(
      null,
      "",
      "/demos/repository/#docs/assets/settings.svg",
    );
    const container = await draw(Repository);
    await click(button(container, "Changes"));
    const before = history.length;
    await click(button(container, "Open in the viewer"));
    expect(dialog()).not.toBeNull();
    expect(history.length).toBe(before + 1);
    // The Changes view it opens from is not in the address, so nothing names it there.
    expect(view()).toBeNull();
    await back();
    expect(dialog()).toBeNull();
    expect(location.hash).toBe("#docs/assets/settings.svg");
  });
});

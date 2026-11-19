import {
  Content,
  type ContentRenderer,
  ContentRenderers,
  type ContentSource,
} from "@orz/ui-content";
import { attachmentCard } from "@orz/ui-content/attachment";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { type ReactNode, type Ref, useImperativeHandle, useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { codeContent } from "../src/content.tsx";
import { patchContent } from "../src/patch-content.tsx";
import { LARGE_DIFF_LINES, PatchView } from "../src/patch-view.tsx";

type Item =
  | { id: string; type: "file"; file: { name: string; contents: string } }
  | {
      id: string;
      type: "diff";
      fileDiff: { name: string };
      collapsed?: boolean;
    };

/** Where the stand-in renderer says it is scrolled, and where it was sent. */
const scroll = vi.hoisted(() => ({
  top: 0,
  itemTops: new Map<string, number>(),
  scrolledTo: [] as unknown[],
}));

// The real parser runs (it is plain string work); only the renderer is a
// stand-in that says what it was handed, header rows included. A code block
// is a CodeView too, so the raw text shows up as a file item.
vi.mock("@pierre/diffs/react", () => ({
  CodeView: function CodeView({
    ref,
    items,
    options,
    className,
    renderCustomHeader,
  }: {
    ref?: Ref<unknown>;
    className?: string;
    options?: { stickyHeaders?: boolean };
    items: Item[];
    renderCustomHeader?: (item: Item) => ReactNode;
  }) {
    useImperativeHandle(ref, () => ({
      scrollTo: (target: unknown) => scroll.scrolledTo.push(target),
      getInstance: () => ({
        getScrollTop: () => scroll.top,
        getTopForItem: (id: string) => scroll.itemTops.get(id),
      }),
    }));
    return (
      <div
        data-testid="codeview"
        data-class={className ?? ""}
        data-sticky-headers={options?.stickyHeaders ? "" : undefined}
      >
        {items.map((item) => (
          <section key={item.id} data-item={item.id}>
            <header>{renderCustomHeader?.(item)}</header>
            {item.type === "diff" ? (
              <div
                data-diff={item.fileDiff.name}
                data-collapsed={item.collapsed ? "" : undefined}
              >
                {item.id}
              </div>
            ) : (
              <pre data-file={item.file.name}>{item.file.contents}</pre>
            )}
          </section>
        ))}
      </div>
    );
  },
  MultiFileDiff: () => null,
}));

// The parser is a chunk of its own, loaded on the first parse: ~0.1 s idle,
// ~0.7 s on a loaded machine. That is setup, not a test's to wait for.
beforeAll(() => import("@pierre/diffs"));

const TWO_FILES = `diff --git a/src/a.ts b/src/a.ts
index 1111111..2222222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,3 @@
 one
-two
+deux
 three
diff --git a/src/b.ts b/src/b.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/b.ts
@@ -0,0 +1,2 @@
+alpha
+beta
`;

const FORMAT_PATCH = `From 0000000000000000000000000000000000000000 Mon Sep 17 00:00:00 2001
From: alice <noreply@example.com>
Subject: [PATCH] fix: say deux

The body of the message.
---
 src/a.ts | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)

${TWO_FILES.split("diff --git a/src/b.ts")[0]}--
2.47.0
`;

// The hunk header promises three lines of context and gets one.
const SHORT_HUNK = `--- a.txt
+++ b.txt
@@ -1,3 +1,3 @@
 one
-two
+deux
`;

const diffs = () =>
  [...document.querySelectorAll("[data-diff]")].map((el) =>
    el.getAttribute("data-diff"),
  );

/** A new file with `lines` added lines. */
const newFile = (name: string, lines: number) => `diff --git a/${name} b/${name}
new file mode 100644
index 0000000..4444444
--- /dev/null
+++ b/${name}
@@ -0,0 +1,${lines} @@
${Array.from({ length: lines }, (_, i) => `+line ${i}`).join("\n")}
`;

const collapsedDiffs = () =>
  [...document.querySelectorAll("[data-diff][data-collapsed]")].map((el) =>
    el.getAttribute("data-diff"),
  );

/** The raw text, as the code block's single file item carries it. */
const rawText = () => document.querySelector("[data-file]")?.textContent;

const RENDERERS: ContentRenderer[] = [patchContent, codeContent];

function draw(source: ContentSource, renderers = RENDERERS) {
  return render(
    <ContentRenderers renderers={renderers}>
      <Content source={source} placement="document" />
    </ContentRenderers>,
  );
}

const patchFile = (
  name: string,
  text: string,
): Extract<ContentSource, { kind: "file" }> => ({
  kind: "file",
  name,
  mime: "text/x-patch",
  size: text.length,
  load: async () => text,
});

/** The card's header row, which holds its name. */
const cardHeader = () => {
  const row = document.querySelector("section")?.firstElementChild;
  if (!(row instanceof HTMLElement)) throw new Error("no header");
  return row;
};

describe("PatchView", () => {
  it("draws one diff per file, behind a height cap", async () => {
    render(<PatchView filename="x.patch" text={TWO_FILES} />);
    // The first render on a loaded machine comes to ~1 s, the default wait.
    await waitFor(() => expect(diffs()).toEqual(["src/a.ts", "src/b.ts"]), {
      timeout: 3000,
    });
    // CodeView virtualizes against its own box; without the cap a 1 MB patch
    // laid out every line and froze the tab for 15 s.
    const cls = screen.getByTestId("codeview").getAttribute("data-class");
    expect(cls).toMatch(/\bmax-h-/);
    expect(cls).toMatch(/\boverflow-auto\b/);
  });

  it("keeps each file's header pinned while the file scrolls under it", async () => {
    render(<PatchView filename="x.patch" text={TWO_FILES} />);
    const view = await screen.findByTestId("codeview");
    expect(view.dataset.stickyHeaders).toBe("");
  });

  it("lists the files with their counts and toggles to the raw text", async () => {
    render(<PatchView filename="x.patch" text={TWO_FILES} />);
    const summary = await screen.findByRole("button", { name: /2 files/ });
    expect(summary.textContent).toContain("+3");
    expect(summary.textContent).toContain("−1");
    fireEvent.click(summary);
    const menu = within(await screen.findByRole("dialog"));
    expect(menu.getByRole("button", { name: /b\.ts/ })).toBeTruthy();

    const raw = screen.getByRole("button", { name: "raw" });
    fireEvent.click(raw);
    expect(raw.getAttribute("aria-pressed")).toBe("true");
    expect(diffs()).toEqual([]);
    expect(rawText()).toBe(TWO_FILES);
    fireEvent.click(raw);
    expect(diffs()).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("does not jump inside a clipped card", async () => {
    render(<PatchView filename="x.patch" text={TWO_FILES} fit="clipped" />);
    fireEvent.click(await screen.findByRole("button", { name: /2 files/ }));
    await waitFor(() =>
      expect(document.querySelector('li[title="src/b.ts"]')).not.toBeNull(),
    );
    const menu = within(await screen.findByRole("dialog"));
    expect(menu.queryByRole("button", { name: /b\.ts/ })).toBeNull();
    expect(screen.getByTestId("codeview").getAttribute("data-class")).toMatch(
      /\boverflow-hidden\b/,
    );
  });

  it("refuses a hunk whose counts do not add up, and says so", async () => {
    render(<PatchView filename="x.patch" text={SHORT_HUNK} invalidNote />);
    await screen.findByText("Not a valid patch — showing the text.");
    expect(diffs()).toEqual([]);
    expect(rawText()).toBe(SHORT_HUNK);
  });

  it("calls text with no file in it invalid too", async () => {
    render(<PatchView filename="x.patch" text={"just notes\n"} invalidNote />);
    await screen.findByText("Not a valid patch — showing the text.");
  });
});

describe("the patch header", () => {
  it("prints the commit date as a <time> after the author", async () => {
    const dated = FORMAT_PATCH.replace(
      "Subject:",
      "Date: Tue, 1 Sep 2026 10:00:00 +0000\nSubject:",
    );
    render(<PatchView filename="x.patch" text={dated} />);
    await waitFor(() => expect(diffs()).toEqual(["src/a.ts"]));
    const commit = document.querySelector('[data-item="commit-0"]');
    if (!(commit instanceof HTMLElement)) throw new Error("no commit item");
    const time = commit.querySelector("header time");
    expect(time?.textContent).toMatch(/2026/);
    expect(time?.previousSibling?.textContent).toBe(" · ");
  });

  it("draws a commit as one row over its message, mail headers and stat left to raw", async () => {
    render(<PatchView filename="x.patch" text={FORMAT_PATCH} />);
    await waitFor(() => expect(diffs()).toEqual(["src/a.ts"]));
    const commit = document.querySelector('[data-item="commit-0"]');
    if (!(commit instanceof HTMLElement)) throw new Error("no commit item");
    const header = within(commit).getByRole("banner");
    expect(header.textContent).toContain("fix: say deux");
    expect(header.textContent).not.toContain("[PATCH]");
    expect(header.textContent).toContain("alice");
    expect(header.textContent).toContain("0000000");
    expect(commit.querySelector("[data-file]")?.textContent).toBe(
      "The body of the message.",
    );
    // pierre reserves this height for the row without measuring it: a row of
    // any other height shifts every item under it.
    expect(header.firstElementChild?.getAttribute("style")).toMatch(
      /height: 36px/,
    );
  });

  it("names no commit for a bare diff command above a plain diff", async () => {
    render(
      <PatchView
        filename="x.diff"
        text={`diff -u a.txt b.txt\n${SHORT_HUNK.replace("-1,3 +1,3", "-1,2 +1,2")}`}
      />,
    );
    await waitFor(() => expect(diffs()).toEqual(["b.txt"]));
    expect(document.querySelector('[data-item^="commit-"]')).toBeNull();
  });
});

describe("patchContent", () => {
  it.each([
    ["a diff fence", { kind: "inline", text: "", lang: "diff" }],
    ["a Patch fence", { kind: "inline", text: "", lang: "Patch" }],
    ["a declared patch", { kind: "file", name: "x", mime: "text/x-diff" }],
    ["a .patch of generic type", { kind: "file", name: "fix.patch" }],
  ] satisfies [string, ContentSource][])("takes %s", (_, source) => {
    expect(patchContent.accepts(source, "document")).toBe(true);
    expect(patchContent.accepts(source, "viewer")).toBe(true);
  });

  it.each([
    ["another fence", { kind: "inline", text: "", lang: "ts" }],
    ["an untagged fence", { kind: "inline", text: "" }],
    [
      "a .patch declared as text",
      {
        kind: "file",
        name: "fix.patch",
        mime: "text/plain",
      },
    ],
  ] satisfies [string, ContentSource][])("refuses %s", (_, source) => {
    expect(patchContent.accepts(source, "document")).toBe(false);
  });

  it("draws a fence holding a patch as its diff, in a frame of its own", async () => {
    draw({ kind: "inline", text: TWO_FILES.trimEnd(), lang: "diff" });
    await waitFor(() => expect(diffs()).toEqual(["src/a.ts", "src/b.ts"]));
    expect(screen.getByText("patch")).toBeTruthy();
    expect(screen.getByRole("button", { name: "raw" })).toBeTruthy();
  });

  it("leaves a bare +/- snippet as code, without a complaint", async () => {
    draw({ kind: "inline", text: "-old\n+new", lang: "patch" });
    await waitFor(() => expect(rawText()).toBe("-old\n+new"));
    expect(diffs()).toEqual([]);
    expect(screen.queryByText(/Not a valid patch/)).toBeNull();
  });

  it("puts a patch card's controls in its title bar, nothing above the diffs", async () => {
    draw(patchFile("x.patch", TWO_FILES), [attachmentCard(), ...RENDERERS]);
    await waitFor(() => expect(diffs()).toEqual(["src/a.ts", "src/b.ts"]));
    const bar = cardHeader();
    expect(within(bar).getByRole("button", { name: "raw" })).toBeTruthy();
    expect(within(bar).getByRole("button", { name: /2 files/ })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "raw" })).toHaveLength(1);
    expect(screen.queryByText("patch")).toBeNull();
    const codeview = screen.getByTestId("codeview");
    expect(codeview.getAttribute("data-class")).toMatch(/\boverflow-hidden\b/);
  });

  it("frames a fence inside a document card, leaving the card's title bar alone", async () => {
    const doc: ContentRenderer = {
      name: "doc",
      accepts: (source) => source.kind === "file" && source.name === "notes.md",
      Component: () => (
        <Content
          source={{ kind: "inline", text: TWO_FILES, lang: "diff" }}
          placement="document"
        />
      ),
    };
    draw({ kind: "file", name: "notes.md", mime: "text/markdown", size: 1 }, [
      attachmentCard(),
      doc,
      ...RENDERERS,
    ]);
    await waitFor(() => expect(diffs()).toEqual(["src/a.ts", "src/b.ts"]));
    expect(
      within(cardHeader()).queryByRole("button", { name: "raw" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "raw" })).toBeTruthy();
  });

  it("says so when a patch file is not one, above its numbered text", async () => {
    draw(patchFile("x.patch", "just notes\n"));
    await screen.findByText("Not a valid patch — showing the text.");
    expect(rawText()).toBe("just notes");
  });
});

describe("PatchView large files", () => {
  it("holds back a file past the line limit until asked", async () => {
    render(
      <PatchView
        filename="x.patch"
        text={`${TWO_FILES}${newFile("state.json", LARGE_DIFF_LINES + 1)}`}
      />,
    );
    await waitFor(() =>
      expect(diffs()).toEqual(["src/a.ts", "src/b.ts", "state.json"]),
    );
    expect(collapsedDiffs()).toEqual(["state.json"]);
    fireEvent.click(screen.getByRole("button", { name: "Load diff" }));
    expect(collapsedDiffs()).toEqual([]);
    expect(screen.queryByRole("button", { name: "Load diff" })).toBeNull();
  });

  it("draws a file at the limit in full", async () => {
    render(
      <PatchView
        filename="x.patch"
        text={`${TWO_FILES}${newFile("state.json", LARGE_DIFF_LINES)}`}
      />,
    );
    await waitFor(() =>
      expect(diffs()).toEqual(["src/a.ts", "src/b.ts", "state.json"]),
    );
    expect(collapsedDiffs()).toEqual([]);
  });

  it("never holds back the only file", async () => {
    render(
      <PatchView
        filename="x.patch"
        text={newFile("state.json", LARGE_DIFF_LINES + 1)}
      />,
    );
    await waitFor(() => expect(diffs()).toEqual(["state.json"]));
    expect(collapsedDiffs()).toEqual([]);
  });
});

describe("PatchView folding files", () => {
  it("folds a file from its header and unfolds it again", async () => {
    render(<PatchView filename="x.patch" text={TWO_FILES} />);
    const collapse = await screen.findByRole("button", {
      name: "Collapse src/a.ts",
    });
    expect(collapse.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(collapse);
    expect(collapsedDiffs()).toEqual(["src/a.ts"]);
    const expand = screen.getByRole("button", { name: "Expand src/a.ts" });
    expect(expand).toBe(collapse);
    expect(expand.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(expand);
    expect(collapsedDiffs()).toEqual([]);
  });

  it("gives the only file nothing to fold", async () => {
    render(<PatchView filename="x.patch" text={newFile("only.ts", 2)} />);
    await waitFor(() => expect(diffs()).toEqual(["only.ts"]));
    expect(screen.queryByRole("button", { name: /Collapse/ })).toBeNull();
  });

  it("unfolds a folded file the file list jumps to", async () => {
    render(<PatchView filename="x.patch" text={TWO_FILES} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Collapse src/b.ts" }),
    );
    expect(collapsedDiffs()).toEqual(["src/b.ts"]);
    fireEvent.click(screen.getByRole("button", { name: /2 files/ }));
    const menu = within(await screen.findByRole("dialog"));
    fireEvent.click(menu.getByRole("button", { name: /b\.ts/ }));
    expect(collapsedDiffs()).toEqual([]);
  });

  it("treats a large file's chevron like Load diff", async () => {
    render(
      <PatchView
        filename="x.patch"
        text={`${TWO_FILES}${newFile("state.json", LARGE_DIFF_LINES + 1)}`}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Expand state.json" }),
    );
    expect(collapsedDiffs()).toEqual([]);
    expect(screen.queryByRole("button", { name: "Load diff" })).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Collapse state.json" }),
    );
    expect(collapsedDiffs()).toEqual(["state.json"]);
    expect(screen.getByRole("button", { name: "Load diff" })).toBeTruthy();
  });

  it("scrolls back to a file's header when folding it from partway down", async () => {
    render(<PatchView filename="x.patch" text={TWO_FILES} />);
    const collapse = await screen.findByRole("button", {
      name: "Collapse src/a.ts",
    });
    const a = document.querySelector("[data-diff='src/a.ts']")?.textContent;
    if (a == null) throw new Error("src/a.ts is not drawn");
    scroll.itemTops = new Map([[a, 0]]);
    scroll.scrolledTo = [];

    scroll.top = 0;
    fireEvent.click(collapse);
    fireEvent.click(screen.getByRole("button", { name: "Expand src/a.ts" }));
    expect(scroll.scrolledTo).toEqual([]);

    scroll.top = 120;
    fireEvent.click(screen.getByRole("button", { name: "Collapse src/a.ts" }));
    expect(scroll.scrolledTo).toEqual([
      { type: "item", id: a, align: "start" },
    ]);
    expect(collapsedDiffs()).toEqual(["src/a.ts"]);
  });

  it("does not scroll a clipped card back", async () => {
    render(<PatchView filename="x.patch" text={TWO_FILES} fit="clipped" />);
    const collapse = await screen.findByRole("button", {
      name: "Collapse src/a.ts",
    });
    const a = document.querySelector("[data-diff='src/a.ts']")?.textContent;
    if (a == null) throw new Error("src/a.ts is not drawn");
    scroll.itemTops = new Map([[a, 0]]);
    scroll.scrolledTo = [];
    scroll.top = 120;
    fireEvent.click(collapse);
    expect(scroll.scrolledTo).toEqual([]);
    expect(collapsedDiffs()).toEqual(["src/a.ts"]);
  });

  it("keeps what was folded across the raw view", async () => {
    render(<PatchView filename="x.patch" text={TWO_FILES} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Collapse src/a.ts" }),
    );
    const raw = screen.getByRole("button", { name: "raw" });
    fireEvent.click(raw);
    fireEvent.click(raw);
    expect(collapsedDiffs()).toEqual(["src/a.ts"]);
  });

  it("starts a different patch with every file unfolded", async () => {
    const other = TWO_FILES.replaceAll("src/", "lib/");
    function Swap() {
      const [text, setText] = useState(TWO_FILES);
      return (
        <>
          <button type="button" onClick={() => setText(other)}>
            swap
          </button>
          <PatchView filename="x.patch" text={text} />
        </>
      );
    }
    render(<Swap />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Collapse src/a.ts" }),
    );
    expect(collapsedDiffs()).toEqual(["src/a.ts"]);
    fireEvent.click(screen.getByRole("button", { name: "swap" }));
    await waitFor(() => expect(diffs()).toEqual(["lib/a.ts", "lib/b.ts"]));
    expect(collapsedDiffs()).toEqual([]);
  });
});

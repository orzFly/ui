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
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { codeContent } from "../src/content.tsx";
import { patchContent } from "../src/patch-content.tsx";
import { PatchView } from "../src/patch-view.tsx";

type Item =
  | { id: string; type: "file"; file: { name: string; contents: string } }
  | { id: string; type: "diff"; fileDiff: { name: string } };

// The real parser runs (it is plain string work); only the renderer is a
// stand-in that says what it was handed, header rows included. A code block
// is a CodeView too, so the raw text shows up as a file item.
vi.mock("@pierre/diffs/react", () => ({
  CodeView: ({
    items,
    className,
    renderCustomHeader,
  }: {
    className?: string;
    items: Item[];
    renderCustomHeader?: (item: Item) => ReactNode;
  }) => (
    <div data-testid="codeview" data-class={className ?? ""}>
      {items.map((item) => (
        <section key={item.id} data-item={item.id}>
          <header>{renderCustomHeader?.(item)}</header>
          {item.type === "diff" ? (
            <div data-diff={item.fileDiff.name}>{item.id}</div>
          ) : (
            <pre data-file={item.file.name}>{item.file.contents}</pre>
          )}
        </section>
      ))}
    </div>
  ),
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
    // The file's first diff suspends on the lazy CodeView, and React holds
    // back a revealed Suspense boundary for 300 ms; with the file's first
    // render on a loaded machine, that comes to ~1 s, the default wait.
    await waitFor(() => expect(diffs()).toEqual(["src/a.ts", "src/b.ts"]), {
      timeout: 3000,
    });
    // CodeView virtualizes against its own box; without the cap a 1 MB patch
    // laid out every line and froze the tab for 15 s.
    const cls = screen.getByTestId("codeview").getAttribute("data-class");
    expect(cls).toMatch(/\bmax-h-/);
    expect(cls).toMatch(/\boverflow-auto\b/);
  });

  it("lists the files with their counts and toggles to the raw text", async () => {
    render(<PatchView filename="x.patch" text={TWO_FILES} />);
    const summary = await screen.findByRole("button", { name: /2 files/ });
    expect(summary.textContent).toContain("+3");
    expect(summary.textContent).toContain("−1");
    fireEvent.click(summary);
    expect(await screen.findByRole("button", { name: /b\.ts/ })).toBeTruthy();

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
    expect(screen.queryByRole("button", { name: /b\.ts/ })).toBeNull();
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

import type { CodeViewItem, ParsedPatch } from "@pierre/diffs";
import { render, waitFor } from "@testing-library/react";
import { StrictMode, useRef } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  CodeBlock,
  PatchFiles,
  parsePatch,
  patchCommitId,
  patchFileId,
} from "../src/code-block.tsx";

type Item = CodeViewItem<undefined>;

// The stand-in keeps pierre's rule for a list it already holds: an item under
// an id it has seen replaces the record only when its `version` differs
// (`syncItemRecord`). Each record shows what it was last given, so a block
// that changed without a new version goes on showing the old text, as the
// real view does.
vi.mock("@pierre/diffs/react", () => ({
  CodeView: function CodeView({ items }: { items: Item[] }) {
    const held = useRef(new Map<string, Item>());
    const shown = items.map((item) => {
      const was = held.current.get(item.id);
      const kept =
        was !== undefined &&
        was.type === item.type &&
        was.version === item.version
          ? was
          : item;
      held.current.set(item.id, kept);
      return kept;
    });
    return (
      <div data-testid="codeview">
        {shown.map((item) => (
          <pre
            key={item.id}
            data-item={item.id}
            data-version={item.version}
            data-lang={item.type === "file" ? item.file.lang : undefined}
            data-collapsed={item.collapsed ? "" : undefined}
          >
            {item.type === "file"
              ? item.file.contents
              : item.fileDiff.additionLines.join("")}
          </pre>
        ))}
      </div>
    );
  },
  MultiFileDiff: () => null,
}));

// The parser is a chunk of its own; loading it is setup, not a test's to wait for.
beforeAll(() => import("@pierre/diffs"));

const item = (id: string) =>
  document.querySelector<HTMLElement>(`[data-item="${id}"]`);

describe("CodeBlock", () => {
  it("draws new contents under the same filename", async () => {
    const { rerender } = render(
      <CodeBlock filename="a.ts" contents="const a = 1;" />,
    );
    await waitFor(() => expect(item("a.ts")?.textContent).toBe("const a = 1;"));
    rerender(<CodeBlock filename="a.ts" contents="const a = 2;" />);
    await waitFor(() => expect(item("a.ts")?.textContent).toBe("const a = 2;"));
  });

  it("draws the change in strict mode too", async () => {
    const { rerender } = render(
      <StrictMode>
        <CodeBlock filename="a.ts" contents="const a = 1;" />
      </StrictMode>,
    );
    await waitFor(() => expect(item("a.ts")?.textContent).toBe("const a = 1;"));
    rerender(
      <StrictMode>
        <CodeBlock filename="a.ts" contents="const a = 2;" />
      </StrictMode>,
    );
    await waitFor(() => expect(item("a.ts")?.textContent).toBe("const a = 2;"));
  });

  it("switches highlighting off and on again in place", async () => {
    const { rerender } = render(
      <CodeBlock filename="a.ts" contents="const a = 1;" />,
    );
    await waitFor(() => expect(item("a.ts")).not.toBeNull());
    expect(item("a.ts")?.dataset.lang).toBeUndefined();
    rerender(<CodeBlock filename="a.ts" contents="const a = 1;" plain />);
    await waitFor(() => expect(item("a.ts")?.dataset.lang).toBe("text"));
    rerender(<CodeBlock filename="a.ts" contents="const a = 1;" />);
    await waitFor(() => expect(item("a.ts")?.dataset.lang).toBeUndefined());
  });
});

const diff = (file: string, line: string) => `diff --git a/${file} b/${file}
index 1111111..2222222 100644
--- a/${file}
+++ b/${file}
@@ -1,2 +1,2 @@
 one
-two
+${line}
`;

async function parse(text: string): Promise<ParsedPatch[]> {
  const patches = await parsePatch(text);
  if (patches === null) throw new Error("not a patch");
  return patches;
}

function Patch({
  patches,
  messages,
  collapsed,
}: {
  patches: ParsedPatch[];
  messages: (string | null)[];
  collapsed?: ReadonlySet<number>;
}) {
  return (
    <PatchFiles
      patches={patches}
      messages={messages}
      text=""
      className="h-40"
      collapsedFiles={collapsed}
      renderHeader={() => null}
    />
  );
}

describe("PatchFiles", () => {
  it("draws a changed patch and a changed message under the same ids", async () => {
    const first = await parse(diff("a.ts", "deux") + diff("b.ts", "zwei"));
    const { rerender } = render(<Patch patches={first} messages={["Fix"]} />);
    await waitFor(() =>
      expect(item(patchFileId(0))?.textContent).toBe("one\ndeux\n"),
    );
    expect(item(patchCommitId(0))?.textContent).toBe("Fix");

    const second = await parse(diff("a.ts", "dos") + diff("b.ts", "zwei"));
    rerender(<Patch patches={second} messages={["Fix"]} />);
    await waitFor(() =>
      expect(item(patchFileId(0))?.textContent).toBe("one\ndos\n"),
    );

    rerender(<Patch patches={second} messages={["Fix it properly"]} />);
    await waitFor(() =>
      expect(item(patchCommitId(0))?.textContent).toBe("Fix it properly"),
    );
  });

  it("gives a new version to the file folded and no other", async () => {
    const patches = await parse(diff("a.ts", "deux") + diff("b.ts", "zwei"));
    const messages = ["Fix"];
    const { rerender } = render(
      <Patch patches={patches} messages={messages} collapsed={new Set()} />,
    );
    await waitFor(() => expect(item(patchFileId(1))).not.toBeNull());
    const versions = () =>
      [patchCommitId(0), patchFileId(0), patchFileId(1)].map(
        (id) => item(id)?.dataset.version,
      );
    const [message, a, b] = versions();
    rerender(
      <Patch patches={patches} messages={messages} collapsed={new Set([1])} />,
    );
    await waitFor(() =>
      expect(item(patchFileId(1))?.dataset.collapsed).toBe(""),
    );
    const [messageAfter, aAfter, bAfter] = versions();
    expect([messageAfter, aAfter]).toEqual([message, a]);
    expect(bAfter).not.toBe(b);
  });
});

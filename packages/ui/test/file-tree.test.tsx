import { act, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FileStatusMark,
  FileTree,
  FileTreeItem,
} from "../src/components/file-tree.tsx";
import type { TreeHandle } from "../src/components/tree.tsx";
import { type FileStatus, movePath } from "../src/lib/file-tree.ts";
import { FakeDataTransfer, fireDrag } from "./fake-data-transfer.ts";
import { H, type Layout, stubLayout, VIEWPORT } from "./stub-tree-layout.ts";

const PATHS = [
  ".github/workflows/ci.yml",
  "src/retry.ts",
  "src/fetch-task.ts",
  "dist/bundle.zip",
  "docs/old-guide.md",
  "README.md",
];

const STATUS: Record<string, FileStatus> = {
  "src/retry.ts": "added",
  "src/fetch-task.ts": "modified",
  "dist/": "ignored",
  "docs/old-guide.md": "deleted",
};

type Props = Partial<React.ComponentProps<typeof FileTree>>;

function renderFiles(props: Props = {}) {
  return (
    <FileTree aria-label="Files" paths={PATHS} status={STATUS} {...props}>
      {(file) => <FileTreeItem href={`#${file.path}`} />}
    </FileTree>
  );
}

// happy-dom computes the name as if every span were a block, a space after each.
const item = (name: string) =>
  screen.getByRole("treeitem", {
    name: (accessible) => accessible.replace(/ (?=[.,])/g, "") === name,
  });
const labels = () =>
  screen
    .queryAllByRole("treeitem")
    .map((el) => el.querySelector("[data-slot=tree-label]")?.textContent);

describe("FileTree", () => {
  it("renders each row as a link to its path, folders first", () => {
    render(renderFiles());
    expect(labels()).toEqual([
      ".github / workflows",
      "dist",
      "docs",
      "src",
      "README.md",
    ]);
    const readme = item("README.md");
    expect(readme.tagName).toBe("A");
    expect(readme.getAttribute("href")).toBe("#README.md");
  });

  it("opens to the current path, and marks it", () => {
    render(renderFiles({ current: "src/retry.ts" }));
    expect(labels()).toContain("retry.ts");
    expect(item("retry.ts, Added").getAttribute("aria-current")).toBe("page");
  });

  it("maps a merged folder's path onto its row", () => {
    const onExpandedChange = vi.fn();
    render(
      renderFiles({
        defaultExpanded: [".github"],
        current: ".github/",
        onExpandedChange,
      }),
    );
    expect(labels()).toContain("ci.yml");
    const row = item(".github / workflows");
    expect(row.getAttribute("aria-current")).toBe("page");
    fireEvent.click(
      row
        .closest("[data-slot=tree-row]")
        ?.querySelector("[data-slot=tree-toggle]") as HTMLElement,
    );
    expect(onExpandedChange).toHaveBeenLastCalledWith([]);
  });

  it("maps controlled expanded paths onto rows", () => {
    render(renderFiles({ expanded: ["src", ".github/workflows/"] }));
    expect(labels()).toEqual(
      expect.arrayContaining(["ci.yml", "retry.ts", "fetch-task.ts"]),
    );
  });

  it("says each row's status, and draws it as a hidden mark", () => {
    render(renderFiles({ defaultExpanded: ["src", "docs", "dist"] }));
    const modified = item("fetch-task.ts, Modified");
    expect(modified.getAttribute("data-status")).toBe("modified");
    const mark = modified.querySelector("[data-slot=file-status-mark]");
    expect(mark?.getAttribute("aria-hidden")).toBe("true");
    expect(mark?.textContent).toBe("M");
    expect(mark?.getAttribute("title")).toBe("Modified");
    expect(item("src, Contains changes").getAttribute("data-status")).toBe(
      "changes",
    );
    expect(item("bundle.zip, Ignored")).toBeTruthy();
    expect(item("README.md").hasAttribute("data-status")).toBe(false);
  });

  it("takes its own words for the statuses", () => {
    render(
      renderFiles({
        defaultExpanded: ["src"],
        statusLabels: { modified: "Geändert" },
      }),
    );
    expect(item("fetch-task.ts, Geändert")).toBeTruthy();
    expect(item("retry.ts, Added")).toBeTruthy();
  });

  it("filters by path as the query changes", () => {
    const { rerender } = render(renderFiles({ query: "retry" }));
    expect(labels()).toEqual(["src", "retry.ts"]);
    expect(item("retry.ts, Added").querySelector("mark")?.textContent).toBe(
      "retry",
    );
    rerender(renderFiles({ query: "  " }));
    expect(labels()).toEqual([
      ".github / workflows",
      "dist",
      "docs",
      "src",
      "README.md",
    ]);
    // ci.yml's path holds the folder's name too, so its folder opens.
    rerender(renderFiles({ query: "WORKFLOWS", filterMode: "collapse" }));
    expect(labels()).toEqual([
      ".github / workflows",
      "ci.yml",
      "dist",
      "docs",
      "src",
      "README.md",
    ]);
  });

  it("puts the icon, name and mark inside the link given with asChild", () => {
    render(
      <FileTree aria-label="Files" paths={PATHS} status={STATUS}>
        {(file) => (
          <FileTreeItem asChild>
            <a href={`/files/${file.path}`} data-router="">
              {file.directory ? null : <span data-testid="extra" />}
            </a>
          </FileTreeItem>
        )}
      </FileTree>,
    );
    const link = item("README.md");
    expect(link.getAttribute("data-router")).toBe("");
    expect(link.querySelector("svg")).toBeTruthy();
    expect(link.querySelector("[data-slot=tree-label]")?.textContent).toBe(
      "README.md",
    );
    expect(link.querySelector("[data-testid=extra]")).toBeTruthy();
    const docs = item("docs, Contains changes");
    expect(docs.querySelector("[data-slot=file-status-mark]")).toBeTruthy();
  });

  it("draws no icon when given null", () => {
    render(
      <FileTree aria-label="Files" paths={["a.ts"]}>
        {() => <FileTreeItem href="#a" icon={null} />}
      </FileTree>,
    );
    expect(item("a.ts").querySelector("svg")).toBeNull();
  });

  it("throws outside a FileTree's row", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<FileTreeItem href="#x" />)).toThrow(
      "FileTreeItem renders inside a FileTree's row",
    );
    vi.restoreAllMocks();
  });

  it("renders on the server without a window", () => {
    const html = renderToString(renderFiles({ current: "src/retry.ts" }));
    expect(html).toContain('href="#src/retry.ts"');
    expect(html).toContain('aria-current="page"');
  });
});

describe("FileStatusMark", () => {
  it("draws a letter, a dot for changes, nothing for ignored", () => {
    const { container } = render(
      <>
        <FileStatusMark status="renamed" label="Renamed" />
        <FileStatusMark status="changes" />
        <FileStatusMark status="ignored" />
      </>,
    );
    const marks = container.querySelectorAll("[data-slot=file-status-mark]");
    expect(marks[0]?.textContent).toBe("R");
    expect(marks[1]?.querySelector("span")).toBeTruthy();
    expect(marks[2]?.textContent).toBe("");
  });
});

// src (row 0) and its 300 files, then the merged "zz / inner" (row 301).
const MANY = [
  ...Array.from(
    { length: 300 },
    (_, i) => `src/file-${String(i).padStart(3, "0")}.ts`,
  ),
  "zz/inner/last.ts",
];

describe("FileTree, scrolled", () => {
  let layout: Layout;
  beforeEach(() => {
    layout = stubLayout();
  });
  afterEach(() => layout.restore());

  const rowItem = (index: number) =>
    document.querySelector(
      `[data-slot=tree-row][data-index="${index}"] [data-slot=tree-item]`,
    ) as HTMLElement;

  function many(props: Props = {}) {
    return (
      <div data-scroller="" style={{ overflowY: "auto" }}>
        <FileTree
          aria-label="Files"
          paths={MANY}
          status={{ "src/file-001.ts": "modified" }}
          defaultExpanded={["src"]}
          {...props}
        >
          {(file) => <FileTreeItem href={`#${file.path}`} />}
        </FileTree>
      </div>
    );
  }

  it("jumps to an unmounted row by its name", () => {
    render(many());
    expect(rowItem(301)).toBeNull();
    rowItem(0).focus();
    fireEvent.keyDown(rowItem(0), { key: "z" });
    expect(document.activeElement).toBe(item("zz / inner"));
  });

  it("scrolls to a path, a merged folder's own included", () => {
    const handle = React.createRef<TreeHandle>();
    render(many({ handle }));
    act(() => handle.current?.scrollToItem("zz/"));
    expect(layout.state.scrollTop).toBe(301 * H + H - VIEWPORT);
    act(() => handle.current?.scrollToItem("zz/inner/last.ts", "start"));
    expect(labels()).toContain("last.ts");
    expect(layout.state.scrollTop).toBe(302 * H);
  });

  it("pins a folder drawn with its icon and its status", () => {
    render(many({ stickyBranches: true }));
    act(() => {
      layout.state.scrollTop = 25;
      fireEvent.scroll(document.querySelector("[data-scroller]") as Element);
    });
    const pin = document.querySelector("[data-slot=tree-pin]");
    expect(pin?.querySelector("[data-slot=tree-label]")?.textContent).toBe(
      "src",
    );
    expect(pin?.querySelector("svg")).toBeTruthy();
    expect(
      pin
        ?.querySelector("[data-slot=file-status-mark]")
        ?.getAttribute("data-status"),
    ).toBe("changes");
  });
});

describe("FileTree, edited", () => {
  const field = () =>
    document.querySelector(
      "[data-slot=tree-rename]",
    ) as HTMLInputElement | null;
  const key = (el: Element, k: string, init: KeyboardEventInit = {}) =>
    fireEvent.keyDown(el, { key: k, ...init });
  const type = (value: string) =>
    fireEvent.change(field() as HTMLInputElement, { target: { value } });
  const message = () =>
    document.querySelector("[data-slot=tree-rename-message]")?.textContent;

  it("renames a file in its folder, its stem selected", () => {
    const onRename = vi.fn();
    render(renderFiles({ onRename, current: "src/retry.ts" }));
    key(item("retry.ts, Added"), "F2");
    const input = field() as HTMLInputElement;
    expect(input.value).toBe("retry.ts");
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 5]);
    type("backoff.ts");
    key(input, "Enter");
    expect(onRename).toHaveBeenCalledWith("src/retry.ts", "src/backoff.ts");
  });

  it("renames a merged row's deepest folder, the folders before it in sight", () => {
    const onRename = vi.fn();
    render(renderFiles({ onRename }));
    key(item(".github / workflows"), "F2");
    const input = field() as HTMLInputElement;
    expect(input.value).toBe("workflows");
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 9]);
    type("actions");
    key(input, "Enter");
    expect(onRename).toHaveBeenCalledWith(
      ".github/workflows/",
      ".github/actions/",
    );
  });

  it("refuses a name holding a slash, or one the folder has", () => {
    const onRename = vi.fn();
    render(
      renderFiles({
        onRename,
        labels: { nameTaken: (name) => `${name} is taken` },
      }),
    );
    key(item("README.md"), "F2");
    type("a/b.md");
    expect(message()).toBe("A name cannot contain “/”.");
    type("src");
    // A file and a folder may share a name.
    expect(message()).toBeUndefined();
    type("docs ");
    expect(message()).toBeUndefined();
    key(field() as HTMLInputElement, "Escape");
    key(item("src, Contains changes"), "F2");
    type("docs");
    expect(message()).toBe("docs is taken");
    key(field() as HTMLInputElement, "Enter");
    expect(onRename).not.toHaveBeenCalled();
  });

  it("keeps a renamed folder open under its new path", () => {
    function Files() {
      const [paths, setPaths] = React.useState(PATHS);
      return renderFiles({
        paths,
        defaultExpanded: ["src/"],
        onRename: (from, to) =>
          setPaths((list) => list.map((p) => movePath(p, from, to))),
      });
    }
    render(<Files />);
    expect(item("src, Contains changes").getAttribute("aria-expanded")).toBe(
      "true",
    );
    key(item("src, Contains changes"), "F2");
    type("lib");
    key(field() as HTMLInputElement, "Enter");
    expect(item("lib").getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(item("lib"));
    expect(labels()).toContain("retry.ts");
  });

  it("moves a row pasted on a file into that file's folder", () => {
    const onMove = vi.fn();
    render(renderFiles({ onMove, current: "src/retry.ts" }));
    key(item("README.md"), "x", { ctrlKey: true });
    key(item("retry.ts, Added"), "v", { ctrlKey: true });
    expect(onMove).toHaveBeenCalledWith([["README.md", "src/README.md"]]);
  });

  it("moves a row into a folder, never into its own or beside a row", () => {
    const onMove = vi.fn();
    const canMove = vi.fn(() => true);
    render(renderFiles({ onMove, canMove, current: "src/retry.ts" }));
    key(item("retry.ts, Added"), "x", { ctrlKey: true });
    // Its own folder, and a file there: nothing to do.
    key(item("fetch-task.ts, Modified"), "v", { ctrlKey: true });
    key(item("src, Contains changes"), "v", { ctrlKey: true });
    expect(onMove).not.toHaveBeenCalled();
    key(item("docs, Contains changes"), "v", { ctrlKey: true });
    expect(onMove).toHaveBeenCalledWith([["src/retry.ts", "docs/retry.ts"]]);
    expect(canMove).toHaveBeenCalledWith("src/retry.ts", "docs/retry.ts");
  });

  it("refuses a move onto a name the folder has, and what canMove refuses", () => {
    const onMove = vi.fn();
    const { rerender } = render(
      renderFiles({
        onMove,
        paths: [...PATHS, "docs/README.md"],
      }),
    );
    key(item("README.md"), "x", { ctrlKey: true });
    key(item("docs, Contains changes"), "v", { ctrlKey: true });
    expect(onMove).not.toHaveBeenCalled();
    rerender(renderFiles({ onMove, canMove: () => false }));
    key(item("docs, Contains changes"), "v", { ctrlKey: true });
    expect(onMove).not.toHaveBeenCalled();
  });

  it("drops a dragged row on a file into its folder", () => {
    const layout = stubLayout();
    const onMove = vi.fn();
    render(renderFiles({ onMove, current: "src/retry.ts" }));
    const data = new FakeDataTransfer();
    fireDrag("dragStart", item("README.md"), data);
    const row = item("retry.ts, Added").closest(
      "[data-slot=tree-row]",
    ) as HTMLElement;
    const index = Number(row.getAttribute("data-index"));
    fireDrag("dragOver", row, data, { clientY: index * H + 2 });
    expect(
      item("src, Contains changes")
        .closest("[data-slot=tree-row]")
        ?.hasAttribute("data-drop-target"),
    ).toBe(true);
    fireDrag("drop", row, data, { clientY: index * H + 2 });
    fireDrag("dragEnd", item("README.md"), data);
    layout.restore();
    expect(onMove).toHaveBeenCalledWith([["README.md", "src/README.md"]]);
  });
});

describe("FileTree, selected", () => {
  const key = (el: Element, k: string, init: KeyboardEventInit = {}) =>
    fireEvent.keyDown(el, { key: k, ...init });
  const selectedLabels = () =>
    screen
      .queryAllByRole("treeitem")
      .filter((el) => el.getAttribute("aria-selected") === "true")
      .map((el) => el.querySelector("[data-slot=tree-label]")?.textContent);

  it("takes paths, a merged folder's standing for its row, and hands back row ids", () => {
    const onSelectedChange = vi.fn();
    render(
      renderFiles({
        selectable: true,
        defaultSelected: [".github/", "README.md"],
        onSelectedChange,
      }),
    );
    expect(selectedLabels()).toEqual([".github / workflows", "README.md"]);
    key(item("dist, Ignored"), " ");
    expect(onSelectedChange).toHaveBeenLastCalledWith([
      ".github/workflows/",
      "dist/",
      "README.md",
    ]);
  });

  it("moves the selection as one, pair by pair", () => {
    const onMove = vi.fn();
    render(
      renderFiles({
        selectable: true,
        onMove,
        defaultExpanded: ["src/"],
        defaultSelected: ["src/retry.ts", "README.md"],
      }),
    );
    key(item("README.md"), "x", { ctrlKey: true });
    key(item("docs, Contains changes"), "v", { ctrlKey: true });
    expect(onMove).toHaveBeenCalledWith([
      ["src/retry.ts", "docs/retry.ts"],
      ["README.md", "docs/README.md"],
    ]);
  });

  it("refuses a move that would give two of the group one name", () => {
    const onMove = vi.fn();
    render(
      renderFiles({
        selectable: true,
        onMove,
        paths: [...PATHS, "docs/retry.ts"],
        defaultExpanded: ["src/", "docs/"],
        defaultSelected: ["src/retry.ts", "docs/retry.ts"],
      }),
    );
    key(item("retry.ts, Added"), "x", { ctrlKey: true });
    key(item("dist, Ignored"), "v", { ctrlKey: true });
    expect(onMove).not.toHaveBeenCalled();
  });

  it("keeps an open folder open, and selected, under its new path", () => {
    function Files() {
      const [paths, setPaths] = React.useState(PATHS);
      const [selected, setSelected] = React.useState<string[]>([
        "src/",
        "README.md",
      ]);
      return renderFiles({
        paths,
        selectable: true,
        selected,
        onSelectedChange: setSelected,
        defaultExpanded: ["src/", "docs/"],
        onMove: (moves) =>
          setPaths((list) =>
            list.map((p) =>
              moves.reduce((q, [from, to]) => movePath(q, from, to), p),
            ),
          ),
      });
    }
    render(<Files />);
    key(item("README.md"), "x", { ctrlKey: true });
    key(item("docs, Contains changes"), "v", { ctrlKey: true });
    expect(item("docs, Contains changes").getAttribute("aria-expanded")).toBe(
      "true",
    );
    // The status stays the app's to move: src's is not.
    expect(item("src").getAttribute("aria-expanded")).toBe("true");
    // In an open folder, the moved rows show, and stay selected.
    expect(selectedLabels()).toEqual(["src", "README.md"]);
  });
});

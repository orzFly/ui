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
import type { FileStatus } from "../src/lib/file-tree.ts";
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

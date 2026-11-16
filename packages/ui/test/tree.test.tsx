import { act, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Tree,
  TreeCount,
  type TreeHandle,
  TreeItem,
  TreeLabel,
} from "../src/components/tree.tsx";
import type { TreeNode } from "../src/lib/tree-rows.ts";
import { H, type Layout, stubLayout, VIEWPORT } from "./stub-tree-layout.ts";

interface Node extends TreeNode<Node> {
  name: string;
  /** A grouping node, with no place of its own. */
  group?: boolean;
}

const n = (id: string, children?: Node[], extra: Partial<Node> = {}): Node => ({
  id,
  name: id,
  children,
  ...extra,
});

// src
//   components
//     button
//     dialog
//   lib
//     utils
// archive (grouping)
//   old
// lazy (not loaded)
// readme
const ITEMS: Node[] = [
  n("src", [
    n("components", [n("button"), n("dialog")]),
    n("lib", [n("utils")]),
  ]),
  n("archive", [n("old")], { group: true }),
  n("lazy", undefined, { hasChildren: true }),
  n("readme"),
];

type Props = Partial<React.ComponentProps<typeof Tree<Node>>> & {
  onItemClick?: (event: React.MouseEvent) => void;
  target?: string;
};

function renderTree({ onItemClick, target, ...props }: Props = {}) {
  return (
    <Tree aria-label="Files" items={ITEMS} {...props}>
      {(item) =>
        item.group ? (
          <TreeItem>
            <TreeLabel>{item.name}</TreeLabel>
          </TreeItem>
        ) : (
          <TreeItem href={`#${item.id}`} onClick={onItemClick} target={target}>
            <TreeLabel>{item.name}</TreeLabel>
            {item.children && <TreeCount>{item.children.length}</TreeCount>}
          </TreeItem>
        )
      }
    </Tree>
  );
}

const item = (name: string) => screen.getByRole("treeitem", { name });
const items = () =>
  screen
    .queryAllByRole("treeitem")
    .map((el) => el.querySelector("[data-slot=tree-label]")?.textContent);
const toggleOf = (name: string) =>
  item(name)
    .closest("[data-slot=tree-row]")
    ?.querySelector("[data-slot=tree-toggle]") as HTMLElement;
const key = (el: Element, k: string) => fireEvent.keyDown(el, { key: k });

describe("Tree", () => {
  describe("ARIA", () => {
    it("is a named tree of placed treeitems", () => {
      render(renderTree({ defaultExpanded: ["src"] }));
      const tree = screen.getByRole("tree");
      expect(tree.getAttribute("aria-label")).toBe("Files");
      const lib = item("lib 1");
      expect(lib.getAttribute("aria-level")).toBe("2");
      expect(lib.getAttribute("aria-posinset")).toBe("2");
      expect(lib.getAttribute("aria-setsize")).toBe("2");
      expect(item("src 2").getAttribute("aria-level")).toBe("1");
      expect(item("src 2").getAttribute("aria-setsize")).toBe("4");
    });

    it("says whether a branch is open, and nothing for a leaf", () => {
      render(renderTree({ defaultExpanded: ["src"] }));
      expect(item("src 2").getAttribute("aria-expanded")).toBe("true");
      expect(item("lib 1").getAttribute("aria-expanded")).toBe("false");
      expect(item("lazy").getAttribute("aria-expanded")).toBe("false");
      expect(item("readme").hasAttribute("aria-expanded")).toBe(false);
    });

    it("marks the current place with its token, page by default", () => {
      const { rerender } = render(renderTree({ current: "readme" }));
      expect(item("readme").getAttribute("aria-current")).toBe("page");
      expect(item("lazy").hasAttribute("aria-current")).toBe(false);
      rerender(renderTree({ current: "readme", currentToken: "location" }));
      expect(item("readme").getAttribute("aria-current")).toBe("location");
    });

    it("renders a link for a place and a div for a grouping node", () => {
      render(renderTree());
      expect(item("readme").tagName).toBe("A");
      expect(item("readme").getAttribute("href")).toBe("#readme");
      expect(item("archive").tagName).toBe("DIV");
    });

    it("renders the element given with asChild", () => {
      render(
        <Tree aria-label="Files" items={ITEMS}>
          {(node) => (
            <TreeItem asChild>
              <button type="button">{node.name}</button>
            </TreeItem>
          )}
        </Tree>,
      );
      expect(item("readme").tagName).toBe("BUTTON");
    });

    it("throws outside a Tree's row", () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      expect(() => render(<TreeItem href="#">x</TreeItem>)).toThrow(
        "TreeItem renders inside a Tree's row",
      );
      vi.restoreAllMocks();
    });
  });

  describe("the tab stop", () => {
    const stops = () =>
      screen.getAllByRole("treeitem").filter((el) => el.tabIndex === 0);

    it("is one, on the current place", () => {
      render(renderTree({ current: "dialog" }));
      expect(stops()).toEqual([item("dialog")]);
    });

    it("falls to the first row when the current place is filtered out", () => {
      render(
        renderTree({
          current: "dialog",
          filter: (node) => node.name === "readme",
        }),
      );
      expect(items()).toEqual(["readme"]);
      expect(stops()).toEqual([item("readme")]);
    });
  });

  describe("keyboard", () => {
    it("moves down and up, and to the ends", () => {
      render(renderTree({ defaultExpanded: ["src"] }));
      item("src 2").focus();
      key(item("src 2"), "ArrowDown");
      expect(document.activeElement).toBe(item("components 2"));
      key(item("components 2"), "ArrowUp");
      expect(document.activeElement).toBe(item("src 2"));
      key(item("src 2"), "End");
      expect(document.activeElement).toBe(item("readme"));
      key(item("readme"), "Home");
      expect(document.activeElement).toBe(item("src 2"));
    });

    it("opens with →, then goes into the first child", () => {
      render(renderTree());
      item("src 2").focus();
      key(item("src 2"), "ArrowRight");
      expect(item("src 2").getAttribute("aria-expanded")).toBe("true");
      expect(document.activeElement).toBe(item("src 2"));
      key(item("src 2"), "ArrowRight");
      expect(document.activeElement).toBe(item("components 2"));
      // A leaf does nothing.
      key(item("readme"), "ArrowRight");
      expect(item("readme").hasAttribute("aria-expanded")).toBe(false);
    });

    it("closes with ←, then goes to the parent", () => {
      render(renderTree({ defaultExpanded: ["src", "components"] }));
      item("components 2").focus();
      key(item("components 2"), "ArrowLeft");
      expect(item("components 2").getAttribute("aria-expanded")).toBe("false");
      key(item("components 2"), "ArrowLeft");
      expect(document.activeElement).toBe(item("src 2"));
    });

    it("opens every sibling with *", () => {
      render(renderTree({ defaultExpanded: ["src"] }));
      key(item("components 2"), "*");
      expect(item("components 2").getAttribute("aria-expanded")).toBe("true");
      expect(item("lib 1").getAttribute("aria-expanded")).toBe("true");
      // The roots are not its siblings.
      expect(item("lazy").getAttribute("aria-expanded")).toBe("false");
    });

    it("jumps to the next row starting with what is typed", () => {
      render(renderTree({ defaultExpanded: ["src"] }));
      item("src 2").focus();
      key(item("src 2"), "l");
      expect(document.activeElement).toBe(item("lib 1"));
      key(item("lib 1"), "a");
      expect(document.activeElement).toBe(item("lazy"));
    });

    it("wraps round to the top", () => {
      render(renderTree({ defaultExpanded: ["src"] }));
      item("readme").focus();
      key(item("readme"), "c");
      expect(document.activeElement).toBe(item("components 2"));
    });
  });

  it("opens and closes a grouping node on a click and on Enter", () => {
    render(renderTree());
    fireEvent.click(item("archive"));
    expect(item("archive").getAttribute("aria-expanded")).toBe("true");
    expect(items()).toContain("old");
    fireEvent.click(item("archive"));
    expect(item("archive").getAttribute("aria-expanded")).toBe("false");
    key(item("archive"), "Enter");
    expect(item("archive").getAttribute("aria-expanded")).toBe("true");
  });

  describe("a branch that is a place", () => {
    it("opens on a plain click and never closes on one", () => {
      render(renderTree());
      fireEvent.click(item("src 2"));
      expect(item("src 2").getAttribute("aria-expanded")).toBe("true");
      fireEvent.click(item("src 2"));
      expect(item("src 2").getAttribute("aria-expanded")).toBe("true");
    });

    it("opens when the caller's own click handler took the click", () => {
      render(renderTree({ onItemClick: (event) => event.preventDefault() }));
      fireEvent.click(item("src 2"));
      expect(item("src 2").getAttribute("aria-expanded")).toBe("true");
    });

    it.each([
      ["a ctrl click", { ctrlKey: true }],
      ["a meta click", { metaKey: true }],
      ["a middle click", { button: 1 }],
    ])("stays closed on %s", (_, init) => {
      render(renderTree());
      fireEvent.click(item("src 2"), init);
      expect(item("src 2").getAttribute("aria-expanded")).toBe("false");
    });

    it("stays closed when the link opens elsewhere", () => {
      // Taken by the test, or happy-dom would open the new tab.
      render(
        renderTree({
          target: "_blank",
          onItemClick: (event) => event.preventDefault(),
        }),
      );
      fireEvent.click(item("src 2"));
      expect(item("src 2").getAttribute("aria-expanded")).toBe("false");
    });
  });

  describe("the toggle", () => {
    it("opens and closes without clicking the item", () => {
      const onItemClick = vi.fn();
      render(renderTree({ onItemClick }));
      fireEvent.click(toggleOf("src 2"));
      expect(item("src 2").getAttribute("aria-expanded")).toBe("true");
      fireEvent.click(toggleOf("src 2"));
      expect(item("src 2").getAttribute("aria-expanded")).toBe("false");
      expect(onItemClick).not.toHaveBeenCalled();
    });

    it("moves the focus out of a branch it closes onto the branch", () => {
      render(renderTree({ defaultExpanded: ["src", "components"] }));
      item("dialog").focus();
      fireEvent.click(toggleOf("src 2"));
      expect(items()).not.toContain("dialog");
      expect(document.activeElement).toBe(item("src 2"));
    });
  });

  describe("opening to the current place", () => {
    it("is open in the first render when uncontrolled", () => {
      const html = renderToString(renderTree({ current: "dialog" }));
      expect(html).toContain("#dialog");
      render(renderTree({ current: "dialog" }));
      expect(items()).toContain("dialog");
    });

    it("opens the way to a new current place", () => {
      const { rerender } = render(renderTree({ current: "readme" }));
      expect(items()).not.toContain("utils");
      rerender(renderTree({ current: "utils" }));
      expect(items()).toContain("utils");
    });

    it("leaves a branch the reader closed until the current place moves", () => {
      const { rerender } = render(renderTree({ current: "dialog" }));
      fireEvent.click(toggleOf("src 2"));
      rerender(renderTree({ current: "dialog", currentToken: "location" }));
      expect(items()).not.toContain("dialog");
    });

    it("hands a controlled tree the set with the ancestors added", () => {
      const onExpandedChange = vi.fn();
      const { rerender } = render(
        renderTree({ expanded: ["lazy"], onExpandedChange }),
      );
      rerender(
        renderTree({ expanded: ["lazy"], onExpandedChange, current: "button" }),
      );
      expect(onExpandedChange).toHaveBeenLastCalledWith([
        "lazy",
        "src",
        "components",
      ]);
    });
  });

  describe("a branch loading its children", () => {
    it("asks for them, and shows a loading row meanwhile", () => {
      const onExpandedChange = vi.fn();
      render(renderTree({ onExpandedChange, loadingLabel: "Fetching" }));
      fireEvent.click(toggleOf("lazy"));
      expect(onExpandedChange).toHaveBeenLastCalledWith(["lazy"]);
      expect(item("lazy").getAttribute("aria-busy")).toBe("true");
      const loading = screen.getByRole("treeitem", { name: "Fetching" });
      expect(loading.getAttribute("aria-disabled")).toBe("true");
      expect(loading.getAttribute("aria-level")).toBe("2");
    });

    it("skips the loading row with ↓", () => {
      render(renderTree({ defaultExpanded: ["lazy"] }));
      item("lazy").focus();
      key(item("lazy"), "ArrowDown");
      expect(document.activeElement).toBe(item("readme"));
    });
  });

  describe("a filter", () => {
    const filter = (node: Node) => node.name === "dialog";

    it("shows the matches and their ancestors alone", () => {
      render(renderTree({ filter }));
      expect(items()).toEqual(["src", "components", "dialog"]);
    });

    it("leaves the toggles alone, and the reader's branches for after", () => {
      const { rerender } = render(
        renderTree({ filter, defaultExpanded: ["lib"] }),
      );
      fireEvent.click(toggleOf("src 2"));
      expect(items()).toEqual(["src", "components", "dialog"]);
      rerender(renderTree({ defaultExpanded: ["lib"] }));
      expect(items()).toEqual(["src", "archive", "lazy", "readme"]);
      act(() => fireEvent.click(toggleOf("src 2")));
      expect(items()).toContain("utils");
    });

    it("marks the matching rows", () => {
      render(renderTree({ filter }));
      const matched = document.querySelectorAll(
        "[data-slot=tree-row][data-match]",
      );
      expect([...matched].map((el) => el.textContent)).toEqual(["dialog"]);
    });
  });

  describe("a filter that keeps every row", () => {
    const filter = (node: Node) => node.name === "dialog";

    it("opens the matches' ancestors on top of the reader's branches with expand", () => {
      render(
        renderTree({
          filter,
          filterMode: "expand",
          defaultExpanded: ["archive"],
        }),
      );
      expect(items()).toEqual([
        "src",
        "components",
        "button",
        "dialog",
        "lib",
        "archive",
        "old",
        "lazy",
        "readme",
      ]);
    });

    it("opens only the matches' ancestors with collapse", () => {
      render(
        renderTree({
          filter,
          filterMode: "collapse",
          defaultExpanded: ["archive"],
        }),
      );
      expect(items()).toEqual([
        "src",
        "components",
        "button",
        "dialog",
        "lib",
        "archive",
        "lazy",
        "readme",
      ]);
    });

    it.each(["expand", "collapse"] as const)(
      "lets the reader open and close branches in %s mode, for the search alone",
      (filterMode) => {
        const onExpandedChange = vi.fn();
        const { rerender } = render(
          renderTree({ filter, filterMode, onExpandedChange }),
        );
        fireEvent.click(toggleOf("components 2"));
        expect(items()).not.toContain("button");
        item("lib 1").focus();
        act(() => key(item("lib 1"), "ArrowRight"));
        expect(items()).toContain("utils");
        act(() => key(item("lib 1"), "ArrowLeft"));
        expect(items()).not.toContain("utils");
        act(() => key(item("lib 1"), "*"));
        expect(items()).toContain("utils");
        expect(items()).toContain("button");
        expect(onExpandedChange).not.toHaveBeenCalled();
        rerender(renderTree({ filterMode, onExpandedChange }));
        expect(items()).toEqual(["src", "archive", "lazy", "readme"]);
        expect(onExpandedChange).not.toHaveBeenCalled();
      },
    );

    it("does the same for a controlled tree", () => {
      const onExpandedChange = vi.fn();
      const { rerender } = render(
        renderTree({
          filter,
          filterMode: "expand",
          expanded: ["archive"],
          onExpandedChange,
        }),
      );
      fireEvent.click(toggleOf("archive"));
      expect(items()).not.toContain("old");
      fireEvent.click(toggleOf("lib 1"));
      expect(items()).toContain("utils");
      expect(onExpandedChange).not.toHaveBeenCalled();
      rerender(
        renderTree({
          expanded: ["archive"],
          onExpandedChange,
          filterMode: "expand",
        }),
      );
      expect(items()).toEqual(["src", "archive", "old", "lazy", "readme"]);
    });

    it("tells the app to load a branch the reader opens while searching", () => {
      const onExpandedChange = vi.fn();
      render(renderTree({ filter, filterMode: "collapse", onExpandedChange }));
      fireEvent.click(toggleOf("lazy"));
      expect(onExpandedChange).toHaveBeenCalledTimes(1);
      expect(onExpandedChange).toHaveBeenLastCalledWith(["lazy"]);
      expect(screen.getByRole("treeitem", { name: "Loading…" })).toBeTruthy();
    });

    it("starts each new filter function from the matches again", () => {
      const { rerender } = render(
        renderTree({ filter, filterMode: "collapse" }),
      );
      fireEvent.click(toggleOf("lib 1"));
      expect(items()).toContain("utils");
      rerender(
        renderTree({
          filter: (node) => node.name === "dialog",
          filterMode: "collapse",
        }),
      );
      expect(items()).not.toContain("utils");
      expect(items()).toContain("dialog");
    });

    it("puts the tab stop on the first match when the current place is no match", () => {
      render(renderTree({ filter, filterMode: "collapse", current: "readme" }));
      const stops = screen
        .getAllByRole("treeitem")
        .filter((el) => el.tabIndex === 0);
      expect(stops).toEqual([item("readme")]);
    });

    it("puts the tab stop on the first match with no current place", () => {
      render(renderTree({ filter, filterMode: "collapse" }));
      const stops = screen
        .getAllByRole("treeitem")
        .filter((el) => el.tabIndex === 0);
      expect(stops).toEqual([item("dialog")]);
    });

    it("tells the render function which rows match", () => {
      const seen: string[] = [];
      render(
        <Tree
          aria-label="Files"
          items={ITEMS}
          filter={filter}
          filterMode="expand"
        >
          {(node, row) => {
            if (row.match) seen.push(node.id);
            return (
              <TreeItem href={`#${node.id}`}>
                <TreeLabel>{node.name}</TreeLabel>
              </TreeItem>
            );
          }}
        </Tree>,
      );
      expect([...new Set(seen)]).toEqual(["dialog"]);
    });
  });

  it("renders on the server, opened to the current place", () => {
    const html = renderToString(renderTree({ current: "utils" }));
    for (const id of ["src", "lib", "utils"]) {
      expect(html).toContain(`href="#${id}"`);
    }
    expect(html).not.toContain(`href="#button"`);
    expect(html).toContain('aria-current="page"');
  });
});

// Twenty folders of 49 files each, all open, then a lone "zebra": 1001 rows.
const BIG: Node[] = [
  ...Array.from({ length: 20 }, (_, f) =>
    n(
      `f${f}`,
      Array.from({ length: 49 }, (_, i) => n(`f${f}.${i}`)),
      { name: `folder ${f}` },
    ),
  ),
  n("zebra"),
];
const BIG_OPEN = BIG.flatMap((node) => (node.children ? [node.id] : []));
/** The row index of `f<f>.<i>`. */
const at = (f: number, i: number) => f * 50 + 1 + i;

// Five roots, three branches under each, three under each of those, ten
// files under each of those: 103 rows a root.
const deepIds: string[] = [];
const deepNode = (id: string, depth: number): Node => {
  if (depth === 3) return n(id);
  deepIds.push(id);
  const count = depth === 2 ? 10 : 3;
  return n(
    id,
    Array.from({ length: count }, (_, i) => deepNode(`${id}.${i}`, depth + 1)),
  );
};
const DEEP = Array.from({ length: 5 }, (_, i) => deepNode(`d${i}`, 0));

describe("Tree, scrolled", () => {
  let layout: Layout;
  beforeEach(() => {
    layout = stubLayout();
  });
  afterEach(() => layout.restore());

  const scroller = () =>
    document.querySelector("[data-scroller]") as HTMLElement;
  const scrollTo = (top: number) => {
    act(() => {
      layout.state.scrollTop = top;
      fireEvent.scroll(scroller());
    });
  };
  const mounted = () =>
    [
      ...document.querySelectorAll<HTMLElement>(
        "[data-slot=tree-row]:not([data-pinned])",
      ),
    ].map((el) => Number(el.dataset.index));
  const gaps = () =>
    [...document.querySelectorAll<HTMLElement>("[data-slot=tree-gap]")].map(
      (el) => Number(/\*\s*(\d+)/.exec(el.style.height)?.[1]),
    );
  const rowItem = (index: number) =>
    document.querySelector(
      `[data-slot=tree-row][data-index="${index}"] [data-slot=tree-item]`,
    ) as HTMLElement;
  const range = (start: number, end: number) =>
    Array.from({ length: end - start }, (_, i) => start + i);

  function big(props: Props = {}, inScroller = true) {
    const tree = (
      <Tree
        aria-label="Files"
        items={BIG}
        defaultExpanded={BIG_OPEN}
        {...props}
      >
        {(node) => (
          <TreeItem href={`#${node.id}`}>
            <TreeLabel>{node.name}</TreeLabel>
          </TreeItem>
        )}
      </Tree>
    );
    return inScroller ? (
      <div data-scroller="" style={{ overflowY: "auto" }}>
        {tree}
      </div>
    ) : (
      tree
    );
  }

  describe("virtualized", () => {
    it("mounts the rows on screen and the overscan, a gap standing for the rest", () => {
      render(big());
      expect(screen.getByRole("tree").hasAttribute("data-virtual")).toBe(true);
      expect(mounted()).toEqual(range(0, 20));
      expect(gaps()).toEqual([1001 - 20]);
    });

    it("follows the scroll", () => {
      render(big());
      scrollTo(5000);
      // The tab stop stays mounted, at the top.
      expect(mounted()).toEqual([0, ...range(490, 520)]);
      expect(gaps()).toEqual([489, 1001 - 520]);
    });

    it("keeps the current place mounted wherever it is, in its order", () => {
      render(big({ current: "f14.0", revealCurrent: false }));
      expect(mounted()).toEqual([...range(0, 20), at(14, 0)]);
      const rows = [
        ...document.querySelectorAll<HTMLElement>("[data-slot=tree-row]"),
      ];
      expect(rows.at(-1)?.dataset.index).toBe(String(at(14, 0)));
    });

    it("mounts every row with virtualize off, and splits a small tree with it on", () => {
      const { unmount } = render(big({ virtualize: false }));
      expect(mounted()).toHaveLength(1001);
      expect(gaps()).toEqual([]);
      unmount();
      render(big({ virtualize: true, defaultExpanded: [] }));
      expect(mounted()).toEqual(range(0, 20));
      expect(gaps()).toEqual([1]);
      expect(screen.getByRole("tree").hasAttribute("data-virtual")).toBe(true);
    });

    it("renders the first rows and the current place on the server, with no pins", () => {
      const html = renderToString(
        big({ current: "f14.0", stickyBranches: true }),
      );
      const indexes = [...html.matchAll(/data-index="(\d+)"/g)].map((m) =>
        Number(m[1]),
      );
      expect(indexes).toEqual([...range(0, 40), at(14, 0)]);
      expect(html).not.toContain("tree-pins");
    });
  });

  describe("the keyboard", () => {
    it("goes to the last row with End, mounting it and scrolling to it", () => {
      render(big());
      rowItem(0).focus();
      key(rowItem(0), "End");
      expect(document.activeElement).toBe(item("zebra"));
      expect(layout.state.scrollTop).toBe(1000 * H + H - VIEWPORT);
    });

    it("scrolls a row on with ↓ as it passes the bottom", () => {
      render(big());
      rowItem(9).focus();
      key(rowItem(9), "ArrowDown");
      expect(document.activeElement).toBe(rowItem(10));
      expect(layout.state.scrollTop).toBe(H);
    });

    it("keeps the focused row mounted and focused when scrolled away", () => {
      render(big());
      rowItem(3).focus();
      const focused = document.activeElement;
      scrollTo(5000);
      expect(mounted()).toContain(3);
      expect(document.activeElement).toBe(focused);
    });

    it("jumps to an unmounted row by its textValue", () => {
      render(big({ textValue: (node) => node.name }));
      rowItem(0).focus();
      key(rowItem(0), "z");
      expect(document.activeElement).toBe(item("zebra"));
    });

    it("keeps a row it moves to clear of the pins", () => {
      render(
        <div data-scroller="" style={{ overflowY: "auto" }}>
          <Tree
            aria-label="Deep"
            items={DEEP}
            defaultExpanded={deepIds}
            stickyBranches
          >
            {(node) => (
              <TreeItem href={`#${node.id}`}>
                <TreeLabel>{node.name}</TreeLabel>
              </TreeItem>
            )}
          </Tree>
        </div>,
      );
      scrollTo(25);
      rowItem(6).focus();
      key(rowItem(6), "ArrowUp");
      expect(document.activeElement).toBe(rowItem(5));
      // Row 5 has three ancestors pinned above it.
      expect(layout.state.scrollTop).toBe(5 * H - 3 * H);
    });
  });

  describe("the current place", () => {
    it("scrolls into sight on mount, and stays put when in sight", () => {
      const { unmount } = render(big({ current: "f10.0" }));
      expect(layout.state.scrollTop).toBe(at(10, 0) * H + H - VIEWPORT);
      unmount();
      layout.state.scrollTop = 0;
      render(big({ current: "f0.3" }));
      expect(layout.state.scrollTop).toBe(0);
    });

    it("scrolls to a new current place, unless revealCurrent is off", () => {
      const { rerender } = render(big({ current: "f0.0" }));
      rerender(big({ current: "f2.0" }));
      expect(layout.state.scrollTop).toBe(at(2, 0) * H + H - VIEWPORT);
      rerender(big({ current: "f5.0", revealCurrent: false }));
      expect(layout.state.scrollTop).toBe(at(2, 0) * H + H - VIEWPORT);
    });

    it("never scrolls the page itself, which scrollToItem does", () => {
      const handle = React.createRef<TreeHandle>();
      const { rerender } = render(big({ current: "f0.0", handle }, false));
      rerender(big({ current: "f12.0", handle }, false));
      expect(layout.scrollBy).not.toHaveBeenCalled();
      act(() => handle.current?.scrollToItem("f12.0"));
      expect(layout.scrollBy).toHaveBeenCalledTimes(1);
    });
  });

  describe("scrollToItem", () => {
    it("opens the way to the row, then scrolls to it", () => {
      const handle = React.createRef<TreeHandle>();
      const onExpandedChange = vi.fn();
      const { rerender } = render(
        big({ expanded: [], onExpandedChange, handle }),
      );
      act(() => handle.current?.scrollToItem("f5.20"));
      expect(onExpandedChange).toHaveBeenLastCalledWith(["f5"]);
      expect(layout.state.scrollTop).toBe(0);
      rerender(big({ expanded: ["f5"], onExpandedChange, handle }));
      // f5 is the sixth root; f5.20 the 21st row below it.
      expect(layout.state.scrollTop).toBe((5 + 1 + 20) * H + H - VIEWPORT);
    });

    it("puts the row at the top or the middle", () => {
      const handle = React.createRef<TreeHandle>();
      render(big({ handle }));
      act(() => handle.current?.scrollToItem("f3.0", "start"));
      expect(layout.state.scrollTop).toBe(at(3, 0) * H);
      act(() => handle.current?.scrollToItem("f6.0", "center"));
      expect(layout.state.scrollTop).toBe(at(6, 0) * H - (VIEWPORT - H) / 2);
    });

    it("does nothing for an unknown id, and never moves the focus", () => {
      const handle = React.createRef<TreeHandle>();
      render(big({ handle }));
      rowItem(2).focus();
      act(() => handle.current?.scrollToItem("nowhere"));
      expect(layout.state.scrollTop).toBe(0);
      act(() => handle.current?.scrollToItem("f8.8"));
      expect(layout.state.scrollTop).toBeGreaterThan(0);
      expect(document.activeElement).toBe(rowItem(2));
    });
  });

  describe("sticky branches", () => {
    function deep(
      props: Partial<React.ComponentProps<typeof Tree<Node>>> = {},
    ) {
      return (
        <div data-scroller="" style={{ overflowY: "auto" }}>
          <Tree
            aria-label="Deep"
            items={DEEP}
            defaultExpanded={deepIds}
            stickyBranches
            {...props}
          >
            {(node, row) => (
              <TreeItem
                href={`#${node.id}`}
                data-pinned-state={row.pinned ? "" : undefined}
              >
                <TreeLabel>{node.name}</TreeLabel>
              </TreeItem>
            )}
          </Tree>
        </div>
      );
    }
    const pins = () =>
      [...document.querySelectorAll<HTMLElement>("[data-slot=tree-pin]")].map(
        (el) => ({
          name: el.querySelector("[data-slot=tree-label]")?.textContent,
          top: Number.parseFloat(el.style.top),
        }),
      );
    const pinToggle = (name: string) =>
      [...document.querySelectorAll("[data-slot=tree-pin]")]
        .find((el) => el.textContent === name)
        ?.querySelector("[data-slot=tree-toggle]") as HTMLElement;

    it("pins each open branch above the rows on screen, out of the tree's semantics", () => {
      render(deep());
      scrollTo(25);
      expect(pins()).toEqual([
        { name: "d0", top: 0 },
        { name: "d0.0", top: 10 },
        { name: "d0.0.0", top: 20 },
      ]);
      const layer = document.querySelector("[data-slot=tree-pins]");
      expect(layer?.getAttribute("aria-hidden")).toBe("true");
      const copies = layer?.querySelectorAll<HTMLElement>(
        "[data-slot=tree-item]",
      );
      expect(copies).toHaveLength(3);
      for (const copy of copies ?? []) {
        expect(copy.hasAttribute("role")).toBe(false);
        expect(copy.tabIndex).toBe(-1);
        expect(copy.hasAttribute("data-pinned-state")).toBe(true);
      }
      expect(screen.getAllByRole("treeitem")).toHaveLength(mounted().length);
    });

    it("lets the next branch push the deepest pin up", () => {
      render(deep());
      scrollTo(105);
      expect(pins().at(-1)).toEqual({ name: "d0.0.0", top: 15 });
    });

    it("closes from a pin's toggle, leaving the branch's row where the pin was", () => {
      const onExpandedChange = vi.fn();
      render(deep({ onExpandedChange }));
      // d1 is row 103, d1.0 104, d1.0.0 105.
      scrollTo(1065);
      expect(pins().at(-1)).toEqual({ name: "d1.0.0", top: 20 });
      fireEvent.click(pinToggle("d1.0.0"));
      const last = onExpandedChange.mock.lastCall?.[0] as string[];
      expect(last).not.toContain("d1.0.0");
      expect(last).toContain("d1.0");
      expect(layout.state.scrollTop).toBe(105 * H - 20);
    });

    it("clicks through a pin's link as through the row's own", () => {
      const onClick = vi.fn((event: React.MouseEvent) =>
        event.preventDefault(),
      );
      render(
        <div data-scroller="" style={{ overflowY: "auto" }}>
          <Tree
            aria-label="Deep"
            items={DEEP}
            defaultExpanded={deepIds}
            stickyBranches
          >
            {(node) => (
              <TreeItem href={`#${node.id}`} onClick={onClick}>
                <TreeLabel>{node.name}</TreeLabel>
              </TreeItem>
            )}
          </Tree>
        </div>,
      );
      scrollTo(25);
      const copy = document.querySelector(
        "[data-slot=tree-pin] [data-slot=tree-item]",
      ) as HTMLElement;
      expect(copy.getAttribute("href")).toBe("#d0");
      fireEvent.click(copy);
      expect(onClick).toHaveBeenCalledTimes(1);
      // A place's click opens and never closes, so the branch stays.
      expect(pins()[0]).toEqual({ name: "d0", top: 0 });
    });

    it("pins nothing without stickyBranches", () => {
      render(deep({ stickyBranches: false }));
      scrollTo(25);
      expect(document.querySelector("[data-slot=tree-pins]")).toBeNull();
    });
  });
});

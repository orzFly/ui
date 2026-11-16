import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DropdownMenuItem } from "../src/components/dropdown-menu.tsx";
import {
  Tree,
  TreeCount,
  type TreeHandle,
  TreeItem,
  TreeLabel,
  type TreeMenuActions,
} from "../src/components/tree.tsx";
import {
  moveNodes,
  type TreeMoveTarget,
  type TreeNode,
} from "../src/lib/tree-rows.ts";
import { FakeDataTransfer, fireDrag } from "./fake-data-transfer.ts";
import {
  H,
  type Layout,
  stubIcons,
  stubLayout,
  VIEWPORT,
} from "./stub-tree-layout.ts";

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
  /** Leads each place with an icon. */
  icons?: boolean;
};

function renderTree({ onItemClick, target, icons, ...props }: Props = {}) {
  return (
    <Tree aria-label="Files" items={ITEMS} {...props}>
      {(item) =>
        item.group ? (
          <TreeItem>
            <TreeLabel>{item.name}</TreeLabel>
          </TreeItem>
        ) : (
          <TreeItem href={`#${item.id}`} onClick={onItemClick} target={target}>
            {icons && <svg aria-hidden data-icon="" />}
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

/** The tree with `id` named `name`, under its old id or `next`. */
function renamed(
  nodes: readonly Node[],
  id: string,
  name: string,
  next = id,
): Node[] {
  return nodes.map((node) =>
    node.id === id
      ? { ...node, id: next, name }
      : node.children
        ? { ...node, children: renamed(node.children, id, name, next) }
        : node,
  );
}

const rowOf = (name: string) =>
  item(name).closest("[data-slot=tree-row]") as HTMLElement;
const field = () =>
  document.querySelector("[data-slot=tree-rename]") as HTMLInputElement | null;

describe("Tree, renamed", () => {
  it("opens a field on F2 holding the name, all of it selected, focused", () => {
    render(renderTree({ onRename: vi.fn() }));
    key(item("readme"), "F2");
    const input = field() as HTMLInputElement;
    expect(input.value).toBe("readme");
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 6]);
    expect(input.getAttribute("aria-label")).toBe("Rename readme");
    expect(rowOf("readme").hasAttribute("data-renaming")).toBe(true);
    expect(item("readme").tabIndex).toBe(-1);
  });

  it("starts from renameValue and selects what renameSelection says", () => {
    render(
      renderTree({
        onRename: vi.fn(),
        renameValue: (node) => `${node.name}.md`,
        renameSelection: () => [0, 6],
      }),
    );
    key(item("readme"), "F2");
    const input = field() as HTMLInputElement;
    expect(input.value).toBe("readme.md");
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 6]);
  });

  it("commits the trimmed name on Enter and gives the focus back to the row", () => {
    const onRename = vi.fn();
    render(renderTree({ onRename }));
    key(item("readme"), "F2");
    fireEvent.change(field() as HTMLInputElement, {
      target: { value: "  notes " },
    });
    key(field() as HTMLInputElement, "Enter");
    expect(onRename).toHaveBeenCalledWith(
      expect.objectContaining({ id: "readme" }),
      "notes",
    );
    expect(field()).toBeNull();
    expect(document.activeElement).toBe(item("readme"));
  });

  it("puts the name back on Escape, which goes no further", () => {
    const onRename = vi.fn();
    const outside = vi.fn();
    render(renderTree({ onRename }));
    key(item("readme"), "F2");
    fireEvent.change(field() as HTMLInputElement, { target: { value: "x" } });
    document.addEventListener("keydown", outside);
    key(field() as HTMLInputElement, "Escape");
    document.removeEventListener("keydown", outside);
    expect(onRename).not.toHaveBeenCalled();
    expect(outside).not.toHaveBeenCalled();
    expect(field()).toBeNull();
    expect(document.activeElement).toBe(item("readme"));
  });

  it("commits on blur, but not while the window is away", () => {
    const onRename = vi.fn();
    render(renderTree({ onRename }));
    key(item("readme"), "F2");
    fireEvent.change(field() as HTMLInputElement, { target: { value: "x" } });
    const away = vi.spyOn(document, "hasFocus").mockReturnValue(false);
    fireEvent.blur(field() as HTMLInputElement);
    expect(field()).not.toBeNull();
    away.mockReturnValue(true);
    fireEvent.blur(field() as HTMLInputElement);
    away.mockRestore();
    expect(onRename).toHaveBeenCalledWith(expect.anything(), "x");
    expect(field()).toBeNull();
  });

  it("says why a name is refused, keeps it on Enter, and puts the old one back on blur", () => {
    const onRename = vi.fn();
    render(
      renderTree({
        onRename,
        validateName: (_, name) => (name === "src" ? "Taken" : undefined),
      }),
    );
    key(item("readme"), "F2");
    const input = field() as HTMLInputElement;
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    fireEvent.change(input, { target: { value: "src" } });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const message = document.getElementById(
      input.getAttribute("aria-describedby") as string,
    );
    expect(message?.textContent).toBe("Taken");
    key(input, "Enter");
    expect(field()).not.toBeNull();
    fireEvent.blur(input);
    expect(onRename).not.toHaveBeenCalled();
    expect(field()).toBeNull();
  });

  it("puts an empty or unchanged name back without a word", () => {
    const onRename = vi.fn();
    const validateName = vi.fn(() => "never");
    render(renderTree({ onRename, validateName }));
    for (const value of ["   ", "readme"]) {
      key(item("readme"), "F2");
      fireEvent.change(field() as HTMLInputElement, { target: { value } });
      expect(field()?.hasAttribute("aria-invalid")).toBe(false);
      key(field() as HTMLInputElement, "Enter");
      expect(field()).toBeNull();
    }
    expect(onRename).not.toHaveBeenCalled();
    expect(validateName).not.toHaveBeenCalled();
  });

  it("does nothing on F2 without onRename, or where canRename says no", () => {
    const { rerender } = render(renderTree());
    key(item("readme"), "F2");
    expect(field()).toBeNull();
    rerender(
      renderTree({
        onRename: vi.fn(),
        canRename: (node) => node.id !== "readme",
      }),
    );
    key(item("readme"), "F2");
    expect(field()).toBeNull();
    key(item("lazy"), "F2");
    expect(field()).not.toBeNull();
  });

  it("puts the name back when the row leaves the screen", () => {
    const onRename = vi.fn();
    const { rerender } = render(renderTree({ onRename }));
    key(item("readme"), "F2");
    rerender(renderTree({ onRename, filter: (node) => node.id === "lazy" }));
    expect(field()).toBeNull();
    rerender(renderTree({ onRename }));
    expect(field()).toBeNull();
    expect(onRename).not.toHaveBeenCalled();
  });

  it("moves the focus to the row's new id", () => {
    function Renaming() {
      const [items, setItems] = React.useState(ITEMS);
      return renderTree({
        items,
        onRename: (node, name) => {
          setItems((list) => renamed(list, node.id, name, name));
          return name;
        },
      });
    }
    render(<Renaming />);
    key(item("readme"), "F2");
    fireEvent.change(field() as HTMLInputElement, {
      target: { value: "notes" },
    });
    key(field() as HTMLInputElement, "Enter");
    expect(document.activeElement).toBe(item("notes"));
    expect(item("notes").getAttribute("href")).toBe("#notes");
    expect(item("notes").tabIndex).toBe(0);
  });

  it("opens the way on handle.rename, then the field", () => {
    const handle = React.createRef<TreeHandle>();
    render(renderTree({ onRename: vi.fn(), handle }));
    act(() => handle.current?.rename("utils"));
    expect(field()?.value).toBe("utils");
    expect(document.activeElement).toBe(field());
    act(() => handle.current?.rename("nowhere"));
    expect(field()?.value).toBe("utils");
  });
});

const MENU = (node: Node, actions: TreeMenuActions<Node>) => (
  <>
    {actions.rename && (
      <DropdownMenuItem onSelect={actions.rename}>
        Rename {node.name}
      </DropdownMenuItem>
    )}
    {actions.cut && (
      <DropdownMenuItem onSelect={actions.cut}>Cut</DropdownMenuItem>
    )}
    {actions.paste && (
      <DropdownMenuItem onSelect={actions.paste}>Paste</DropdownMenuItem>
    )}
    <DropdownMenuItem>Delete</DropdownMenuItem>
  </>
);

const menuButton = (name: string) =>
  rowOf(name).querySelector("[data-slot=tree-row-menu]") as HTMLElement | null;

describe("Tree, a row's menu", () => {
  it("draws ⋯ only with menu, and marks the items as opening one", () => {
    const { rerender } = render(renderTree());
    expect(menuButton("readme")).toBeNull();
    expect(item("readme").hasAttribute("aria-haspopup")).toBe(false);
    rerender(renderTree({ menu: MENU }));
    expect(menuButton("readme")?.getAttribute("aria-label")).toBe(
      "Actions for readme",
    );
    expect(menuButton("readme")?.tabIndex).toBe(-1);
    expect(item("readme").getAttribute("aria-haspopup")).toBe("menu");
  });

  it("opens from ⋯, asking for the items of that row alone", () => {
    const menu = vi.fn(MENU);
    render(renderTree({ menu }));
    expect(menu).not.toHaveBeenCalled();
    fireEvent.pointerDown(menuButton("readme") as HTMLElement, {
      button: 0,
      pointerType: "mouse",
    });
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(new Set(menu.mock.calls.map(([node]) => node.id))).toEqual(
      new Set(["readme"]),
    );
  });

  it("opens on Shift+F10 and on the keyboard's contextmenu, never on a right click", () => {
    render(renderTree({ menu: MENU }));
    fireEvent.keyDown(item("readme"), { key: "F10", shiftKey: true });
    expect(screen.getByRole("menu")).toBeTruthy();
    key(screen.getByRole("menu"), "Escape");
    expect(screen.queryByRole("menu")).toBeNull();
    // A right click keeps the browser's menu: the link's.
    expect(fireEvent.contextMenu(item("lazy"), { button: 2 })).toBe(true);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(fireEvent.contextMenu(item("lazy"), { button: 0 })).toBe(false);
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("gives the focus back to the row on closing", async () => {
    render(renderTree({ menu: MENU }));
    item("readme").focus();
    key(item("readme"), "ContextMenu");
    expect(screen.getByRole("menu")).toBeTruthy();
    key(screen.getByRole("menu"), "Escape");
    await waitFor(() => expect(document.activeElement).toBe(item("readme")));
  });

  it("opens the rename field from the menu's rename", async () => {
    render(renderTree({ menu: MENU, onRename: vi.fn() }));
    key(item("readme"), "ContextMenu");
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename readme" }));
    await waitFor(() => expect(document.activeElement).toBe(field()));
    expect(field()?.value).toBe("readme");
  });

  it("offers an action only where the tree can take it", () => {
    const seen: TreeMenuActions<Node>[] = [];
    const menu = (node: Node, actions: TreeMenuActions<Node>) => {
      seen.push(actions);
      return MENU(node, actions);
    };
    const { rerender } = render(renderTree({ menu }));
    key(item("readme"), "ContextMenu");
    expect(seen.at(-1)).toEqual({
      items: [expect.objectContaining({ id: "readme" })],
      select: undefined,
      deselect: undefined,
      clearSelection: undefined,
      rename: undefined,
      cut: undefined,
      paste: undefined,
    });
    key(screen.getByRole("menu"), "Escape");
    rerender(renderTree({ menu, onRename: vi.fn(), onMove: vi.fn() }));
    key(item("readme"), "ContextMenu");
    expect(seen.at(-1)?.rename).toBeTypeOf("function");
    expect(seen.at(-1)?.cut).toBeTypeOf("function");
    // Nothing is cut yet.
    expect(seen.at(-1)?.paste).toBeUndefined();
  });
});

describe("Tree, cut and pasted", () => {
  it("marks the row on Ctrl+X and on ⌘+X, one row at a time", () => {
    render(renderTree({ onMove: vi.fn() }));
    fireEvent.keyDown(item("readme"), { key: "x", ctrlKey: true });
    expect(rowOf("readme").hasAttribute("data-cut")).toBe(true);
    fireEvent.keyDown(item("lazy"), { key: "x", metaKey: true });
    expect(rowOf("readme").hasAttribute("data-cut")).toBe(false);
    expect(rowOf("lazy").hasAttribute("data-cut")).toBe(true);
  });

  it("moves the cut row into a branch it is pasted on, last", () => {
    const onMove = vi.fn();
    render(renderTree({ onMove, defaultExpanded: ["src"] }));
    fireEvent.keyDown(item("readme"), { key: "x", ctrlKey: true });
    fireEvent.keyDown(item("lib 1"), { key: "v", ctrlKey: true });
    expect(onMove).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "readme" })],
      { parentId: "lib", index: 1, over: "lib", position: "into" },
    );
    expect(rowOf("readme").hasAttribute("data-cut")).toBe(false);
  });

  it("moves the cut row after a leaf it is pasted on", () => {
    const onMove = vi.fn();
    render(renderTree({ onMove, defaultExpanded: ["src", "components"] }));
    fireEvent.keyDown(item("readme"), { key: "x", metaKey: true });
    fireEvent.keyDown(item("button"), { key: "v", metaKey: true });
    expect(onMove).toHaveBeenCalledWith(expect.anything(), {
      parentId: "components",
      index: 1,
      over: "button",
      position: "after",
    });
  });

  it("keeps the cut when canDrop takes no place there, and drops it on Escape", () => {
    const onMove = vi.fn();
    render(renderTree({ onMove, canDrop: () => false }));
    fireEvent.keyDown(item("readme"), { key: "x", ctrlKey: true });
    fireEvent.keyDown(item("lazy"), { key: "v", ctrlKey: true });
    expect(onMove).not.toHaveBeenCalled();
    expect(rowOf("readme").hasAttribute("data-cut")).toBe(true);
    key(item("lazy"), "Escape");
    expect(rowOf("readme").hasAttribute("data-cut")).toBe(false);
  });

  it("leaves Ctrl+X to the browser where canDrag says no, and Ctrl+V with nothing cut", () => {
    render(renderTree({ onMove: vi.fn(), canDrag: () => false }));
    expect(fireEvent.keyDown(item("readme"), { key: "x", ctrlKey: true })).toBe(
      true,
    );
    expect(fireEvent.keyDown(item("readme"), { key: "v", ctrlKey: true })).toBe(
      true,
    );
  });
});

describe("Tree, dragged", () => {
  let layout: Layout;
  let data: FakeDataTransfer;
  beforeEach(() => {
    layout = stubLayout();
    data = new FakeDataTransfer();
  });
  afterEach(() => {
    const tree = document.querySelector("[data-slot=tree]");
    if (tree) fireDrag("dragEnd", tree, data);
    layout.restore();
  });

  // All open: src 0, components 1, button 2, dialog 3, lib 4, utils 5,
  // archive 6, old 7, lazy 8, loading 9, readme 10.
  const OPEN = ["src", "components", "lib", "archive", "lazy"];
  const rowAt = (index: number) =>
    document.querySelector(
      `[data-slot=tree-row][data-index="${index}"]`,
    ) as HTMLElement;
  /** A point `part` of the way down row `index`. */
  const y = (index: number, part: number) => index * H + part * H;
  const marked = (mark: string) =>
    [...document.querySelectorAll(`[data-slot=tree-row][${mark}]`)].map((el) =>
      Number(el.getAttribute("data-index")),
    );

  it("carries the row's link, and the tree's own mark", () => {
    render(renderTree({ onMove: vi.fn(), expanded: OPEN }));
    fireDrag("dragStart", item("readme"), data);
    expect(data.getData("text/uri-list")).toMatch(/#readme$/);
    expect(data.getData("text/plain")).toMatch(/#readme$/);
    expect(data.types).toContain("application/x-orz-tree");
    expect(data.effectAllowed).toBe("all");
    expect(data.image?.textContent).toBe("readme");
    expect(rowOf("readme").hasAttribute("data-dragging")).toBe(true);
  });

  it("makes a grouping node draggable, and nothing without onMove", () => {
    const { rerender } = render(renderTree({ expanded: OPEN }));
    expect(item("archive").hasAttribute("draggable")).toBe(false);
    fireDrag("dragStart", item("readme"), data);
    expect(data.types).toEqual([]);
    rerender(renderTree({ onMove: vi.fn(), expanded: OPEN }));
    expect(item("archive").getAttribute("draggable")).toBe("true");
    // A link drags as it is.
    expect(item("readme").hasAttribute("draggable")).toBe(false);
  });

  it("drops before, into or after a branch by the pointer's height", () => {
    render(renderTree({ onMove: vi.fn(), expanded: OPEN }));
    fireDrag("dragStart", item("readme"), data);
    expect(fireDrag("dragOver", rowAt(6), data, { clientY: y(6, 0.1) })).toBe(
      false,
    );
    expect(data.dropEffect).toBe("move");
    expect(marked("data-drop-before")).toEqual([6]);
    fireDrag("dragOver", rowAt(6), data, { clientY: y(6, 0.5) });
    expect(marked("data-drop-before")).toEqual([]);
    expect(marked("data-drop-target")).toEqual([6]);
    expect(marked("data-drop-inside")).toEqual([7]);
    // archive is open: below it is first among its children.
    fireDrag("dragOver", rowAt(6), data, { clientY: y(6, 0.9) });
    expect(marked("data-drop-target")).toEqual([6]);
    expect(marked("data-drop-before")).toEqual([7]);
  });

  it("drops before or after a leaf by its half", () => {
    render(renderTree({ onMove: vi.fn(), expanded: OPEN }));
    fireDrag("dragStart", item("readme"), data);
    fireDrag("dragOver", rowAt(2), data, { clientY: y(2, 0.4) });
    expect(marked("data-drop-before")).toEqual([2]);
    fireDrag("dragOver", rowAt(2), data, { clientY: y(2, 0.6) });
    expect(marked("data-drop-after")).toEqual([2]);
  });

  it("falls back to into when canDrop takes nothing else", () => {
    const onMove = vi.fn();
    render(
      renderTree({
        onMove,
        canDrop: (_, t: TreeMoveTarget) => t.position === "into",
        expanded: OPEN,
      }),
    );
    fireDrag("dragStart", item("readme"), data);
    fireDrag("dragOver", rowAt(2), data, { clientY: y(2, 0.1) });
    expect(marked("data-drop-target")).toEqual([1]);
    expect(marked("data-drop-inside")).toEqual([2, 3]);
    fireDrag("drop", rowAt(2), data, { clientY: y(2, 0.1) });
    expect(onMove).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "readme" })],
      { parentId: "components", index: 1, over: "button", position: "into" },
    );
    expect(marked("data-drop-target")).toEqual([]);
  });

  it("takes no drop into the dragged row itself", () => {
    render(renderTree({ onMove: vi.fn(), expanded: OPEN }));
    fireDrag("dragStart", item("src 2"), data);
    expect(fireDrag("dragOver", rowAt(1), data, { clientY: y(1, 0.5) })).toBe(
      true,
    );
    expect(data.dropEffect).toBe("none");
    expect(marked("data-drop-target")).toEqual([]);
  });

  it("opens a closed branch the drag rests on", () => {
    vi.useFakeTimers();
    const onExpandedChange = vi.fn();
    render(
      renderTree({ onMove: vi.fn(), expanded: ["src"], onExpandedChange }),
    );
    fireDrag("dragStart", item("readme"), data);
    // src 0, components 1, lib 2, archive 3.
    fireDrag("dragOver", rowAt(1), data, { clientY: y(1, 0.5) });
    act(() => vi.advanceTimersByTime(699));
    expect(onExpandedChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onExpandedChange).toHaveBeenCalledWith(["src", "components"]);
    vi.useRealTimers();
  });

  it("leaves another drag alone", () => {
    render(renderTree({ onMove: vi.fn(), expanded: OPEN }));
    const foreign = new FakeDataTransfer();
    foreign.setData("text/plain", "hello");
    expect(
      fireDrag("dragOver", rowAt(6), foreign, { clientY: y(6, 0.5) }),
    ).toBe(true);
    expect(marked("data-drop-target")).toEqual([]);
  });

  it("scrolls near the scroller's edge", () => {
    vi.useFakeTimers();
    render(
      <div data-scroller="" style={{ overflowY: "auto" }}>
        {renderTree({ onMove: vi.fn(), expanded: OPEN })}
      </div>,
    );
    fireDrag("dragStart", item("readme"), data);
    fireDrag("dragOver", rowAt(9), data, { clientY: VIEWPORT - 4 });
    act(() => vi.advanceTimersByTime(20));
    expect(layout.state.scrollTop).toBe(Math.ceil((36 / 40) * 18));
    fireDrag("dragEnd", item("readme"), data);
    const top = layout.state.scrollTop;
    act(() => vi.advanceTimersByTime(100));
    expect(layout.state.scrollTop).toBe(top);
    vi.useRealTimers();
  });
});

describe("Tree, selected", () => {
  let layout: Layout;
  let data: FakeDataTransfer;
  beforeEach(() => {
    layout = stubLayout();
    stubIcons();
    data = new FakeDataTransfer();
  });
  afterEach(() => {
    const tree = document.querySelector("[data-slot=tree]");
    if (tree) fireDrag("dragEnd", tree, data);
    layout.restore();
  });

  // Open src: src 0, components 1, lib 2, archive 3, lazy 4, readme 5.
  const OPEN = ["src"];
  const NAMES: Record<string, string> = {
    src: "src 2",
    components: "components 2",
    lib: "lib 1",
  };
  const row = (id: string) => item(NAMES[id] ?? id);
  // Hidden too: an open menu hides the tree from the accessibility tree.
  const selected = () =>
    screen
      .queryAllByRole("treeitem", { hidden: true })
      .filter((el) => el.getAttribute("aria-selected") === "true")
      .map((el) =>
        Number(el.closest("[data-slot=tree-row]")?.getAttribute("data-index")),
      );
  const focused = () => document.activeElement as HTMLElement;
  const press = (k: string, init: Partial<KeyboardEventInit> = {}) =>
    fireEvent.keyDown(focused(), { key: k, ...init });
  /** A click at `x` across row `id`, after a press from `pointerType`. */
  const clickAt = (
    id: string,
    x: number,
    init: Partial<MouseEventInit> = {},
    pointerType = "mouse",
  ) => {
    const el = row(id);
    const index = Number(
      el.closest("[data-slot=tree-row]")?.getAttribute("data-index"),
    );
    fireEvent.pointerDown(el, { pointerType });
    return fireEvent.click(el, {
      clientX: x,
      clientY: index * H + 5,
      detail: 1,
      ...init,
    });
  };

  describe("ARIA", () => {
    it("says the tree takes several and which rows are selected", () => {
      render(
        renderTree({
          selectable: true,
          defaultExpanded: OPEN,
          defaultSelected: ["lib"],
        }),
      );
      expect(
        screen.getByRole("tree").getAttribute("aria-multiselectable"),
      ).toBe("true");
      expect(row("lib").getAttribute("aria-selected")).toBe("true");
      expect(row("readme").getAttribute("aria-selected")).toBe("false");
      expect(rowOf("lib 1").hasAttribute("data-selected")).toBe(true);
    });

    it("says nothing, and selects nothing, unless selectable", () => {
      render(renderTree({ defaultExpanded: OPEN, defaultSelected: ["lib"] }));
      expect(
        screen.getByRole("tree").hasAttribute("aria-multiselectable"),
      ).toBe(false);
      expect(row("lib").hasAttribute("aria-selected")).toBe(false);
      expect(document.querySelector("[data-slot=tree-select]")).toBeNull();
      act(() => row("readme").focus());
      // Space is the page's, as before.
      expect(press(" ")).toBe(true);
      expect(press("ArrowUp", { shiftKey: true })).toBe(false);
      expect(focused()).toBe(row("lazy"));
    });
  });

  describe("held", () => {
    it("by the tree from defaultSelected, handed out in the order rows show", () => {
      const onSelectedChange = vi.fn();
      render(
        renderTree({
          selectable: true,
          defaultExpanded: OPEN,
          defaultSelected: ["readme"],
          onSelectedChange,
        }),
      );
      act(() => row("lib").focus());
      press(" ");
      expect(onSelectedChange).toHaveBeenLastCalledWith(["lib", "readme"]);
      expect(selected()).toEqual([2, 5]);
    });

    it("by the app with selected", () => {
      const onSelectedChange = vi.fn();
      const { rerender } = render(
        renderTree({
          selectable: true,
          defaultExpanded: OPEN,
          selected: [],
          onSelectedChange,
        }),
      );
      act(() => row("lib").focus());
      press(" ");
      expect(onSelectedChange).toHaveBeenLastCalledWith(["lib"]);
      expect(selected()).toEqual([]);
      rerender(
        renderTree({
          selectable: true,
          defaultExpanded: OPEN,
          selected: ["lib"],
          onSelectedChange,
        }),
      );
      expect(selected()).toEqual([2]);
    });

    it("hands back the rows that leave the screen, closed, filtered or gone", () => {
      const onSelectedChange = vi.fn();
      const props = {
        selectable: true,
        defaultExpanded: OPEN,
        defaultSelected: ["lib", "components", "readme"],
        onSelectedChange,
      };
      const { rerender } = render(renderTree(props));
      expect(onSelectedChange).not.toHaveBeenCalled();
      act(() => row("components").focus());
      // Closing src takes components and lib out of sight.
      key(row("src"), "ArrowLeft");
      expect(onSelectedChange).toHaveBeenLastCalledWith(["readme"]);
      key(row("src"), "ArrowRight");
      expect(selected()).toEqual([5]);
      act(() => row("lib").focus());
      press(" ");
      rerender(
        renderTree({ ...props, filter: (node: Node) => node.id !== "readme" }),
      );
      expect(onSelectedChange).toHaveBeenLastCalledWith(["lib"]);
      rerender(
        renderTree({
          ...props,
          items: ITEMS.filter((node) => node.id !== "src"),
        }),
      );
      expect(onSelectedChange).toHaveBeenLastCalledWith([]);
    });
  });

  it("hands over the rows on screen as they change, once each time", () => {
    const onShownChange = vi.fn();
    render(renderTree({ defaultExpanded: OPEN, onShownChange }));
    expect(onShownChange).toHaveBeenCalledTimes(1);
    expect(onShownChange).toHaveBeenLastCalledWith([
      "src",
      "components",
      "lib",
      "archive",
      "lazy",
      "readme",
    ]);
    act(() => row("readme").focus());
    expect(onShownChange).toHaveBeenCalledTimes(1);
    key(row("src"), "ArrowLeft");
    expect(onShownChange).toHaveBeenLastCalledWith([
      "src",
      "archive",
      "lazy",
      "readme",
    ]);
  });

  describe("by the keyboard", () => {
    const tree = (extra: Props = {}) =>
      render(renderTree({ selectable: true, defaultExpanded: OPEN, ...extra }));

    it("toggles the focused row on Space, Ctrl+Space and ⌘+Space", () => {
      tree();
      act(() => row("lib").focus());
      expect(press(" ")).toBe(false);
      expect(selected()).toEqual([2]);
      press(" ", { ctrlKey: true });
      expect(selected()).toEqual([]);
      press(" ", { metaKey: true });
      expect(selected()).toEqual([2]);
    });

    it("leaves a Space typed into a search to the search", () => {
      tree();
      act(() => row("src").focus());
      press("l");
      expect(focused()).toBe(row("lib"));
      press(" ");
      expect(selected()).toEqual([]);
    });

    it("extends and draws back from the anchor with Shift and the arrows", () => {
      tree();
      act(() => row("components").focus());
      press(" ");
      press("ArrowDown", { shiftKey: true });
      press("ArrowDown", { shiftKey: true });
      press("ArrowDown", { shiftKey: true });
      expect(selected()).toEqual([1, 2, 3, 4]);
      press("ArrowUp", { shiftKey: true });
      expect(selected()).toEqual([1, 2, 3]);
      expect(focused()).toBe(row("archive"));
      press("ArrowUp", { shiftKey: true });
      press("ArrowUp", { shiftKey: true });
      press("ArrowUp", { shiftKey: true });
      expect(selected()).toEqual([0, 1]);
    });

    it("keeps what was selected before the anchor, and runs to the ends with Home and End", () => {
      tree({ defaultSelected: ["readme"] });
      act(() => row("lib").focus());
      press("Home", { shiftKey: true });
      expect(selected()).toEqual([0, 1, 2, 5]);
      press("End", { shiftKey: true });
      expect(selected()).toEqual([2, 3, 4, 5]);
    });

    it("selects every row on Ctrl+A", () => {
      tree();
      act(() => row("lib").focus());
      expect(press("a", { ctrlKey: true })).toBe(false);
      expect(selected()).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it("clears the cut, then the selection, on Escape", () => {
      tree({ onMove: vi.fn(), defaultSelected: ["lib"] });
      act(() => row("readme").focus());
      press("x", { ctrlKey: true });
      expect(rowOf("readme").hasAttribute("data-cut")).toBe(true);
      press("Escape");
      expect(rowOf("readme").hasAttribute("data-cut")).toBe(false);
      expect(selected()).toEqual([2]);
      press("Escape");
      expect(selected()).toEqual([]);
      expect(press("Escape")).toBe(true);
    });
  });

  describe("by the pointer", () => {
    const tree = (extra: Props = {}) =>
      render(
        renderTree({
          selectable: true,
          defaultExpanded: OPEN,
          icons: true,
          ...extra,
        }),
      );

    it("selects a row clicked on its icon, which goes nowhere", () => {
      const onItemClick = vi.fn();
      tree({ onItemClick });
      expect(clickAt("lib", 28)).toBe(false);
      expect(selected()).toEqual([2]);
      expect(onItemClick).not.toHaveBeenCalled();
      expect(clickAt("lib", 20)).toBe(false);
      expect(selected()).toEqual([]);
    });

    it("goes to the place on a click on the name", () => {
      const onItemClick = vi.fn();
      tree({ onItemClick, defaultSelected: ["readme"] });
      expect(clickAt("readme", 100)).toBe(true);
      expect(onItemClick).toHaveBeenCalledTimes(1);
      expect(selected()).toEqual([5]);
    });

    it("leaves a middle click and a modified click on the icon to the link", () => {
      const onItemClick = vi.fn();
      tree({ onItemClick });
      clickAt("lib", 28, { button: 1 });
      clickAt("lib", 28, { ctrlKey: true });
      clickAt("lib", 28, { metaKey: true });
      expect(selected()).toEqual([]);
      expect(onItemClick).toHaveBeenCalledTimes(3);
    });

    it("sets the rows from the anchor on Shift and a click on the icon", () => {
      tree();
      clickAt("components", 28);
      expect(clickAt("lazy", 28, { shiftKey: true })).toBe(false);
      expect(selected()).toEqual([1, 2, 3, 4]);
      // Each row of the range takes the clicked row's new state.
      clickAt("archive", 28, { shiftKey: true });
      expect(selected()).toEqual([]);
    });

    it("finds the icon's room on a row that leads with its label", () => {
      tree({ icons: false });
      expect(clickAt("lib", 30)).toBe(false);
      expect(selected()).toEqual([2]);
      expect(row("lib").className).toContain(
        "has-[>[data-slot=tree-label]:first-child]:pl-",
      );
    });

    it("toggles on a tap only once a selection is under way", () => {
      const onItemClick = vi.fn();
      tree({ onItemClick });
      expect(clickAt("readme", 100, {}, "touch")).toBe(true);
      expect(onItemClick).toHaveBeenCalledTimes(1);
      act(() => row("lib").focus());
      press(" ");
      expect(clickAt("readme", 100, {}, "touch")).toBe(false);
      expect(selected()).toEqual([2, 5]);
      expect(onItemClick).toHaveBeenCalledTimes(1);
      // Enter's click, with no pointer behind it, still goes.
      expect(fireEvent.click(row("lazy"))).toBe(true);
      expect(onItemClick).toHaveBeenCalledTimes(2);
      // The toggle still opens and closes.
      fireEvent.pointerDown(toggleOf("lib 1"), { pointerType: "touch" });
      fireEvent.click(toggleOf("lib 1"));
      expect(item("utils")).toBeTruthy();
    });

    it("marks the row whose icon a mouse is on, never on touch", () => {
      tree();
      const at = (x: number, pointerType = "mouse") =>
        fireEvent.pointerMove(row("lib"), {
          pointerType,
          clientX: x,
          clientY: 2 * H + 5,
        });
      at(30);
      expect(rowOf("lib 1").hasAttribute("data-icon-hover")).toBe(true);
      at(100);
      expect(rowOf("lib 1").hasAttribute("data-icon-hover")).toBe(false);
      at(30, "touch");
      expect(rowOf("lib 1").hasAttribute("data-icon-hover")).toBe(false);
    });

    it("draws the checkbox beside the item, out of what a cut fades", () => {
      tree({ defaultSelected: ["lib"] });
      const box = rowOf("lib 1").querySelector("[data-slot=tree-select]");
      expect(box?.getAttribute("aria-hidden")).toBe("true");
      expect(box?.querySelector("[data-slot=checkbox]")).toBeTruthy();
      expect(row("lib").contains(box ?? null)).toBe(false);
      expect(screen.getByRole("tree").hasAttribute("data-selecting")).toBe(
        true,
      );
    });
  });

  describe("acted on", () => {
    // Every moved id gets a "2" when a move returns new ones.
    const renamed = (nodes: readonly Node[], ids: Set<string>): Node[] =>
      nodes.map((node) => ({
        ...node,
        id: ids.has(node.id) ? `${node.id}2` : node.id,
        children: node.children && renamed(node.children, ids),
      }));

    function Moving({
      rename = false,
      onMove,
      ...props
    }: Props & { rename?: boolean }) {
      const [items, setItems] = React.useState(ITEMS);
      return renderTree({
        ...props,
        items,
        onMove: (moved, target) => {
          onMove?.(moved, target);
          const next = moveNodes(items, moved, target);
          if (!rename) {
            setItems(next);
            return;
          }
          setItems(renamed(next, new Set(moved.map((m) => m.id))));
          return moved.map((m) => `${m.id}2`);
        },
      });
    }

    it("drags the selection along with a selected row, less what a branch holds", () => {
      const onMove = vi.fn();
      render(
        renderTree({
          selectable: true,
          onMove,
          expanded: ["src", "lib"],
          defaultSelected: ["readme", "utils", "lib"],
        }),
      );
      // src 0, components 1, lib 2, utils 3, archive 4, lazy 5, readme 6.
      fireDrag("dragStart", row("readme"), data);
      expect(
        data.image?.querySelector("[data-slot=tree-drag-count]")?.textContent,
      ).toBe("2");
      expect(
        [...document.querySelectorAll("[data-dragging]")].map((el) =>
          el.getAttribute("data-index"),
        ),
      ).toEqual(["2", "6"]);
      const archive = document.querySelector(
        '[data-slot=tree-row][data-index="4"]',
      ) as HTMLElement;
      fireDrag("dragOver", archive, data, { clientY: 4 * H + 5 });
      fireDrag("drop", archive, data, { clientY: 4 * H + 5 });
      expect(onMove).toHaveBeenCalledWith(
        [
          expect.objectContaining({ id: "lib" }),
          expect.objectContaining({ id: "readme" }),
        ],
        expect.objectContaining({ parentId: "archive" }),
      );
    });

    it("drags a row outside the selection alone", () => {
      render(
        renderTree({
          selectable: true,
          onMove: vi.fn(),
          expanded: OPEN,
          defaultSelected: ["readme"],
        }),
      );
      fireDrag("dragStart", row("lib"), data);
      expect(data.image?.textContent).toBe("lib1");
      expect(rowOf("readme").hasAttribute("data-dragging")).toBe(false);
      expect(selected()).toEqual([5]);
    });

    it("drags nothing when any row of the selection cannot move", () => {
      render(
        renderTree({
          selectable: true,
          onMove: vi.fn(),
          canDrag: (node) => node.id !== "lazy",
          expanded: OPEN,
          defaultSelected: ["readme", "lazy"],
        }),
      );
      fireDrag("dragStart", row("readme"), data);
      expect(data.types).toEqual([]);
    });

    it("cuts the selection, pastes it whole, and keeps it selected", () => {
      const onMove = vi.fn();
      render(
        <Moving
          selectable
          onMove={onMove}
          defaultExpanded={["src", "lib"]}
          defaultSelected={["readme", "lazy"]}
        />,
      );
      act(() => row("readme").focus());
      press("x", { ctrlKey: true });
      expect(rowOf("readme").hasAttribute("data-cut")).toBe(true);
      expect(rowOf("lazy").hasAttribute("data-cut")).toBe(true);
      act(() => row("lib").focus());
      press("v", { ctrlKey: true });
      expect(onMove).toHaveBeenCalledWith(
        [
          expect.objectContaining({ id: "lazy" }),
          expect.objectContaining({ id: "readme" }),
        ],
        expect.objectContaining({ parentId: "lib", index: 1 }),
      );
      // src 0, components 1, lib 2, utils 3, lazy 4, readme 5, archive 6.
      expect(selected()).toEqual([4, 5]);
    });

    it("selects the moved rows under the ids the move gave them", () => {
      const onSelectedChange = vi.fn();
      render(
        <Moving
          rename
          selectable
          onSelectedChange={onSelectedChange}
          defaultExpanded={["src", "lib"]}
          defaultSelected={["readme"]}
        />,
      );
      act(() => row("readme").focus());
      press("x", { ctrlKey: true });
      act(() => row("lib").focus());
      press("v", { ctrlKey: true });
      expect(onSelectedChange).toHaveBeenLastCalledWith(["readme2"]);
      expect(selected()).toEqual([4]);
    });

    it("offers the menu what it acts on, and select, deselect and clear where they apply", () => {
      const seen: TreeMenuActions<Node>[] = [];
      const menu = (node: Node, actions: TreeMenuActions<Node>) => {
        seen.push(actions);
        return MENU(node, actions);
      };
      render(
        renderTree({
          selectable: true,
          menu,
          onRename: vi.fn(),
          onMove: vi.fn(),
          defaultExpanded: OPEN,
          defaultSelected: ["readme", "lib"],
        }),
      );
      key(row("lazy"), "ContextMenu");
      let actions = seen.at(-1);
      expect(actions?.items.map((n) => n.id)).toEqual(["lazy"]);
      expect(actions?.select).toBeTypeOf("function");
      expect(actions?.deselect).toBeUndefined();
      expect(actions?.clearSelection).toBeTypeOf("function");
      expect(actions?.rename).toBeTypeOf("function");
      key(screen.getByRole("menu"), "Escape");
      key(row("readme"), "ContextMenu");
      actions = seen.at(-1);
      expect(actions?.items.map((n) => n.id)).toEqual(["lib", "readme"]);
      expect(actions?.select).toBeUndefined();
      expect(actions?.rename).toBeUndefined();
      expect(actions?.cut).toBeTypeOf("function");
      act(() => actions?.deselect?.());
      expect(selected()).toEqual([2]);
      act(() => actions?.clearSelection?.());
      expect(selected()).toEqual([]);
      key(screen.getByRole("menu"), "Escape");
      key(row("readme"), "ContextMenu");
      expect(seen.at(-1)?.clearSelection).toBeUndefined();
      act(() => seen.at(-1)?.select?.());
      expect(selected()).toEqual([5]);
    });
  });
});

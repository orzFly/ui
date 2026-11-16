import { act, fireEvent, render, screen } from "@testing-library/react";
import type * as React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  Tree,
  TreeCount,
  TreeItem,
  TreeLabel,
} from "../src/components/tree.tsx";
import type { TreeNode } from "../src/lib/tree-rows.ts";

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

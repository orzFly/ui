import { describe, expect, it } from "vitest";
import {
  ancestorsOf,
  matchAncestors,
  moveNodes,
  moveTarget,
  outermost,
  type TreeDropZone,
  type TreeLoadingRow,
  type TreeMoveTarget,
  type TreeNode,
  type TreeRow,
  visibleRows,
} from "../src/lib/tree-rows.ts";

interface Node extends TreeNode<Node> {
  name: string;
}

const node = (id: string, children?: Node[], hasChildren?: boolean): Node => ({
  id,
  name: id,
  children,
  hasChildren,
});

// src
//   components
//     button
//     dialog
//   lib
//     utils
// test
//   empty (no children)
// lazy (not loaded)
const ITEMS: Node[] = [
  node("src", [
    node("components", [node("button"), node("dialog")]),
    node("lib", [node("utils")]),
  ]),
  node("test", [node("empty", [])]),
  node("lazy", undefined, true),
];

const ids = (rows: ReturnType<typeof visibleRows<Node>>) =>
  rows.map((r) => (r.kind === "item" ? r.item.id : `loading:${r.parentId}`));

const row = (rows: ReturnType<typeof visibleRows<Node>>, id: string) =>
  rows.find((r) => r.kind === "item" && r.item.id === id) as TreeRow<Node>;

describe("visibleRows", () => {
  it("shows the roots alone while everything is closed", () => {
    const rows = visibleRows(ITEMS, new Set());
    expect(ids(rows)).toEqual(["src", "test", "lazy"]);
    expect(rows.every((r) => r.kind === "item" && !r.expanded)).toBe(true);
  });

  it("puts an open branch's children after it, placed among their siblings", () => {
    const rows = visibleRows(ITEMS, new Set(["src"]));
    expect(ids(rows)).toEqual(["src", "components", "lib", "test", "lazy"]);
    expect(row(rows, "src")).toMatchObject({
      level: 1,
      posinset: 1,
      setsize: 3,
      branch: true,
      expanded: true,
      last: false,
      parentId: undefined,
    });
    expect(row(rows, "lib")).toMatchObject({
      level: 2,
      posinset: 2,
      setsize: 2,
      last: true,
      expanded: false,
      parentId: "src",
    });
    expect(row(rows, "lazy").last).toBe(true);
  });

  it("says, per ancestor, whether a sibling follows it", () => {
    const rows = visibleRows(ITEMS, new Set(["src", "components", "lib"]));
    // components has lib after it; src has test after it.
    expect(row(rows, "button").continues).toEqual([true, true]);
    // lib is src's last child.
    expect(row(rows, "utils").continues).toEqual([true, false]);
    expect(row(rows, "components").continues).toEqual([true]);
    expect(row(rows, "src").continues).toEqual([]);
  });

  it("shows one loading row under an open branch whose children have not come", () => {
    expect(ids(visibleRows(ITEMS, new Set()))).not.toContain("loading:lazy");
    const rows = visibleRows(ITEMS, new Set(["lazy"]));
    expect(ids(rows)).toEqual(["src", "test", "lazy", "loading:lazy"]);
    expect(row(rows, "lazy")).toMatchObject({ branch: true, expanded: true });
    const loading = rows.at(-1) as TreeLoadingRow;
    expect(loading).toEqual({
      kind: "loading",
      parentId: "lazy",
      level: 2,
      continues: [false],
    });
  });

  it("keeps a branch with no children a branch, with nothing under it open", () => {
    const rows = visibleRows(ITEMS, new Set(["test", "empty"]));
    expect(ids(rows)).toEqual(["src", "test", "empty", "lazy"]);
    expect(row(rows, "empty")).toMatchObject({ branch: true, expanded: true });
    expect(row(rows, "button")).toBeUndefined();
  });

  it("marks leaves as leaves and never open", () => {
    const rows = visibleRows(ITEMS, new Set(["src", "components", "button"]));
    expect(row(rows, "button")).toMatchObject({
      branch: false,
      expanded: false,
    });
  });

  describe("with a filter", () => {
    const byName = (text: string) => (n: Node) => n.name.includes(text);

    it("keeps the matches and their ancestors, open whatever the reader opened", () => {
      const rows = visibleRows(ITEMS, new Set(), byName("dialog"));
      expect(ids(rows)).toEqual(["src", "components", "dialog"]);
      expect(row(rows, "src").expanded).toBe(true);
      expect(row(rows, "components").expanded).toBe(true);
    });

    it("closes a matching branch none of whose children match", () => {
      const rows = visibleRows(ITEMS, new Set(["src", "lib"]), byName("lib"));
      expect(ids(rows)).toEqual(["src", "lib"]);
      expect(row(rows, "lib").expanded).toBe(false);
    });

    it("shows no loading row", () => {
      const rows = visibleRows(ITEMS, new Set(["lazy"]), byName("lazy"));
      expect(ids(rows)).toEqual(["lazy"]);
      expect(row(rows, "lazy").expanded).toBe(false);
    });

    it("counts places among the visible siblings", () => {
      const rows = visibleRows(ITEMS, new Set(), byName("t"));
      expect(ids(rows)).toEqual([
        "src",
        "components",
        "button",
        "lib",
        "utils",
        "test",
        "empty",
      ]);
      expect(row(rows, "src")).toMatchObject({ posinset: 1, setsize: 2 });
      expect(row(rows, "test")).toMatchObject({
        posinset: 2,
        setsize: 2,
        last: true,
      });
      expect(row(rows, "button")).toMatchObject({
        posinset: 1,
        setsize: 1,
        last: true,
      });
    });

    it("marks the matches and nothing else", () => {
      const rows = visibleRows(ITEMS, new Set(), byName("dialog"));
      expect(row(rows, "dialog").match).toBe(true);
      expect(row(rows, "components").match).toBe(false);
      expect(row(rows, "src").match).toBe(false);
    });

    it.each(["expand", "collapse"] as const)(
      "in %s mode, shows every row as expanded holds and marks the matches",
      (mode) => {
        const open = new Set(["src", "lib", "test"]);
        const rows = visibleRows(ITEMS, open, byName("utils"), mode);
        expect(ids(rows)).toEqual(ids(visibleRows(ITEMS, open)));
        expect(row(rows, "src").expanded).toBe(true);
        expect(row(rows, "components").expanded).toBe(false);
        expect(row(rows, "test").expanded).toBe(true);
        expect(row(rows, "utils").match).toBe(true);
        expect(rows.filter((r) => r.kind === "item" && r.match).length).toBe(1);
      },
    );
  });

  it("matches nothing and gives the same rows when called without a filter", () => {
    const open = new Set(["src", "components", "lazy"]);
    const rows = visibleRows(ITEMS, open);
    expect(rows.every((r) => r.kind === "loading" || !r.match)).toBe(true);
    expect(visibleRows(ITEMS, open, undefined, "collapse")).toEqual(rows);
    expect(visibleRows(ITEMS, open, undefined, "expand")).toEqual(rows);
  });
});

describe("matchAncestors", () => {
  const byName = (text: string) => (n: Node) => n.name.includes(text);

  it("lists each ancestor of the matches once, root first", () => {
    expect(
      matchAncestors(ITEMS, (n) => n.id === "button" || n.id === "dialog"),
    ).toEqual(["src", "components"]);
    expect(matchAncestors(ITEMS, byName("t"))).toEqual([
      "src",
      "components",
      "lib",
      "test",
    ]);
  });

  it("is empty when only roots match, or nothing does", () => {
    expect(matchAncestors(ITEMS, byName("src"))).toEqual([]);
    expect(matchAncestors(ITEMS, byName("nothing"))).toEqual([]);
  });
});

describe("ancestorsOf", () => {
  it("is empty for a root", () => {
    expect(ancestorsOf(ITEMS, "test")).toEqual([]);
  });

  it("is the path from the root for a deep node", () => {
    expect(ancestorsOf(ITEMS, "dialog")).toEqual(["src", "components"]);
  });

  it("is undefined for an id no node has", () => {
    expect(ancestorsOf(ITEMS, "missing")).toBeUndefined();
  });
});

describe("moveTarget", () => {
  // ITEMS, then a leaf at the root:
  // readme
  const TREE: Node[] = [...ITEMS, node("readme")];
  const find = (
    id: string,
    nodes: readonly Node[] = TREE,
  ): Node | undefined => {
    for (const n of nodes) {
      if (n.id === id) return n;
      const below = find(id, n.children ?? []);
      if (below) return below;
    }
    return undefined;
  };
  const target = (
    open: string[],
    moved: string | string[],
    over: string,
    zone: TreeDropZone | undefined,
    canDrop: (item: Node, t: TreeMoveTarget) => boolean = () => true,
  ) => {
    const group = [moved].flat().map((id) => find(id) as Node);
    const rows = visibleRows(TREE, new Set(open));
    const index = rows.findIndex((r) =>
      r.kind === "item" ? r.item.id === over : `loading:${r.parentId}` === over,
    );
    return moveTarget(rows, TREE, group, index, zone, canDrop);
  };
  const onlyInto = (_: Node, t: TreeMoveTarget) => t.position === "into";

  it("takes a branch's three zones as before it, into it last, and after it", () => {
    const open = ["src"];
    expect(target(open, "readme", "lib", "top")).toEqual({
      parentId: "src",
      index: 1,
      over: "lib",
      position: "before",
    });
    expect(target(open, "readme", "lib", "middle")).toEqual({
      parentId: "lib",
      index: 1,
      over: "lib",
      position: "into",
    });
    expect(target(open, "readme", "lib", "bottom")).toEqual({
      parentId: "src",
      index: 2,
      over: "lib",
      position: "after",
    });
  });

  it("takes a leaf's two halves as before and after it", () => {
    const open = ["src", "components"];
    expect(target(open, "readme", "dialog", "top")).toMatchObject({
      parentId: "components",
      index: 1,
      position: "before",
    });
    expect(target(open, "readme", "dialog", "bottom")).toMatchObject({
      parentId: "components",
      index: 2,
      position: "after",
    });
  });

  it("puts a drop below an open branch first among its children", () => {
    expect(target(["src"], "readme", "src", "bottom")).toEqual({
      parentId: "src",
      index: 0,
      over: "src",
      position: "into",
    });
    expect(target([], "readme", "src", "bottom")).toMatchObject({
      parentId: undefined,
      index: 1,
      position: "after",
    });
  });

  it("falls back to into, so a tree taking only that drops into a branch, or a leaf's parent", () => {
    const open = ["src", "components"];
    for (const zone of ["top", "middle", "bottom"] as const) {
      expect(target(open, "readme", "lib", zone, onlyInto)).toMatchObject({
        parentId: "lib",
        position: "into",
      });
    }
    expect(target(open, "readme", "dialog", "top", onlyInto)).toEqual({
      parentId: "components",
      index: 2,
      over: "dialog",
      position: "into",
    });
    expect(target([], "src", "readme", "top", onlyInto)).toMatchObject({
      parentId: undefined,
      position: "into",
    });
  });

  it("is undefined when canDrop refuses every candidate", () => {
    expect(
      target(["src"], "readme", "lib", "middle", () => false),
    ).toBeUndefined();
  });

  it("never asks about a drop into the moved node or below it", () => {
    const seen: TreeMoveTarget[] = [];
    const record = (_: Node, t: TreeMoveTarget) => {
      seen.push(t);
      return false;
    };
    const open = ["src", "components"];
    target(open, "src", "src", "middle", record);
    target(open, "src", "button", "top", record);
    target(open, "src", "components", "middle", record);
    expect(seen).toEqual([]);
  });

  it("refuses a drop that leaves the node where it is", () => {
    const open = ["src", "components"];
    expect(
      target(open, "dialog", "button", "bottom", onlyInto),
    ).toBeUndefined();
    expect(target(open, "dialog", "dialog", "top")).toBeUndefined();
    expect(
      target(open, "button", "dialog", "top", (_, t) => t.position !== "into"),
    ).toBeUndefined();
  });

  it("counts the index with the moved node taken out", () => {
    const open = ["src", "components"];
    expect(target(open, "button", "dialog", "bottom")).toMatchObject({
      parentId: "components",
      index: 1,
      position: "after",
    });
    expect(target(open, "components", "src", "middle")).toMatchObject({
      parentId: "src",
      index: 1,
    });
  });

  it("tries a paste into a branch then after it, and after a leaf then into its parent", () => {
    const open = ["src", "components"];
    expect(target(open, "readme", "lib", undefined)).toMatchObject({
      parentId: "lib",
      index: 1,
      position: "into",
    });
    expect(
      target(open, "readme", "lib", undefined, (_, t) => t.position !== "into"),
    ).toMatchObject({ parentId: "src", index: 2, position: "after" });
    expect(target(open, "readme", "button", undefined)).toMatchObject({
      parentId: "components",
      index: 1,
      position: "after",
    });
    expect(target(open, "readme", "button", undefined, onlyInto)).toEqual({
      parentId: "components",
      index: 1,
      over: "button",
      position: "into",
    });
  });

  it("takes a loading row as the middle of its branch, which counts from 0", () => {
    expect(target(["lazy"], "readme", "loading:lazy", "top")).toEqual({
      parentId: "lazy",
      index: 0,
      over: "lazy",
      position: "into",
    });
  });

  describe("with a group", () => {
    it("never asks about a drop below any item of it", () => {
      const seen: TreeMoveTarget[] = [];
      const record = (_: Node, t: TreeMoveTarget) => {
        seen.push(t);
        return false;
      };
      const open = ["src", "components"];
      target(open, ["readme", "components"], "button", "top", record);
      target(open, ["readme", "components"], "components", "middle", record);
      expect(seen).toEqual([]);
      expect(target(open, ["readme", "lib"], "dialog", "top")).toMatchObject({
        parentId: "components",
        index: 1,
      });
    });

    it("counts the index with every item taken out", () => {
      const open = ["src", "components", "lib"];
      expect(target(open, ["components", "lib"], "readme", "top")).toEqual({
        parentId: undefined,
        index: 3,
        over: "readme",
        position: "before",
      });
      expect(
        target(open, ["button", "readme"], "dialog", "bottom"),
      ).toMatchObject({ parentId: "components", index: 1, position: "after" });
      expect(target(open, ["button", "utils"], "lib", "top")).toMatchObject({
        parentId: "src",
        index: 1,
        position: "before",
      });
    });

    it("refuses a drop that leaves the group together where it is", () => {
      const open = ["src", "components"];
      expect(
        target(
          open,
          ["button", "dialog"],
          "components",
          "middle",
          (_, t) => t.parentId === "components",
        ),
      ).toBeUndefined();
      // Not together yet: test stands between src and lazy at the root.
      expect(target(open, ["src", "lazy"], "test", "top")).toMatchObject({
        parentId: undefined,
        index: 0,
        position: "before",
      });
    });

    it("tries the next candidate when canDrop refuses one item", () => {
      const notReadmeBefore = (item: Node, t: TreeMoveTarget) =>
        !(item.id === "readme" && t.position === "before");
      expect(
        target(["src"], ["utils", "readme"], "lib", "top", notReadmeBefore),
      ).toMatchObject({ parentId: "lib", position: "into" });
    });

    it("passes the whole group to canDrop", () => {
      const rows = visibleRows(TREE, new Set(["src"]));
      const group = [find("readme"), find("test")] as Node[];
      const seen: (readonly Node[])[] = [];
      moveTarget(rows, TREE, group, 1, "middle", (_, __, g) => {
        seen.push(g);
        return true;
      });
      expect(seen).toEqual([group, group]);
    });

    it("takes a loading row as its branch", () => {
      expect(
        target(["lazy"], ["readme", "test"], "loading:lazy", "bottom"),
      ).toMatchObject({ parentId: "lazy", index: 0 });
    });
  });
});

describe("outermost", () => {
  it("drops the items another item of the group contains, keeping the order", () => {
    const [src, test] = ITEMS as [Node, Node];
    const lib = src.children?.[1] as Node;
    const utils = lib.children?.[0] as Node;
    expect(outermost([utils, test, lib]).map((n) => n.id)).toEqual([
      "test",
      "lib",
    ]);
    expect(outermost([lib, src]).map((n) => n.id)).toEqual(["src"]);
  });
});

describe("moveNodes", () => {
  const names = (nodes: readonly Node[]): unknown =>
    nodes.map((n) => (n.children ? { [n.id]: names(n.children) } : n.id));
  const tree = () => [
    node("a", [node("a1"), node("a2"), node("a3")]),
    node("b", [node("b1")]),
    node("c"),
  ];
  const at = (parentId: string | undefined, index: number): TreeMoveTarget => ({
    parentId,
    index,
    over: "x",
    position: "into",
  });
  const pick = (nodes: readonly Node[], ...ids: string[]) =>
    ids.map((id) => {
      const walk = (list: readonly Node[]): Node | undefined => {
        for (const n of list) {
          if (n.id === id) return n;
          const below = walk(n.children ?? []);
          if (below) return below;
        }
        return undefined;
      };
      return walk(nodes) as Node;
    });

  it("moves within one parent, forward and back", () => {
    const t = tree();
    expect(names(moveNodes(t, pick(t, "a1"), at("a", 2)))).toEqual([
      { a: ["a2", "a3", "a1"] },
      { b: ["b1"] },
      "c",
    ]);
    expect(names(moveNodes(t, pick(t, "a3"), at("a", 0)))).toEqual([
      { a: ["a3", "a1", "a2"] },
      { b: ["b1"] },
      "c",
    ]);
  });

  it("moves across parents and to the root, putting the group together", () => {
    const t = tree();
    expect(names(moveNodes(t, pick(t, "a1", "a3"), at("b", 1)))).toEqual([
      { a: ["a2"] },
      { b: ["b1", "a1", "a3"] },
      "c",
    ]);
    expect(names(moveNodes(t, pick(t, "b1", "a2"), at(undefined, 1)))).toEqual([
      { a: ["a1", "a3"] },
      "b1",
      "a2",
      { b: [] },
      "c",
    ]);
  });

  it("returns a subtree the move does not touch as it was", () => {
    const t = tree();
    const moved = moveNodes(t, pick(t, "a1"), at("a", 1));
    expect(moved[1]).toBe(t[1]);
    expect(moved[2]).toBe(t[2]);
    expect(moved[0]).not.toBe(t[0]);
  });
});

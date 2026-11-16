import { describe, expect, it } from "vitest";
import {
  ancestorsOf,
  type TreeLoadingRow,
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

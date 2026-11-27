import type { Element, Root } from "hast";
import { describe, expect, it } from "vitest";
import { rehypeHeadingLevels } from "../src/lib/rehype-heading-levels.ts";

const heading = (level: number): Element => ({
  type: "element",
  tagName: `h${level}`,
  properties: {},
  children: [{ type: "text", value: String(level) }],
});

/** Every heading level, one nested in a blockquote, as the tags they end up with. */
function run(level: number): string[] {
  const quote: Element = {
    type: "element",
    tagName: "blockquote",
    properties: {},
    children: [heading(2)],
  };
  const tree: Root = {
    type: "root",
    children: [heading(1), quote, heading(3), heading(6)],
  };
  rehypeHeadingLevels({ level })(tree);
  return [
    (tree.children[0] as Element).tagName,
    ((tree.children[1] as Element).children[0] as Element).tagName,
    (tree.children[2] as Element).tagName,
    (tree.children[3] as Element).tagName,
  ];
}

describe("rehypeHeadingLevels", () => {
  it("leaves the headings alone at level 1", () => {
    expect(run(1)).toEqual(["h1", "h2", "h3", "h6"]);
  });

  it("moves every heading, nested ones too, so # lands on the level", () => {
    expect(run(2)).toEqual(["h2", "h3", "h4", "h6"]);
  });

  it("stops at h6", () => {
    expect(run(5)).toEqual(["h5", "h6", "h6", "h6"]);
    expect(run(40)).toEqual(["h6", "h6", "h6", "h6"]);
  });

  it("moves nothing for a level that is not a number from 1 up", () => {
    expect(run(0)).toEqual(["h1", "h2", "h3", "h6"]);
    expect(run(Number.NaN)).toEqual(["h1", "h2", "h3", "h6"]);
  });
});

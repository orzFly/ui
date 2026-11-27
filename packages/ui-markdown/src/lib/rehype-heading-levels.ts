import type { Element, Root } from "hast";

const HEADING = /^h([1-6])$/;

export type RehypeHeadingLevelsOptions = {
  /** The level a `#` heading is drawn at, 1 to 6. */
  level: number;
};

/**
 * Moves every heading down so that a `#` is drawn at `level`, and each deeper one as many levels
 * further, stopping at `h6`. `<Markdown headingLevel>` runs it.
 */
export function rehypeHeadingLevels({ level }: RehypeHeadingLevelsOptions) {
  const shift = Number.isFinite(level)
    ? Math.min(5, Math.max(0, Math.floor(level) - 1))
    : 0;
  return (tree: Root) => {
    if (shift === 0) return;
    const visit = (node: Root | Element) => {
      for (const child of node.children) {
        if (child.type !== "element") continue;
        const match = HEADING.exec(child.tagName);
        if (match !== null) {
          child.tagName = `h${Math.min(6, Number(match[1]) + shift)}`;
        }
        visit(child);
      }
    };
    visit(tree);
  };
}

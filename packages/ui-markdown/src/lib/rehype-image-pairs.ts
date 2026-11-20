import type { Element, ElementContent, Root } from "hast";

/**
 * Marks the `<img>` that stands for a whole pair, as React hands it to an
 * `img` override. It is the pair's second image, carrying the first's address
 * and alt in `PAIR_BEFORE_SRC_ATTR` and `PAIR_BEFORE_ALT_ATTR`.
 */
export const PAIR_ATTR = "data-image-pair";
export const PAIR_BEFORE_SRC_ATTR = "data-pair-before-src";
export const PAIR_BEFORE_ALT_ATTR = "data-pair-before-alt";

const ARROW = /^\s*(?:→|->)\s*$/;

/**
 * The rule: a paragraph's children are exactly an image, an arrow (`→` or
 * `->`) and an image, with nothing but whitespace and soft breaks around
 * them. `@orz/ui-codemirror`'s image-pairs extension holds the editor to the
 * same rule, and both are tested against one table of cases.
 */
export function imagePairOf(
  children: ElementContent[],
): { before: Element; after: Element } | null {
  const kids = children.filter(
    (child) => !(child.type === "text" && child.value.trim() === ""),
  );
  if (kids.length !== 3) return null;
  const [before, arrow, after] = kids;
  if (before?.type !== "element" || before.tagName !== "img") return null;
  if (after?.type !== "element" || after.tagName !== "img") return null;
  if (arrow?.type !== "text" || !ARROW.test(arrow.value)) return null;
  return { before, after };
}

/** Whether a hast `<img>` is a pair `rehypeImagePairs` folded into one. */
export function isPairImage(node: Element | undefined): boolean {
  return node?.tagName === "img" && node.properties.dataImagePair !== undefined;
}

const BLOCKS = new Set([
  "p",
  "ul",
  "ol",
  "pre",
  "blockquote",
  "table",
  "div",
  "hr",
  "details",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);

/** A tight list item has no `<p>`: its paragraph is the inline run it opens with. */
function inlineRunLength(li: Element): number {
  const index = li.children.findIndex(
    (child) => child.type === "element" && BLOCKS.has(child.tagName),
  );
  return index === -1 ? li.children.length : index;
}

/**
 * Folds each pair into its second image alone, carrying the first's address
 * and alt, so an `img` override draws the comparison and the paragraph around
 * it stays the element it was: the `<p>` keeps its source-line stamp and any
 * class a later pass puts on it. The `<img>` keeps its own position.
 */
export function rehypeImagePairs() {
  const visit = (parent: Root | Element): void => {
    for (const child of parent.children) {
      if (child.type !== "element") continue;
      const run =
        child.tagName === "p"
          ? child.children.length
          : child.tagName === "li"
            ? inlineRunLength(child)
            : 0;
      const pair = run === 0 ? null : imagePairOf(child.children.slice(0, run));
      if (pair !== null) {
        const { before, after } = pair;
        after.properties.dataImagePair = "";
        after.properties.dataPairBeforeSrc = String(
          before.properties.src ?? "",
        );
        after.properties.dataPairBeforeAlt = String(
          before.properties.alt ?? "",
        );
        child.children = [after, ...child.children.slice(run)];
      }
      visit(child);
    }
  };
  return (tree: Root) => visit(tree);
}

const IMAGE_NAME = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)$/i;

/** The last segment of an address, decoded. */
function lastSegment(src: string): string {
  let last: string;
  try {
    last = new URL(src, "http://x").pathname.split("/").pop() ?? "";
  } catch {
    return "";
  }
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

/**
 * One side's label: the author's alt, unless it says nothing an author chose
 * (empty, or the file name a paste or an upload wrote there), when it is
 * `fallback`. `name` is the file's own name where the address resolves to
 * one; otherwise the address's last segment stands for it.
 */
export function pairLabel(
  alt: string,
  src: string,
  fallback: string,
  name?: string,
): string {
  const label = alt.trim();
  if (
    label === "" ||
    label === (name ?? lastSegment(src)) ||
    label === lastSegment(src) ||
    IMAGE_NAME.test(label)
  ) {
    return fallback;
  }
  return label;
}

// A prerendered page as Markdown, for agents: the page's indexed body, with each live example
// replaced by its source and every other part search skips (controls, demo chrome, heading
// anchors) left out. Read from the HTML rather than the MDX, so the facts the site generates
// (sizes, install lines, the packages table) arrive filled in.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Element, ElementContent, Root } from "hast";
import type { Root as MdRoot } from "mdast";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

const EXAMPLES = fileURLToPath(new URL("../src/examples/", import.meta.url));

export interface MarkdownMeta {
  title: string;
  description?: string;
}

const element = (
  tagName: string,
  children: ElementContent[],
  properties: Element["properties"] = {},
): Element => ({ type: "element", tagName, properties, children });

const text = (value: string): ElementContent => ({ type: "text", value });

function exampleCode(path: string): Element {
  const source = readFileSync(join(EXAMPLES, path), "utf8").trimEnd();
  return element("pre", [
    element("code", [text(source)], { className: ["language-tsx"] }),
  ]);
}

function findBody(node: Root | Element): Element | undefined {
  for (const child of node.children) {
    if (child.type !== "element") continue;
    if (child.properties.dataPagefindBody !== undefined) return child;
    const found = findBody(child);
    if (found) return found;
  }
  return undefined;
}

/**
 * A link to one of the site's pages points at its Markdown copy; Storybook and anything off the
 * site keep their address.
 */
function pageLink(href: string, base: string) {
  if (!href.startsWith(base) || href.startsWith(`${base}storybook/`)) {
    return href;
  }
  const [path = "", hash] = href.split("#");
  if (!path.endsWith("/")) return href;
  return `${path}index.md${hash === undefined ? "" : `#${hash}`}`;
}

function clean(children: ElementContent[], base: string): ElementContent[] {
  const out: ElementContent[] = [];
  for (const child of children) {
    if (child.type !== "element") {
      if (child.type === "text") out.push(child);
      continue;
    }
    const { dataExample, dataPagefindIgnore, href } = child.properties;
    if (typeof dataExample === "string") {
      out.push(exampleCode(dataExample));
      continue;
    }
    if (dataPagefindIgnore !== undefined) continue;
    if (child.tagName === "a" && typeof href === "string") {
      child.properties.href = pageLink(href, base);
    }
    child.children = clean(child.children, base);
    out.push(child);
  }
  return out;
}

const processor = unified()
  .use(rehypeRemark)
  .use(remarkGfm)
  .use(remarkStringify, { bullet: "-", fences: true, rule: "-" });

/**
 * The page in `html` as Markdown. A page whose body does not open with its own `h1` (a bare
 * page: the home page, a demo) gets one from `meta`, with the description under it.
 */
export async function pageMarkdown(
  html: string,
  meta: MarkdownMeta,
  base: string,
): Promise<string> {
  const tree = unified().use(rehypeParse).parse(html);
  const body = findBody(tree);
  if (!body) throw new Error(`${meta.title}: no [data-pagefind-body]`);
  let children = clean(body.children, base);
  // A bare page names itself in data-title; its own h1, if any, is a headline (the home page)
  // or the name again (a demo's bar), and a demo's About panel says the description again.
  if (body.properties.dataTitle !== undefined) {
    children = [
      element("h1", [text(meta.title)]),
      ...(meta.description ? [element("p", [text(meta.description)])] : []),
      ...withoutRepeats(children, meta),
    ];
  }
  const mdast = await processor.run({ type: "root", children });
  return processor.stringify(withoutEmptyHeadings(mdast as MdRoot));
}

const textOf = (node: ElementContent): string =>
  node.type === "text"
    ? node.value
    : node.type === "element"
      ? node.children.map(textOf).join("")
      : "";

/** The tree without an h1 that only repeats the title, or a paragraph that only repeats the description. */
function withoutRepeats(
  children: ElementContent[],
  meta: MarkdownMeta,
): ElementContent[] {
  return children.flatMap((child): ElementContent[] => {
    if (child.type !== "element") return [child];
    const said = textOf(child).trim();
    if (child.tagName === "h1" && said === meta.title) return [];
    if (child.tagName === "p" && said === meta.description) return [];
    child.children = withoutRepeats(child.children, meta);
    return [child];
  });
}

/**
 * A heading whose whole section was left out (a home module that is all controls) heads
 * nothing: it goes too.
 */
function withoutEmptyHeadings(root: MdRoot): MdRoot {
  const kept = root.children.filter((node, i, all) => {
    if (node.type !== "heading") return true;
    const next = all[i + 1];
    return (
      next !== undefined &&
      !(next.type === "heading" && next.depth <= node.depth)
    );
  });
  return { ...root, children: kept };
}

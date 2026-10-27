import type { Expression, Program } from "estree";
import type { Heading, Nodes, Root, RootContent } from "mdast";
import type { TocEntry } from "../src/page.ts";

function textOf(node: Nodes): string {
  if ("value" in node && typeof node.value === "string") return node.value;
  if ("children" in node) return node.children.map(textOf).join("");
  return "";
}

/** GitHub's anchor rule, so a link written by hand against a heading keeps working. */
export function slug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

function literal(value: unknown): Expression {
  if (Array.isArray(value)) {
    return { type: "ArrayExpression", elements: value.map(literal) };
  }
  if (typeof value === "object" && value !== null) {
    return {
      type: "ObjectExpression",
      properties: Object.entries(value).map(([key, item]) => ({
        type: "Property",
        key: { type: "Identifier", name: key },
        value: literal(item),
        kind: "init",
        method: false,
        shorthand: false,
        computed: false,
      })),
    };
  }
  return { type: "Literal", value: value as string | number };
}

/**
 * Gives every `##` and `###` an id and exports them from the page as `toc`,
 * so the prerendered HTML carries the page's contents list and its anchors.
 */
export function remarkHeadings() {
  return (tree: Root) => {
    const toc: TocEntry[] = [];
    const seen = new Map<string, number>();
    const visit = (node: Nodes) => {
      if (node.type === "heading") {
        const heading = node as Heading;
        const text = textOf(heading);
        const base = slug(text);
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        const id = count === 0 ? base : `${base}-${count}`;
        heading.data = { ...heading.data, hProperties: { id } };
        if (heading.depth === 2 || heading.depth === 3) {
          toc.push({ depth: heading.depth, id, text });
        }
        return;
      }
      if ("children" in node) for (const child of node.children) visit(child);
    };
    visit(tree);
    const estree: Program = {
      type: "Program",
      sourceType: "module",
      body: [
        {
          type: "ExportNamedDeclaration",
          specifiers: [],
          attributes: [],
          source: null,
          declaration: {
            type: "VariableDeclaration",
            kind: "const",
            declarations: [
              {
                type: "VariableDeclarator",
                id: { type: "Identifier", name: "toc" },
                init: literal(toc),
              },
            ],
          },
        },
      ],
    };
    tree.children.push({
      type: "mdxjsEsm",
      value: "",
      data: { estree },
    } as unknown as RootContent);
  };
}

// The site's llms.txt (llmstxt.org): what the site is, then every page in nav order as a link to
// its Markdown copy, and llms-full.txt, every page's Markdown in that same order.
import { fileURLToPath } from "node:url";
import type { NavNode } from "../src/routes.ts";

/** A page's Markdown copy, next to its index.html. */
export const markdownHref = (base: string, route: string) =>
  `${base}${route.slice(1)}index.md`;

export const SKILL_PATH = "skills/orz-ui/SKILL.md";

/** The agent skills, committed at the repository's root and served as they are. */
export const SKILLS = fileURLToPath(
  new URL("../../../skills", import.meta.url),
);

function entry(node: NavNode, base: string) {
  const link = `[${node.title}](${markdownHref(base, node.route)})`;
  return node.description ? `${link}: ${node.description}` : link;
}

/** A section's pages as a list; a directory without a page is an item over its own. */
function list(nodes: readonly NavNode[], base: string, depth = 0): string[] {
  const indent = "  ".repeat(depth);
  return nodes.flatMap((node) => [
    `${indent}- ${node.page ? entry(node, base) : node.title}`,
    ...list(node.children, base, depth + 1),
  ]);
}

export function llmsIndex({
  nav,
  home,
  base,
}: {
  nav: NavNode;
  /** The home page's description: what the site is, in one sentence. */
  home: string;
  base: string;
}): string {
  const sections = nav.children.map((section) => {
    const items = [
      ...(section.page ? [`- ${entry(section, base)}`] : []),
      ...list(section.children, base),
    ];
    return [`## ${section.title}`, "", ...items].join("\n");
  });
  return `${[
    "# @orz/ui",
    "",
    `> ${home}`,
    "",
    `Every page below is Markdown, at its route's \`index.md\`. To build an app with @orz/ui, load the skill at [${SKILL_PATH}](${base}${SKILL_PATH}) first: it says how the components are meant to be used. Storybook documents every export with its props.`,
    "",
    ...sections.flatMap((section) => [section, ""]),
    "## Optional",
    "",
    `- [Every page in one file](${base}llms-full.txt): the pages above, in this order.`,
    `- [Storybook](${base}storybook/): every export, live, with its props.`,
  ].join("\n")}\n`;
}

/** The routes in nav order: home first, then each section's pages as the nav lists them. */
export function navOrder(nav: NavNode): string[] {
  const walk = (node: NavNode): string[] => [
    ...(node.page ? [node.route] : []),
    ...node.children.flatMap(walk),
  ];
  return ["/", ...walk(nav)];
}

export function llmsFull(pages: readonly string[]): string {
  return `${pages.map((page) => page.trimEnd()).join("\n\n---\n\n")}\n`;
}

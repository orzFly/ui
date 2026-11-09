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

/**
 * The index the site serves (`site`), or the one @orz/ui ships at docs/llms.txt (`package`):
 * its pages beside it, the skill at ../skills/, and Storybook at the public site's address.
 */
export type LlmsTarget = { kind: "site" } | { kind: "package"; site: string };

export function llmsIndex({
  nav,
  home,
  base: siteBase,
  target = { kind: "site" },
}: {
  nav: NavNode;
  /** The home page's description: what the site is, in one sentence. */
  home: string;
  base: string;
  target?: LlmsTarget;
}): string {
  const packaged = target.kind === "package";
  // In the package, a page's route is its path from docs/.
  const base = packaged ? "" : siteBase;
  const skill = packaged ? `../${SKILL_PATH}` : `${base}${SKILL_PATH}`;
  const storybook = `${packaged ? target.site : base}storybook/`;
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
    `Every page below is Markdown, at its route's \`index.md\`. To build an app with @orz/ui, load the skill at [${SKILL_PATH}](${skill}) first: it says how the components are meant to be used. Storybook documents every export with its props.`,
    "",
    ...sections.flatMap((section) => [section, ""]),
    "## Optional",
    "",
    // The package leaves it out: it is these files again, which a reader there greps instead.
    ...(packaged
      ? []
      : [
          `- [Every page in one file](${base}llms-full.txt): the pages above, in this order.`,
        ]),
    `- [Storybook](${storybook}): every export, live, with its props.`,
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

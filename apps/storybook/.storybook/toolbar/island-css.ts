import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

/** The elements the island's base rules reach: the menu (and its submenu), and each tool's host. */
const SCOPE = ':where([data-slot="popover-content"], [data-orz-toolbar])';

/** Splits on commas outside parentheses, as `input:where([a], [b])` needs. */
function splitTopLevel(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) {
      out.push(list.slice(start, i));
      start = i + 1;
    }
  }
  out.push(list.slice(start));
  return out.map((s) => s.trim()).filter((s) => s !== "");
}

/** The index of a top-level `::`, or -1. */
function pseudoElementAt(selector: string): number {
  let depth = 0;
  for (let i = 0; i < selector.length - 1; i++) {
    const c = selector[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (depth === 0 && c === ":" && selector[i + 1] === ":") return i;
  }
  return -1;
}

/**
 * `E::p` as `& E::p, &:is(E)::p`. Pasted inside the scope as it is, preflight
 * would reach only the scope's descendants, and the popover surface itself
 * would keep content-box sizing and render wider than in a page. `:is()`
 * cannot hold a pseudo-element, so it wraps only the element part.
 */
function scopeSelector(selector: string): string {
  const at = pseudoElementAt(selector);
  const element = (at === -1 ? selector : selector.slice(0, at)) || "*";
  const pseudo = at === -1 ? "" : selector.slice(at);
  return `& ${element}${pseudo}, &:is(${element})${pseudo}`;
}

/** Rewrites every rule's selector list, recursing into at-rule blocks such as @supports. */
function scopeRules(css: string): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open === -1) break;
    const prelude = css.slice(i, open).trim();
    let depth = 1;
    let close = open + 1;
    for (; close < css.length && depth > 0; close++) {
      if (css[close] === "{") depth++;
      else if (css[close] === "}") depth--;
    }
    const body = css.slice(open + 1, close - 1);
    out += prelude.startsWith("@")
      ? `${prelude} {\n${scopeRules(body)}}\n`
      : `${splitTopLevel(prelude).map(scopeSelector).join(", ")} {${body}}\n`;
    i = close;
  }
  return out;
}

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const at = (relative: string) =>
  fileURLToPath(new URL(relative, import.meta.url));

/**
 * The island's stylesheet entry. Storybook's manager has an unlayered reset of
 * its own and class names such as `container`, so this takes neither
 * Tailwind's global preflight nor `@orz/ui/styles.css`'s base layer: the
 * tokens come from `@orz/ui/theme.css`, and preflight is scoped to the island.
 */
export function islandCss(): string {
  const require = createRequire(import.meta.url);
  const preflight = stripComments(
    readFileSync(require.resolve("tailwindcss/preflight.css"), "utf8"),
  );
  const components = at("../../../../packages/ui/src/components");
  return `@layer theme, base;
@import "tailwindcss/theme.css" layer(theme);
/* Unlayered: Storybook's unlayered button { font-size: inherit } beats any layered rule. */
@import "tailwindcss/utilities.css" source(none);
@import "@orz/ui/theme.css";
/* No automatic detection: broader globs generate .container, which Storybook's
   sidebar uses. These are the files whose classes the toolbar renders; add one
   when ThemeMenu starts rendering another component. */
@source "${components}/{theme-menu,filter-menu,popover,button}.tsx";
@source "${at("./island.tsx")}";
/* The menu opens across the sidebar's edge, where Storybook's resize handle
   sits at z-index 100 and would take its clicks; PopoverContent's z-50 is a
   page's scale. This is Storybook's own popovers' z-index. Radix copies the
   content's computed z-index onto its popper wrapper. After the utilities
   import, so it beats .z-50 at equal specificity. */
[data-slot="popover-content"] {
  z-index: 100000;
}
@layer base {
  ${SCOPE} {
${scopeRules(preflight)}
    &, & * {
      @apply border-border outline-ring/50;
    }
  }
}
`;
}

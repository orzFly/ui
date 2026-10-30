// What the site's pages restate from the code, worked out from it at build time and handed to
// the pages as virtual modules (plugins.ts), so no page writes it by hand.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCsf } from "storybook/internal/csf-tools";
import { workspaces } from "../../../scripts/install.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
export const STORIES = join(ROOT, "apps/storybook/src");
export const DEMOS = join(ROOT, "apps/docs/src/demos");
const UI = join(ROOT, "packages/ui/src/components");

export interface PackageSummary {
  name: string;
  description: string;
}

/** Every published package with its package.json description: `@orz/ui` first, then by name. */
export function packageSummaries(): PackageSummary[] {
  return [...workspaces().values()]
    .map(({ manifest }) => {
      if (!manifest.description) {
        throw new Error(`${manifest.name}: package.json has no description`);
      }
      return { name: manifest.name, description: manifest.description };
    })
    .sort((a, b) =>
      a.name === "@orz/ui"
        ? -1
        : b.name === "@orz/ui"
          ? 1
          : a.name.localeCompare(b.name),
    );
}

const filesIn = (dir: string, test: (file: string) => boolean) =>
  readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter(test)
    .map((file) => join(dir, file));

const IMPORT = /^import\s+(type\s+)?\{([^}]*)\}\s+from\s+"([^".][^"]*)";?$/gm;

/** The values a file imports from packages, by specifier; type-only imports left out. */
function packageImports(source: string): { spec: string; names: string[] }[] {
  return [...source.matchAll(IMPORT)].flatMap(
    ([, typeOnly, names = "", spec = ""]) =>
      typeOnly
        ? []
        : [
            {
              spec,
              names: names
                .split(",")
                .map((name) => name.trim())
                .filter((name) => name && !name.startsWith("type "))
                .map((name) => name.split(/\s+as\s+/)[0] ?? name),
            },
          ],
  );
}

/** `@orz/ui-hex/content` is `ui-hex`, the first segment of its Storybook titles. */
const pkgDir = (spec: string) => spec.split("/")[1] ?? "";

export interface StoryPage {
  title: string;
  /** Where the page's main export, its title's last segment, is imported from. */
  spec?: string;
}

export function storyPages(): StoryPage[] {
  return filesIn(STORIES, (file) => file.endsWith(".stories.tsx")).map(
    (file) => {
      const text = readFileSync(file, "utf8");
      const csf = loadCsf(text, { fileName: file, makeTitle: (t) => t });
      const title = csf.parse().meta?.title ?? "";
      const main = title.split("/").at(-1);
      const spec = packageImports(text).find(({ names }) =>
        names.includes(main ?? ""),
      )?.spec;
      return { title, spec };
    },
  );
}

/**
 * The Storybook page that documents an import: the page named after it, else for a
 * renderer (`ansiContent`) its package's `Content` page, else the one page whose main
 * export comes from the same module (`toast` beside `Toaster`, `RefreshFailure` beside
 * `LoadFailure`). A peer's export goes to the page of the module named after the peer
 * (sonner's `toast` to `Toaster`, from `@orz/ui/components/sonner`). Null for what has no
 * page: `cn`, a constant, a type's helper.
 */
export function pageFor(
  spec: string,
  name: string,
  pages: StoryPage[],
): string | null {
  if (!spec.startsWith("@orz/")) {
    const named = pages.filter((page) => page.spec?.endsWith(`/${spec}`));
    return named.length === 1 ? (named[0]?.title ?? null) : null;
  }
  const pkg = pkgDir(spec);
  const titled = (last: string) =>
    pages.find(
      ({ title }) =>
        title.startsWith(`${pkg}/`) && title.split("/").at(-1) === last,
    )?.title;
  const byName =
    titled(name) ?? (name.endsWith("Content") ? titled("Content") : undefined);
  if (byName) return byName;
  const bySpec = pages.filter((page) => page.spec === spec);
  return bySpec.length === 1 ? (bySpec[0]?.title ?? null) : null;
}

/** `ui` first, as its pages are the ones a visitor looks for, then each package by name. */
const byPackage = (a: string, b: string) => {
  const key = (title: string) =>
    title.startsWith("ui/") ? `0${title}` : `1${title}`;
  return key(a).localeCompare(key(b));
};

/** The Storybook pages each demo's own files use, by the demo's directory. */
export function demoApis(pages = storyPages()): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const entry of readdirSync(DEMOS, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const titles = new Set<string>();
    const files = filesIn(join(DEMOS, entry.name), (file) =>
      /\.tsx?$/.test(file),
    );
    for (const file of files) {
      for (const { spec, names } of packageImports(
        readFileSync(file, "utf8"),
      )) {
        for (const name of names) {
          const title = pageFor(spec, name, pages);
          if (title) titles.add(title);
        }
      }
    }
    out[entry.name] = [...titles].sort(byPackage);
  }
  return out;
}

/**
 * The class strings of `@orz/ui`'s components, for the pages that quote the sizes and
 * durations they draw. They are read from the source rather than from a render: most of
 * the parts sit inside a portal, behind a hook, or in no export at all.
 * Each is found in its file by one of: the `const` of that name; `slot:` and a `data-slot`,
 * whose element's first class list follows it; or a needle that exactly one string literal
 * holds. A refactor that moves one fails the build here rather than leaving a page with an
 * old number.
 */
const INTERNAL = {
  input: ["input.tsx", "slot:input"],
  switch: ["switch.tsx", "slot:switch"],
  checkbox: ["checkbox.tsx", "slot:checkbox"],
  radioGroup: ["radio-group.tsx", "slot:radio-group"],
  radioGroupItem: ["radio-group.tsx", "slot:radio-group-item"],
  selectTrigger: ["select.tsx", "slot:select-trigger"],
  selectItem: ["select.tsx", "slot:select-item"],
  tabsTrigger: ["tabs.tsx", "slot:tabs-trigger"],
  dropdownMenuItem: ["dropdown-menu.tsx", "slot:dropdown-menu-item"],
  highlightedInput: ["highlighted-input.tsx", "touch:h-10 border"],
  filterBox: ["filter-menu.tsx", "touch:h-10 touch:text-base"],
  filterRow: ["filter-menu.tsx", "ROW_CLASS"],
  filterCell: ["filter-menu.tsx", "CELL_CLASS"],
  queryOption: ["query-box.tsx", "OPTION"],
  dialogContent: ["dialog.tsx", "slot:dialog-content"],
  sheetContent: ["sheet.tsx", "slot:sheet-content"],
  popoverContent: ["popover.tsx", "slot:popover-content"],
  tooltipContent: ["tooltip.tsx", "slot:tooltip-content"],
  hoverCardContent: ["hover-card.tsx", "slot:hover-card-content"],
  selectContent: ["select.tsx", "slot:select-content"],
  dropdownMenuContent: ["dropdown-menu.tsx", "slot:dropdown-menu-content"],
} as const;

export type InternalClasses = Record<keyof typeof INTERNAL, string>;

/** A string literal of several words: a class list, not an id or a prop value. */
const CLASS_LIST = /"([^"\n]* [^"\n]*)"/;

function find(source: string, needle: string): string[] {
  const named = new RegExp(`^const ${needle} =\\s*"([^"]*)"`, "m").exec(source);
  if (named) return [named[1] ?? ""];
  if (needle.startsWith("slot:")) {
    const at = source.split(`data-slot="${needle.slice(5)}"`);
    if (at.length !== 2) return [];
    const list = CLASS_LIST.exec(at[1] ?? "");
    return list ? [list[1] ?? ""] : [];
  }
  return [...source.matchAll(/"([^"\n]*)"/g)]
    .map(([, text = ""]) => text)
    .filter((text) => text.includes(needle));
}

/** One class string of a component file in `packages/ui/src/components`, found as `INTERNAL`'s are. */
export function classOf(file: string, needle: string): string {
  const found = find(readFileSync(join(UI, file), "utf8"), needle);
  if (found.length !== 1) {
    throw new Error(
      `packages/ui/src/components/${file}: expected one class string for "${needle}", found ${found.length}`,
    );
  }
  return found[0] ?? "";
}

export function internalClasses(): InternalClasses {
  const out: Partial<InternalClasses> = {};
  for (const [key, [file, needle]] of Object.entries(INTERNAL)) {
    out[key as keyof InternalClasses] = classOf(file, needle);
  }
  return out as InternalClasses;
}

/** Lengths `@orz/ui`'s stylesheets set that no class carries, each the one match of its pattern. */
const LENGTHS = {
  /** The `hit-area` utility's minimum, in px. */
  hitArea: ["theme.css", /@utility hit-area \{[^}]*min-height: (\d+)px/],
  /** The auto-hiding header settling in or out, in ms. */
  headerSettle: ["styles.css", /transition: top (\d+)ms/],
  /** `revealBlock`'s tint, in s. */
  anchorFlash: ["styles.css", /animation: anchor-flash (\d+(?:\.\d+)?)s/],
  /** tw-animate-css's `animate-in` and `animate-out` without a `duration-*`, in s. */
  animateDefault: [
    "node_modules/tw-animate-css/dist/tw-animate.css",
    /enter var\(--tw-animation-duration,var\(--tw-duration,(\d*\.?\d+)s\)\)/,
  ],
} as const;

export type CssLengths = Record<keyof typeof LENGTHS, number>;

export function cssLengths(): CssLengths {
  const out: Partial<CssLengths> = {};
  for (const [key, [file, pattern]] of Object.entries(LENGTHS)) {
    const found = pattern.exec(readFileSync(join(UI, "../..", file), "utf8"));
    if (!found?.[1]) {
      throw new Error(`packages/ui/${file}: no match for ${pattern}`);
    }
    out[key as keyof CssLengths] = Number(found[1]);
  }
  return out as CssLengths;
}

/**
 * The style tokens a class can name, from theme.css's `@theme static` block, by namespace and
 * name: `spacing.control` is `h-control`'s 32 (px), `text.ui-sm` `text-ui-sm`'s size, and
 * `duration.overlay` `duration-(--duration-overlay)`'s 100 (ms). These are the default style's
 * values, which is what every number a page quotes is.
 */
export interface StyleTokens {
  spacing: Record<string, number>;
  text: Record<string, number>;
  /** A text token's own line height in px, where it sets one. */
  leading: Record<string, number>;
  duration: Record<string, number>;
}

/** A token's value in px or ms; null for one that is no plain length, such as a radius's calc(). */
function measure(value: string, size?: number): number | null {
  const found = /^(-?\d*\.?\d+)(rem|px|ms|s)?$/.exec(value.trim());
  if (!found) return null;
  const number = Number(found[1]);
  switch (found[2]) {
    case "rem":
      return number * 16;
    case "s":
      return number * 1000;
    case undefined:
      // A bare line height is a multiple of the font size.
      return size === undefined ? null : number * size;
    default:
      return number;
  }
}

export function styleTokens(): StyleTokens {
  const theme = readFileSync(join(UI, "../../theme.css"), "utf8");
  const start = theme.indexOf("@theme static {");
  if (start < 0)
    throw new Error("packages/ui/theme.css: no @theme static block");
  const block = theme.slice(start, theme.indexOf("\n}", start));
  const out: StyleTokens = { spacing: {}, text: {}, leading: {}, duration: {} };
  const declarations = [...block.matchAll(/--([\w-]+):\s*([^;]+);/g)];
  for (const [, name = "", value = ""] of declarations) {
    const [, namespace = "", key = ""] =
      /^(spacing|text|duration)-(.+)$/.exec(name) ?? [];
    if (!namespace || key.endsWith("--line-height")) continue;
    const length = measure(value);
    if (length === null) {
      throw new Error(`packages/ui/theme.css: --${name} is not a length`);
    }
    out[namespace as "spacing" | "text" | "duration"][key] = length;
  }
  for (const [, name = "", value = ""] of declarations) {
    const key = /^text-(.+)--line-height$/.exec(name)?.[1];
    if (key === undefined) continue;
    const line = measure(value, out.text[key]);
    if (line === null) {
      throw new Error(`packages/ui/theme.css: --${name} is not a length`);
    }
    out.leading[key] = line;
  }
  return out;
}

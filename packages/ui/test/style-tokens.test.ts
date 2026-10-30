import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Every package draws shape, type and depth from the style tokens in
// theme.css, so a style can redraw it by reassigning them. This holds the
// sources to that: a literal radius, control height, shadow, text size or
// font family is a part no style can reach.

// Not `new URL(…, import.meta.url)`: under happy-dom `URL` is the window's
// class, which node:fs refuses as a file URL.
const PACKAGES = join(import.meta.dirname, "../..");

/**
 * The literals that stay, each with why. `file` is relative to `packages/`;
 * `utility` is the class without its variants, or the CSS declaration.
 */
const ALLOWED: readonly { file: string; utility: string; reason: string }[] = [
  {
    file: "ui/src/components/avatar.tsx",
    utility: "size-6",
    reason: "an avatar's sizes are its picture's, not a control's",
  },
  {
    file: "ui/src/components/avatar.tsx",
    utility: "size-8",
    reason: "an avatar's sizes are its picture's, not a control's",
  },
  {
    file: "ui/src/components/avatar.tsx",
    utility: "size-10",
    reason: "an avatar's sizes are its picture's, not a control's",
  },
  {
    file: "ui/src/components/color-picker.tsx",
    utility: "shadow-[0_0_0_1px_rgb(0_0_0/0.5),inset_0_0_0_1px_rgb(0_0_0/0.3)]",
    reason:
      "the thumb's dark rings keep it visible on any colour; they are its drawing, not depth",
  },
  {
    file: "ui/styles.css",
    utility:
      "box-shadow: 0 0 0 2px color-mix(in oklab, var(--primary) 40%, transparent)",
    reason: "revealBlock's flash is a ring around the block, not depth",
  },
  {
    file: "ui/styles.css",
    utility: "box-shadow: 0 0 0 2px transparent",
    reason: "revealBlock's flash is a ring around the block, not depth",
  },
  {
    file: "ui-hex/styles.css",
    utility: "box-shadow: var(--cell-caret, none)",
    reason: "the caret is an edge of the cell, drawn as an inset shadow",
  },
  {
    file: "ui-hex/styles.css",
    utility: "box-shadow: inset 0 -2px 0 var(--cell-edge)",
    reason: "the caret is an edge of the cell, drawn as an inset shadow",
  },
  {
    file: "ui-codemirror/src/extensions/completion.ts",
    utility:
      "boxShadow: 0 4px 6px -1px color-mix(in oklab, var(--foreground) 12%, transparent)",
    reason:
      "the editor's popups tint their shadow from --foreground, which no shadow token does",
  },
  {
    file: "ui-codemirror/src/extensions/paste-as.ts",
    utility:
      "boxShadow: 0 4px 6px -1px color-mix(in oklab, var(--foreground) 12%, transparent)",
    reason:
      "the editor's popups tint their shadow from --foreground, which no shadow token does",
  },
  {
    file: "ui-asciinema/src/asciinema-player.tsx",
    utility: "shadow-md",
    reason: "the play glyph sits on the recording, which no style draws",
  },
  {
    file: "ui-content/src/attachment/media-player.tsx",
    utility: "shadow-md",
    reason: "the play glyph sits on the video, which no style draws",
  },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

const packages = readdirSync(PACKAGES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(PACKAGES, entry.name));

const sources = packages.flatMap((dir) => {
  try {
    return walk(join(dir, "src"));
  } catch {
    return [];
  }
});

const stylesheets = packages
  .map((dir) => join(dir, "styles.css"))
  .filter((path) => {
    try {
      readFileSync(path);
      return true;
    } catch {
      return false;
    }
  });

/** A string literal's text, with where it starts. */
interface Literal {
  text: string;
  at: number;
}

/**
 * The string literals of a source, comments skipped: a template literal's
 * text runs, not its `${…}` expressions, whose own literals count too.
 */
function literals(source: string): Literal[] {
  const out: Literal[] = [];
  const braces: number[] = [];
  let i = 0;
  const readString = (quote: string) => {
    const start = ++i;
    let text = "";
    while (i < source.length && source[i] !== quote) {
      if (source[i] === "\\") i++;
      else if (quote === "`" && source[i] === "$" && source[i + 1] === "{") {
        out.push({ text, at: start });
        text = "";
        i += 2;
        braces.push(0);
        return false;
      }
      text += source[i];
      i++;
    }
    out.push({ text, at: start });
    i++;
    return true;
  };
  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];
    if (char === "/" && next === "/") {
      i = source.indexOf("\n", i);
      if (i < 0) break;
    } else if (char === "/" && next === "*") {
      i = source.indexOf("*/", i) + 2;
    } else if (char === '"' || char === "'" || char === "`") {
      readString(char);
    } else if (char === "{" && braces.length > 0) {
      braces[braces.length - 1]++;
      i++;
    } else if (char === "}" && braces.length > 0) {
      if (braces[braces.length - 1] === 0) {
        // Back in the template literal the expression interrupted.
        braces.pop();
        readString("`");
      } else {
        braces[braces.length - 1]--;
        i++;
      }
    } else i++;
  }
  return out;
}

/** `touch:data-[size=sm]:h-7` as its variants and its utility, split outside brackets. */
function split(token: string): { variants: string[]; utility: string } {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < token.length; i++) {
    const char = token[i];
    if (char === "[" || char === "(") depth++;
    else if (char === "]" || char === ")") depth--;
    else if (char === ":" && depth === 0) {
      parts.push(token.slice(start, i));
      start = i + 1;
    }
  }
  const utility = token.slice(start);
  return { variants: parts, utility };
}

const RADIUS_TOKENS = [
  "control",
  "item",
  "frame",
  "surface",
  "overlay",
  "chip",
];
const SHADOW_TOKENS = ["raised", "menu", "overlay"];
const RADIUS_VAR = new RegExp(
  `var\\(--radius-(?:${RADIUS_TOKENS.join("|")})\\)`,
);
const SIDE = "(?:-(?:t|r|b|l|s|e|x|y|tl|tr|br|bl|ss|se|es|ee))?";

/** Why a utility names a literal instead of a style token, or null when it does not. */
function classProblem(utility: string): string | null {
  const radius = new RegExp(`^rounded${SIDE}(?:-(.+))?$`).exec(utility);
  if (radius) {
    const value = radius[1];
    if (value === undefined) return "a literal radius";
    if (["none", "full", "[inherit]", ...RADIUS_TOKENS].includes(value)) {
      return null;
    }
    if (value.startsWith("[") && RADIUS_VAR.test(value)) return null;
    if (value.startsWith("(--radius-")) return null;
    return "a literal radius";
  }
  const shadow = /^shadow(?:-(.+))?$/.exec(utility);
  if (shadow) {
    const value = shadow[1] ?? "";
    if (value === "none" || SHADOW_TOKENS.includes(value)) return null;
    return "a shadow that is not a style token";
  }
  if (/^text-\[[\d.]+(?:px|rem)\]$/.test(utility)) return "a literal text size";
  // Tailwind's own steps; text-base stays, as a touch input's 16px.
  if (/^text-(?:xs|sm)$/.test(utility))
    return "a text step that is not a token";
  if (utility === "font-sans" || utility.startsWith("font-[")) {
    return "a font family that is not --font-ui";
  }
  return null;
}

const CONTROL_HEIGHT = /^(?:min-h|h|size)-(?:6|7|8|9|10)$/;

/** The text of every JSX opening tag that carries a data-slot, with the consts it names. */
function slotted(source: string): string[] {
  const out: string[] = [];
  const consts = new Map<string, string>();
  for (const match of source.matchAll(/^(?:export )?const (\w+) =/gm)) {
    const start = match.index ?? 0;
    const end = source.slice(start + 1).search(/\n[^\s)}\]]/);
    consts.set(
      match[1] ?? "",
      source.slice(start, end < 0 ? undefined : start + 1 + end),
    );
  }
  for (const match of source.matchAll(/data-slot[=:]/g)) {
    const at = match.index ?? 0;
    const open = source.lastIndexOf("<", at);
    let depth = 0;
    let end = at;
    for (; end < source.length; end++) {
      const char = source[end];
      if (char === "{") depth++;
      else if (char === "}") depth--;
      else if (char === ">" && depth === 0 && source[end - 1] !== "=") break;
    }
    const tag = source.slice(open, end);
    out.push(tag);
    for (const [name, text] of consts) {
      if (new RegExp(`\\b${name}\\b`).test(tag)) out.push(text);
    }
  }
  return out;
}

interface Finding {
  file: string;
  utility: string;
  problem: string;
}

function scanSource(path: string): Finding[] {
  const file = relative(PACKAGES, path);
  const source = readFileSync(path, "utf8");
  const found: Finding[] = [];
  for (const { text } of literals(source)) {
    for (const token of text.split(/\s+/).filter(Boolean)) {
      const { utility } = split(token);
      const problem = classProblem(utility);
      if (problem) found.push({ file, utility, problem });
    }
  }
  for (const tag of slotted(source)) {
    for (const { text } of literals(tag)) {
      for (const token of text.split(/\s+/).filter(Boolean)) {
        const { variants, utility } = split(token);
        // A coarse pointer's sizes stay literal: no style may shrink them.
        if (variants.includes("touch")) continue;
        if (CONTROL_HEIGHT.test(utility)) {
          found.push({ file, utility, problem: "a literal control height" });
        }
      }
    }
  }
  // Inline styles and CodeMirror themes.
  for (const match of source.matchAll(
    /(fontFamily|fontSize|borderRadius|boxShadow):\s*(["'`])([^"'`]*)\2/g,
  )) {
    const [, property = "", , value = ""] = match;
    const kebab = property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    const problem = declarationProblem(kebab, value);
    if (problem)
      found.push({ file, utility: `${property}: ${value}`, problem });
  }
  return found;
}

/** Why a declaration's value is a literal a style token should hold, or null when it is not. */
function declarationProblem(property: string, value: string): string | null {
  switch (property) {
    case "border-radius":
      return /^(?:0|inherit)$/.test(value) || RADIUS_VAR.test(value)
        ? null
        : "a literal radius";
    case "font-family":
      return value.startsWith("var(") || value === "inherit"
        ? null
        : "a font family that is not a token";
    case "font-size":
      return /^[\d.]+(?:px|rem)$/.test(value) ? "a literal text size" : null;
    case "box-shadow":
      return value === "none" || value.includes("var(--shadow-")
        ? null
        : "a shadow that is not a style token";
    default:
      return null;
  }
}

function scanStylesheet(path: string): Finding[] {
  const file = relative(PACKAGES, path);
  const css = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const found: Finding[] = [];
  for (const match of css.matchAll(/([\w-]+):\s*([^;{}]+);/g)) {
    const [, property = "", value = ""] = match;
    const flat = value.replace(/\s+/g, " ").trim();
    const problem = declarationProblem(property, flat);
    if (problem) found.push({ file, utility: `${property}: ${flat}`, problem });
  }
  return found;
}

const findings = [
  ...sources.flatMap(scanSource),
  ...stylesheets.flatMap(scanStylesheet),
];

const allowed = (finding: Finding) =>
  ALLOWED.some(
    (entry) => entry.file === finding.file && entry.utility === finding.utility,
  );

describe("style tokens", () => {
  it("scans every package's sources and stylesheets", () => {
    expect(sources.length).toBeGreaterThan(50);
    expect(stylesheets.map((path) => relative(PACKAGES, path))).toContain(
      "ui-hex/styles.css",
    );
  });

  it("leaves no literal radius, control height, shadow, text size or font family", () => {
    expect(
      findings
        .filter((finding) => !allowed(finding))
        .map((f) => `${f.file}: ${f.utility} (${f.problem})`),
    ).toEqual([]);
  });

  it("keeps no exception that nothing uses", () => {
    const unused = ALLOWED.filter(
      (entry) =>
        !findings.some(
          (finding) =>
            finding.file === entry.file && finding.utility === entry.utility,
        ),
    );
    expect(unused).toEqual([]);
  });

  it("knows the literals it looks for", () => {
    expect(classProblem("rounded-md")).not.toBeNull();
    expect(classProblem("rounded")).not.toBeNull();
    expect(classProblem("rounded-t-xl")).not.toBeNull();
    expect(classProblem("rounded-[3px]")).not.toBeNull();
    expect(classProblem("rounded-control")).toBeNull();
    expect(classProblem("rounded-b-surface")).toBeNull();
    expect(classProblem("rounded-[min(var(--radius-control),8px)]")).toBeNull();
    expect(classProblem("rounded-[min(var(--radius-md),8px)]")).not.toBeNull();
    expect(classProblem("shadow-lg")).not.toBeNull();
    expect(classProblem("shadow-menu")).toBeNull();
    expect(classProblem("text-[11px]")).not.toBeNull();
    expect(classProblem("text-[0.85em]")).toBeNull();
    expect(classProblem("text-sm")).not.toBeNull();
    expect(classProblem("text-ui")).toBeNull();
    expect(classProblem("text-base")).toBeNull();
    expect(classProblem("font-sans")).not.toBeNull();
    expect(
      scanSource(join(PACKAGES, "ui/src/components/button.tsx")).filter(
        (finding) => finding.problem === "a literal control height",
      ),
    ).toEqual([]);
  });
});

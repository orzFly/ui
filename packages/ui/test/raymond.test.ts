import { readFileSync } from "node:fs";
import { join } from "node:path";
import { raymondStyle } from "@orz/themes";
import { describe, expect, it } from "vitest";

// Not `new URL(…, import.meta.url)`: under happy-dom `URL` is the window's
// class, which node:fs refuses as a file URL.
const CSS = readFileSync(
  join(import.meta.dirname, "../styles/raymond.css"),
  "utf8",
);

interface Rule {
  /** The enclosing @layer, or "" outside any. */
  layer: string;
  selector: string;
  declarations: Record<string, string>;
}

/** The style rules of a stylesheet with no nesting beyond @layer, comments dropped. */
function rulesOf(css: string): Rule[] {
  const text = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // A statement at-rule has no block; left in, it would join the next prelude.
    .replace(/@custom-variant[^;{]*;/g, "");
  const rules: Rule[] = [];
  const layers: (string | null)[] = [];
  let head = "";
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "{") {
      const prelude = head.trim();
      head = "";
      const layer = /^@layer\s+([\w-]+)$/.exec(prelude);
      if (layer) {
        layers.push(layer[1]);
        continue;
      }
      // A style rule's body: its declarations, up to the matching brace.
      let end = i + 1;
      let open = 1;
      while (open > 0) {
        if (text[end] === "{") open++;
        if (text[end] === "}") open--;
        end++;
      }
      const body = text.slice(i + 1, end - 1);
      const declarations: Record<string, string> = {};
      for (const part of body.split(/;(?![^(]*\))/)) {
        const colon = part.indexOf(":");
        if (colon < 0) continue;
        declarations[part.slice(0, colon).trim()] = part
          .slice(colon + 1)
          .replace(/\s+/g, " ")
          .trim();
      }
      rules.push({
        layer: (layers.filter(Boolean).at(-1) as string) ?? "",
        selector: prelude.replace(/\s+/g, " "),
        declarations,
      });
      depth = 0;
      i = end - 1;
    } else if (c === "}") {
      layers.pop();
    } else {
      head += c;
    }
  }
  expect(depth).toBe(0);
  return rules;
}

const rules = rulesOf(CSS);
const tokenBlock = rules.find((r) => r.selector === '[data-style="raymond"]');

describe("raymond.css", () => {
  it("holds its tokens and draws no part, all in the base layer", () => {
    expect(tokenBlock).toBeDefined();
    for (const rule of rules) {
      expect(rule.layer, rule.selector).toBe("base");
      if (rule === tokenBlock) continue;
      // A part's look is its component's own raymond: classes. What is left
      // belongs to no component: the scroll bars and selected text.
      expect(rule.selector, rule.selector).toMatch(
        /^\[data-style="raymond"\] ::(-webkit-scrollbar|selection)/,
      );
    }
    expect(CSS).not.toContain("!important");
  });

  it("defines the raymond variant that theme.css declares to draw nothing", () => {
    expect(CSS).toContain(
      '@custom-variant raymond (&:is([data-style="raymond"] *));',
    );
    const theme = readFileSync(
      join(import.meta.dirname, "../theme.css"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");
    const placeholder =
      /@custom-variant raymond\s*\{([^}]*\{[^}]*\})?\s*\}/.exec(theme);
    expect(placeholder).not.toBeNull();
    expect(placeholder?.[0]).not.toContain("@slot");
  });

  it("falls back for every colour its palettes supply", () => {
    for (const token of raymondStyle.tokens ?? []) {
      expect(tokenBlock?.declarations, token).toHaveProperty(`--${token}`);
    }
  });
});

describe("raymond touch sizing", () => {
  // A coarse pointer's sizes are literal touch: utilities (touch-sizing.test
  // holds the components to them). raymond reaches a control's size only
  // through the tokens those utilities replace, so nothing here can shrink a
  // touch target.
  it("keeps every control and row token at or under the touch sizes", () => {
    const px = (value: string) => Number.parseFloat(value) * 16;
    const sizes = Object.entries(tokenBlock?.declarations ?? {}).filter(
      ([name]) => /^--spacing-(control|row)/.test(name),
    );
    expect(sizes.length).toBe(7);
    for (const [name, value] of sizes) {
      expect(value, name).toMatch(/^[\d.]+rem$/);
      expect(px(value), name).toBeLessThan(40);
    }
  });
});

describe("raymond focus", () => {
  it("draws a visible focus rectangle", () => {
    const tokens = tokenBlock?.declarations ?? {};
    expect(tokens["--focus-style"]).toBe("dotted");
    expect(Number.parseFloat(tokens["--focus-width"])).toBeGreaterThanOrEqual(
      1,
    );
  });
});

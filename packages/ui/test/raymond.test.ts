import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { raymondStyle } from "@orz/themes";
import { describe, expect, it } from "vitest";

// Not `new URL(…, import.meta.url)`: under happy-dom `URL` is the window's
// class, which node:fs refuses as a file URL.
const PACKAGES = join(import.meta.dirname, "../..");
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
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
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

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

const sources = readdirSync(PACKAGES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) => {
    try {
      return walk(join(PACKAGES, entry.name, "src"));
    } catch {
      return [];
    }
  })
  .map((path) => ({ path, text: readFileSync(path, "utf8") }));

describe("raymond.css", () => {
  it("assigns its tokens in the base layer and draws slots in the components layer", () => {
    expect(tokenBlock?.layer).toBe("base");
    for (const rule of rules) {
      if (rule === tokenBlock) continue;
      // @orz/ui-code's own surface rule is unlayered, so the one that
      // repaints it is too.
      if (rule.selector === '[data-style="raymond"] diffs-container') {
        expect(rule.layer, rule.selector).toBe("");
        continue;
      }
      expect(rule.layer, rule.selector).toBe("components");
      expect(rule.selector, rule.selector).toMatch(/^\[data-style="raymond"\]/);
    }
    expect(CSS).not.toContain("!important");
  });

  it("names only slots that exist", () => {
    const named = new Set(
      [...CSS.matchAll(/\[data-slot="([\w-]+)"\]/g)].map((m) => m[1]),
    );
    expect(named.size).toBeGreaterThan(10);
    const missing = [...named].filter(
      (slot) =>
        !sources.some(({ text }) => text.includes(`data-slot="${slot}"`)),
    );
    expect(missing).toEqual([]);
  });

  it("finds a Button by its variant and size, which no other part sets together", () => {
    // As a trigger or a close button, a Button carries that part's data-slot.
    expect(CSS).toContain("[data-variant][data-size]");
    const both = sources.filter(
      ({ text }) =>
        text.includes("data-variant={") && text.includes("data-size={"),
    );
    expect(both.map(({ path }) => path.slice(PACKAGES.length + 1))).toEqual([
      "ui/src/components/button.tsx",
    ]);
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
  // through the tokens those utilities replace, and its slot rules sit below
  // the utilities, so nothing here can shrink a touch target.
  const SIZE = /^(min-|max-)?(height|width|block-size|inline-size)$/;
  const TITLE_BAR = '[data-style="raymond"] [data-slot="dialog-title"]';

  it("sets no size in a slot rule but a title bar's height", () => {
    const sized = rules.flatMap((rule) =>
      Object.keys(rule.declarations)
        .filter((property) => SIZE.test(property))
        .map((property) => `${rule.selector} ${property}`),
    );
    expect(sized).toEqual([
      `${TITLE_BAR}, [data-style="raymond"] [data-slot="sheet-title"] min-height`,
    ]);
  });

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

  it("moves the rectangle on a slot but never hides it", () => {
    for (const rule of rules) {
      if (rule === tokenBlock) continue;
      for (const [property, value] of Object.entries(rule.declarations)) {
        expect(property, rule.selector).not.toMatch(
          /^(--focus-(width|style)|outline-(style|width))$/,
        );
        if (property === "outline") {
          // The legend's mask on a card header's parts, none of them focusable.
          expect(rule.selector, value).toContain('[data-slot="card-header"]');
        }
        if (property === "--focus-offset") {
          // Inside a push button's or a tab's bevel, never past its middle.
          expect(
            Number.parseFloat(value),
            rule.selector,
          ).toBeGreaterThanOrEqual(-4);
        }
      }
    }
  });
});

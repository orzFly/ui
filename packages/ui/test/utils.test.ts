import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { cn } from "../src/index.ts";

test("cn lets a later Tailwind class override a conflicting earlier one", () => {
  expect(cn("px-2 py-1", false && "hidden", "px-4")).toBe("py-1 px-4");
});

test("cn knows the style tokens' utilities for what they are", () => {
  expect(cn("rounded-control", "rounded-none")).toBe("rounded-none");
  expect(cn("h-control touch:h-field-touch", "h-full")).toBe(
    "touch:h-field-touch h-full",
  );
  expect(cn("h-control touch:h-field-touch", "touch:h-auto")).toBe(
    "h-control touch:h-auto",
  );
  expect(cn("touch:min-h-touch", "touch:min-h-0")).toBe("touch:min-h-0");
  expect(cn("touch:min-w-touch", "touch:min-w-0")).toBe("touch:min-w-0");
  expect(cn("min-h-row", "min-h-0")).toBe("min-h-0");
  expect(cn("touch:pr-hit-xs", "touch:pr-0")).toBe("touch:pr-0");
  expect(cn("touch:mx-hit-sm", "touch:mr-hit-lg")).toBe(
    "touch:mx-hit-sm touch:mr-hit-lg",
  );
  expect(cn("shadow-overlay", "shadow-none")).toBe("shadow-none");
  expect(cn("font-ui", "font-mono")).toBe("font-mono");
  // A text size, not a colour: a colour beside it keeps it, a size replaces it.
  expect(cn("text-ui-sm", "text-muted-foreground")).toBe(
    "text-ui-sm text-muted-foreground",
  );
  expect(cn("text-sm", "text-ui-sm")).toBe("text-ui-sm");
  expect(cn("text-ui", "text-card-foreground")).toBe(
    "text-ui text-card-foreground",
  );
  expect(cn("text-ui", "text-ui-sm")).toBe("text-ui-sm");
  // ModuleGrid's padding and gap give way to a caller's.
  expect(cn("gap-module p-module", "p-0")).toBe("gap-module p-0");
  expect(cn("gap-module p-module", "gap-2")).toBe("p-module gap-2");
  // A size set apart for prose sits beside a colour, as text-ui does.
  expect(cn("text-prose-sm text-muted-foreground")).toBe(
    "text-prose-sm text-muted-foreground",
  );
  expect(cn("leading-prose", "leading-none")).toBe("leading-none");
});

// Not `new URL(…, import.meta.url)`: under happy-dom `URL` is the window's
// class, which node:fs refuses as a file URL.
const THEME = readFileSync(
  join(import.meta.dirname, "../theme.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

/** Every custom property the `@theme` blocks declare, without its `--`. */
const declared = [...THEME.matchAll(/@theme[^{]*\{([^}]*)\}/g)]
  .flatMap(([, body]) => [...body.matchAll(/^\s*--([\w-]+)\s*:/gm)])
  .map(([, name]) => name)
  // `--text-ui--line-height` rides along with `--text-ui`; it is no utility.
  .filter((name) => !name.includes("--"));

/**
 * How cn() must merge a token's utility, per Tailwind namespace: what replaces
 * it, and what stands beside it. The replacements are names theme.css does
 * not declare, so no token is checked against itself.
 */
const MERGES: Record<string, (name: string) => [string, string, string][]> = {
  // tailwind-merge builds its padding, margin, gap, inset and size scales
  // from one list of spacing names; a utility from each shows the token
  // reaches them all.
  spacing: (n) => [
    [`p-${n}`, "p-0", "p-0"],
    [`m-${n}`, "m-0", "m-0"],
    [`gap-${n}`, "gap-0", "gap-0"],
    [`inset-${n}`, "inset-0", "inset-0"],
    [`h-${n}`, "h-auto", "h-auto"],
  ],
  radius: (n) => [[`rounded-${n}`, "rounded-none", "rounded-none"]],
  text: (n) => [
    [`text-${n}`, "text-sm", "text-sm"],
    [`text-${n}`, "text-red-500", `text-${n} text-red-500`],
  ],
  leading: (n) => [[`leading-${n}`, "leading-none", "leading-none"]],
  font: (n) => [
    [`font-${n}`, "font-serif", "font-serif"],
    [`font-${n}`, "font-bold", `font-${n} font-bold`],
  ],
  color: (n) => [
    [`bg-${n}`, "bg-red-500", "bg-red-500"],
    [`text-${n}`, "text-sm", `text-${n} text-sm`],
  ],
};

/** Namespaces that make no utility tailwind-merge sorts, each with why. */
const UNSORTED: Record<string, string> = {
  translate:
    "read by tw-animate-css's slide-in-from-* and slide-out-to-* (slide-in-from-top-overlay), which tailwind-merge does not know",
  duration:
    "read as duration-(--duration-overlay), an arbitrary value tailwind-merge sorts without a name",
  focus: "no Tailwind namespace: read by the focus-ring utilities",
  overlay: "no Tailwind namespace: read as zoom-in-(--overlay-zoom)",
};

function namespaceOf(name: string): string | undefined {
  return [...Object.keys(MERGES), ...Object.keys(UNSORTED)].find((ns) =>
    name.startsWith(`${ns}-`),
  );
}

describe("cn() and theme.css", () => {
  test("theme.css still declares tokens in every namespace checked here", () => {
    for (const ns of Object.keys(MERGES)) {
      expect(
        declared.some((name) => namespaceOf(name) === ns),
        ns,
      ).toBe(true);
    }
  });

  test("every token theme.css declares is in a namespace checked here", () => {
    expect(declared.filter((name) => !namespaceOf(name))).toEqual([]);
  });

  test.each(
    declared.flatMap((name) => {
      const ns = namespaceOf(name);
      if (!ns || !(ns in MERGES)) return [];
      return MERGES[ns](name.slice(ns.length + 1)).map(
        ([token, other, merged]) => ({ name, token, other, merged }),
      );
    }),
  )("--$name: cn($token, $other) is $merged", ({ token, other, merged }) => {
    expect(cn(token, other)).toBe(merged);
  });

  test.each(
    [...THEME.matchAll(/@utility (shadow-[\w-]+)\s*\{/g)].map(([, token]) => ({
      token,
    })),
  )("@utility $token gives way to shadow-none", ({ token }) => {
    expect(cn(token, "shadow-none")).toBe("shadow-none");
  });
});

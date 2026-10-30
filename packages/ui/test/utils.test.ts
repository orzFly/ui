import { expect, test } from "vitest";
import { cn } from "../src/index.ts";

test("cn lets a later Tailwind class override a conflicting earlier one", () => {
  expect(cn("px-2 py-1", false && "hidden", "px-4")).toBe("py-1 px-4");
});

test("cn knows the style tokens' utilities for what they are", () => {
  expect(cn("rounded-control", "rounded-none")).toBe("rounded-none");
  expect(cn("h-control touch:h-10", "h-full")).toBe("touch:h-10 h-full");
  expect(cn("min-h-row", "min-h-0")).toBe("min-h-0");
  expect(cn("shadow-overlay", "shadow-none")).toBe("shadow-none");
  expect(cn("font-ui", "font-mono")).toBe("font-mono");
  // A text size, not a colour: a colour beside it keeps it, a size replaces it.
  expect(cn("text-ui-sm", "text-muted-foreground")).toBe(
    "text-ui-sm text-muted-foreground",
  );
  expect(cn("text-sm", "text-ui-sm")).toBe("text-ui-sm");
});

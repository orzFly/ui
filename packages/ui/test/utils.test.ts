import { expect, test } from "vitest";
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
});

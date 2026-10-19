import { expect, test } from "vitest";
import { cn } from "../src/index.ts";

test("cn lets a later Tailwind class override a conflicting earlier one", () => {
  expect(cn("px-2 py-1", false && "hidden", "px-4")).toBe("py-1 px-4");
});

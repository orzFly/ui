import { render } from "@testing-library/react";
import { InboxIcon } from "lucide-react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "../src/components/empty-state.tsx";

describe("EmptyState", () => {
  // lucide's icons are forwardRef objects, not functions, so a check on
  // `typeof icon` would take them for elements.
  it("draws a forwardRef icon component at the state's size", () => {
    const { container } = render(
      <EmptyState icon={InboxIcon} title="Nothing in Archive" />,
    );
    expect(container.querySelector("svg")?.getAttribute("class")).toContain(
      "size-8",
    );
  });

  it("draws an element as given", () => {
    const { container } = render(
      <EmptyState icon={<svg className="h-12 w-16" />} title="No notes yet" />,
    );
    expect(container.querySelector("svg")?.getAttribute("class")).toBe(
      "h-12 w-16",
    );
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "../src/components/badge.tsx";

describe("Badge", () => {
  it("draws marker in the module marker's colours, its fill kept under raymond's static edge", () => {
    render(<Badge variant="marker">3</Badge>);
    const badge = screen.getByText("3");
    expect(badge.dataset.variant).toBe("marker");
    const classes = badge.className.split(/\s+/);
    expect(classes).toEqual(
      expect.arrayContaining([
        "bg-marker",
        "text-primary",
        "border-primary/35",
        "raymond:shadow-[inset_1px_1px_var(--3d-shadow),inset_-1px_-1px_var(--3d-highlight)]",
        "raymond:bg-marker",
        "raymond:dark:bg-marker",
      ]),
    );
    expect(classes).not.toContain("raymond:bg-transparent");
    expect(classes).not.toContain("raymond:dark:bg-transparent");
  });
});

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "../src/components/card.tsx";

describe("Card", () => {
  // A hidden overflow makes the card a scroll container, which a flex column
  // squashes to its padding (UI-265); clip draws the same without that.
  it("clips its overflow rather than hiding it, and still narrows", () => {
    const { container } = render(<Card>Card 1</Card>);
    const classes = container.firstElementChild?.classList;
    expect(classes?.contains("overflow-clip")).toBe(true);
    expect(classes?.contains("overflow-hidden")).toBe(false);
    expect(classes?.contains("min-w-0")).toBe(true);
  });
});

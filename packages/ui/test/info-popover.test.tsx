import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InfoPopover } from "../src/components/info-popover.tsx";

describe("InfoPopover", () => {
  it("names its button More information unless told otherwise", () => {
    render(<InfoPopover>Tidies each file on save.</InfoPopover>);
    expect(
      screen.getByRole("button", { name: "More information" }),
    ).toBeTruthy();
  });

  // A tooltip never opens on touch; the explanation has to come up on a press
  // (and on Enter or Space, which reach the same click) rather than on hover.
  it("opens its explanation on a click, not on hover", () => {
    render(
      <InfoPopover label="About format on save">
        Tidies each file on save.
      </InfoPopover>,
    );
    const trigger = screen.getByRole("button", {
      name: "About format on save",
    });
    fireEvent.pointerEnter(trigger);
    expect(screen.queryByText("Tidies each file on save.")).toBeNull();
    fireEvent.click(trigger);
    expect(screen.getByText("Tidies each file on save.")).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });
});

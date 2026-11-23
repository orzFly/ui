import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Checkbox } from "../src/components/checkbox.tsx";
import { RadioGroup, RadioGroupItem } from "../src/components/radio-group.tsx";
import { Switch } from "../src/components/switch.tsx";

const classesOf = (el: Element) => el.className.split(/\s+/);

// Inside a form, Radix renders a hidden input after the control and pulls it back over the
// control by its own width. That lands on the control only when both share a line; after a
// block-level control the input drops to the next line, out of a table cell and into the
// table's scroll.
describe("a control Radix follows with a hidden form input", () => {
  it("is drawn inline-level", () => {
    render(
      <form>
        <Checkbox aria-label="C" />
        <RadioGroup aria-label="R">
          <RadioGroupItem value="a" aria-label="A" />
        </RadioGroup>
        <Switch aria-label="S" />
      </form>,
    );
    for (const role of ["checkbox", "radio", "switch"]) {
      const control = screen.getByRole(role);
      expect(control.nextElementSibling?.tagName).toBe("INPUT");
      expect(classesOf(control)).toContain("inline-flex");
      expect(classesOf(control)).not.toContain("flex");
    }
  });
});

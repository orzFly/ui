import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Checkbox } from "../src/components/checkbox.tsx";
import { RadioGroup, RadioGroupItem } from "../src/components/radio-group.tsx";

// `dark:bg-input/15` and `data-[state=checked]:bg-primary` are equally
// specific, and Tailwind sorts the dark: rule after the data-* one, so in
// dark mode a checked control keeps its resting fill and its mark, drawn in
// --primary-foreground, sinks into the background. Each state's fill is
// restated under dark: to win back.

const CONTROLS = [
  {
    name: "Checkbox",
    element: () => render(<Checkbox checked />).getByRole("checkbox"),
  },
  {
    name: "RadioGroupItem",
    element: () =>
      render(
        <RadioGroup value="a">
          <RadioGroupItem value="a" />
        </RadioGroup>,
      ).getByRole("radio"),
  },
];

const STATE_FILL = /^(data-\[state=[\w-]+\]):bg-/;

describe("a state's fill in dark mode", () => {
  for (const { name, element } of CONTROLS) {
    it(`${name} restates each state's fill under dark:`, () => {
      const classes = element().className.split(/\s+/);
      expect(classes.some((c) => /^dark:bg-/.test(c))).toBe(true);
      const states = classes.flatMap((c) => STATE_FILL.exec(c)?.[1] ?? []);
      expect(states.length).toBeGreaterThan(0);
      for (const state of states) {
        expect(
          classes.some((c) => c.startsWith(`dark:${state}:bg-`)),
          `dark:${state}:bg-…`,
        ).toBe(true);
      }
    });
  }
});

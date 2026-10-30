import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { todouSchema } from "../../query/test/fixtures/todou-schema.ts";
import { Button } from "../src/components/button.tsx";
import { Checkbox } from "../src/components/checkbox.tsx";
import { ColorPicker } from "../src/components/color-picker.tsx";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../src/components/dropdown-menu.tsx";
import {
  FilterMenu,
  type FilterMenuSection,
} from "../src/components/filter-menu.tsx";
import { HighlightedInput } from "../src/components/highlighted-input.tsx";
import { Input } from "../src/components/input.tsx";
import { QueryBox } from "../src/components/query-box.tsx";
import { RadioGroup, RadioGroupItem } from "../src/components/radio-group.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../src/components/select.tsx";
import { Slider } from "../src/components/slider.tsx";
import { Switch } from "../src/components/switch.tsx";
import { Tabs, TabsList, TabsTrigger } from "../src/components/tabs.tsx";
import { Textarea } from "../src/components/textarea.tsx";

// Not `new URL(…, import.meta.url)`: under happy-dom `URL` is the window's
// class, which node:fs refuses as a file URL.
const THEME = readFileSync(join(import.meta.dirname, "../theme.css"), "utf8");

const classesOf = (el: Element) => el.className.split(/\s+/);

/** The drawn box keeps its size; touch only adds the 44px ::after. */
function expectHitAreaOnly(el: Element) {
  const classes = classesOf(el);
  expect(classes).toContain("relative");
  expect(classes).toContain("touch:hit-area");
  expect(classes.filter((c) => /^touch:(h|size|min-h)-/.test(c))).toEqual([]);
}

describe("theme.css touch variant", () => {
  it("follows the primary pointer and a data-pointer ancestor", () => {
    const block = THEME.slice(
      THEME.indexOf("@custom-variant touch"),
      THEME.indexOf("@utility hit-area"),
    );
    expect(block).toContain("@media (pointer: coarse)");
    expect(block).toContain('&:not([data-pointer="fine"] *)');
    expect(block).toContain('&:where([data-pointer="coarse"] *)');
  });

  it("defines hit-area as a centred ::after of at least 44px", () => {
    const start = THEME.indexOf("@utility hit-area");
    const block = THEME.slice(start, THEME.indexOf("\n}", start));
    expect(block).toContain("&::after");
    expect(block).toContain("min-width: 44px");
    expect(block).toContain("min-height: 44px");
    expect(block).not.toContain("position: relative");
  });
});

describe("touch sizes", () => {
  it("Button default and lg grow, to 40px and 44px, with a hit area", () => {
    render(
      <>
        <Button>Default</Button>
        <Button size="lg">Large</Button>
      </>,
    );
    const button = screen.getByRole("button", { name: "Default" });
    expect(classesOf(button)).toEqual(
      expect.arrayContaining(["relative", "touch:hit-area", "touch:h-10"]),
    );
    expect(classesOf(screen.getByRole("button", { name: "Large" }))).toEqual(
      expect.arrayContaining(["touch:hit-area", "touch:h-11"]),
    );
  });

  it.each(["xs", "sm", "icon", "icon-xs", "icon-sm", "icon-lg"] as const)(
    "Button %s keeps its drawn size",
    (size) => {
      render(<Button size={size}>B</Button>);
      expectHitAreaOnly(screen.getByRole("button"));
    },
  );

  it("a caller's position wins over Button's relative", () => {
    render(<Button className="absolute">B</Button>);
    const classes = classesOf(screen.getByRole("button"));
    expect(classes).toContain("absolute");
    expect(classes).not.toContain("relative");
  });

  it("Switch, Checkbox and RadioGroupItem keep their drawn size", () => {
    render(
      <>
        <Switch aria-label="S" />
        <Checkbox aria-label="C" />
        <RadioGroup aria-label="R">
          <RadioGroupItem value="a" aria-label="A" />
        </RadioGroup>
      </>,
    );
    expectHitAreaOnly(screen.getByRole("switch"));
    expectHitAreaOnly(screen.getByRole("checkbox"));
    expectHitAreaOnly(screen.getByRole("radio"));
  });

  it("RadioGroup spaces its rows 44px apart, so hit areas do not overlap", () => {
    render(
      <RadioGroup aria-label="R">
        <RadioGroupItem value="a" aria-label="A" />
      </RadioGroup>,
    );
    expect(classesOf(screen.getByRole("radiogroup"))).toContain("touch:gap-7");
  });

  it("Input draws 40px and keeps 16px text, so iOS does not zoom", () => {
    render(<Input aria-label="I" />);
    expect(classesOf(screen.getByRole("textbox"))).toEqual(
      expect.arrayContaining(["touch:h-10", "touch:text-base"]),
    );
  });

  it("Textarea keeps 16px text at every width", () => {
    render(<Textarea aria-label="T" />);
    expect(classesOf(screen.getByRole("textbox"))).toContain("touch:text-base");
  });

  it("HighlightedInput draws 40px, with 16px text in both layers", () => {
    const { container } = render(
      <HighlightedInput
        aria-label="H"
        value="a"
        onValueChange={() => {}}
        render={(text) => text}
      />,
    );
    const box = container.firstElementChild as Element;
    expect(classesOf(box)).toContain("touch:h-10");
    const mirror = box.querySelector("[aria-hidden]") as Element;
    for (const layer of [mirror, screen.getByRole("textbox")]) {
      expect(classesOf(layer)).toContain("touch:text-base");
    }
  });

  it("QueryBox suggestion rows are 44px rows", () => {
    render(
      <QueryBox
        schema={todouSchema}
        providers={{}}
        value="har"
        onValueChange={() => {}}
        onSubmit={() => {}}
        renderSubmitRow={(query, option) => <div {...option}>{query}</div>}
        inputProps={{ "aria-label": "Search" }}
      />,
    );
    act(() => screen.getByLabelText("Search").focus());
    const rows = screen.getAllByRole("option");
    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows) expect(classesOf(row)).toContain("touch:min-h-11");
  });

  it("FilterMenu rows are 44px rows; its search field keeps 16px text", () => {
    const sections: FilterMenuSection<{ id: string }>[] = [
      { id: "s", label: "S", rows: [{ id: "a" }, { id: "b" }] },
    ];
    render(
      <FilterMenu
        query=""
        onQueryChange={() => {}}
        sections={sections}
        onSelect={() => {}}
        renderRow={(row) => row.id}
        inputLabel="Filter"
        listLabel="Rows"
      >
        <button type="button">Pick</button>
      </FilterMenu>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Pick" }));
    expect(classesOf(screen.getByRole("combobox", { name: "Filter" }))).toEqual(
      expect.arrayContaining(["touch:h-10", "touch:text-base"]),
    );
    const rows = screen.getAllByRole("option");
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(classesOf(row)).toContain("touch:min-h-11");
  });

  it("Select trigger grows at the default size; its items are 44px rows", () => {
    render(
      <Select open defaultValue="a">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>,
    );
    const trigger = document.querySelector('[data-slot="select-trigger"]');
    expect(classesOf(trigger as Element)).toEqual(
      expect.arrayContaining([
        "relative",
        "touch:hit-area",
        "touch:data-[size=default]:h-10",
      ]),
    );
    const item = document.querySelector('[data-slot="select-item"]');
    expect(classesOf(item as Element)).toContain("touch:min-h-11");
  });

  it("DropdownMenu items of every kind are 44px rows", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item</DropdownMenuItem>
          <DropdownMenuCheckboxItem checked>Check</DropdownMenuCheckboxItem>
          <DropdownMenuRadioGroup value="a">
            <DropdownMenuRadioItem value="a">Radio</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    for (const slot of [
      "dropdown-menu-item",
      "dropdown-menu-checkbox-item",
      "dropdown-menu-radio-item",
      "dropdown-menu-sub-trigger",
    ]) {
      const row = document.querySelector(`[data-slot="${slot}"]`);
      expect(classesOf(row as Element), slot).toContain("touch:min-h-11");
    }
  });

  it("Tabs triggers draw 40px with a 44px hit area", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    expect(classesOf(screen.getByRole("tab"))).toEqual(
      expect.arrayContaining(["relative", "touch:hit-area", "touch:min-h-10"]),
    );
  });

  it("Slider keeps its drawn size; its bar and its thumb have hit areas", () => {
    const { container } = render(
      <>
        <Slider aria-label="H" defaultValue={[50]} />
        <Slider aria-label="V" orientation="vertical" defaultValue={[50]} />
      </>,
    );
    for (const root of container.querySelectorAll('[data-slot="slider"]')) {
      expectHitAreaOnly(root);
      // Under the thumb, so a press on it grabs it instead of jumping.
      expect(classesOf(root)).toEqual(
        expect.arrayContaining(["touch:isolate", "touch:after:-z-10"]),
      );
    }
    for (const thumb of screen.getAllByRole("slider")) expectHitAreaOnly(thumb);
  });

  it("ColorPicker swatches widen to six a row, with a hit area", () => {
    render(
      <ColorPicker
        value="#3b82f6"
        onValueChange={() => {}}
        swatches={["#ef4444", "#3b82f6"]}
      />,
    );
    const swatch = screen.getByRole("button", { name: "#ef4444" });
    expect(classesOf(swatch)).toEqual(
      expect.arrayContaining(["relative", "touch:hit-area"]),
    );
    expect(classesOf(swatch.parentElement as Element)).toEqual(
      expect.arrayContaining(["touch:grid-cols-6", "touch:gap-2"]),
    );
  });
});

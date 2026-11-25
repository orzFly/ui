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
import {
  NavList,
  NavListGroup,
  NavListGroupContent,
  NavListGroupRow,
  NavListGroupToggle,
  NavListHeading,
  NavListItem,
  NavListLink,
} from "../src/components/nav-list.tsx";
import { NumberInput } from "../src/components/number-input.tsx";
import { QueryBox } from "../src/components/query-box.tsx";
import { RadioGroup, RadioGroupItem } from "../src/components/radio-group.tsx";
import {
  Reorder,
  ReorderButtons,
  ReorderHandle,
  ReorderItem,
} from "../src/components/reorder.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../src/components/select.tsx";
import { Slider } from "../src/components/slider.tsx";
import {
  SplitButton,
  SplitButtonAction,
  SplitButtonMenu,
} from "../src/components/split-button.tsx";
import { Switch } from "../src/components/switch.tsx";
import { TabNav, TabNavLink } from "../src/components/tab-nav.tsx";
import { Tabs, TabsList, TabsTrigger } from "../src/components/tabs.tsx";
import { Textarea } from "../src/components/textarea.tsx";
import {
  Toolbar,
  ToolbarButton,
  ToolbarOverflow,
} from "../src/components/toolbar.tsx";

// Not `new URL(…, import.meta.url)`: under happy-dom `URL` is the window's
// class, which node:fs refuses as a file URL.
const THEME = readFileSync(join(import.meta.dirname, "../theme.css"), "utf8");

const classesOf = (el: Element) => el.className.split(/\s+/);

/** The drawn box keeps its size; touch only adds the ::after of the touch spacing. */
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

  it("defines can-hover by the hover media query, which data-pointer overrides", () => {
    const start = THEME.indexOf("@custom-variant can-hover");
    const block = THEME.slice(start, THEME.indexOf("\n}", start));
    expect(block).toContain("@media (hover: hover)");
    expect(block).toContain('&:not([data-pointer="coarse"] *)');
    expect(block).toContain('&:where([data-pointer="fine"] *)');
  });

  it("defines hit-area as a centred ::after of at least the touch spacing", () => {
    const start = THEME.indexOf("@utility hit-area");
    const block = THEME.slice(start, THEME.indexOf("\n}", start));
    expect(block).toContain("&::after");
    expect(block).toContain("min-width: var(--spacing-touch)");
    expect(block).toContain("min-height: var(--spacing-touch)");
    expect(block).not.toContain("position: relative");
  });

  it("keeps the hit area out of a scroller's overflow, and lines the control up by its middle", () => {
    const start = THEME.indexOf("@utility hit-area");
    const block = THEME.slice(start, THEME.indexOf("\n}", start));
    expect(block).toContain("contain: layout");
    expect(block).toContain("vertical-align: middle");
  });
});

describe("touch sizes", () => {
  it.each([
    "default",
    "xs",
    "sm",
    "lg",
    "icon",
    "icon-xs",
    "icon-sm",
    "icon-lg",
  ] as const)("Button %s keeps its drawn height", (size) => {
    render(<Button size={size}>B</Button>);
    expectHitAreaOnly(screen.getByRole("button"));
  });

  it.each(["default", "xs", "sm", "lg"] as const)(
    "Button %s, as wide as its words, is drawn at least the touch spacing wide",
    (size) => {
      render(<Button size={size}>OK</Button>);
      expect(classesOf(screen.getByRole("button"))).toContain(
        "touch:min-w-touch",
      );
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

  it("RadioGroup spaces its rows the touch spacing apart in every style, so hit areas do not overlap", () => {
    render(
      <RadioGroup aria-label="R">
        <RadioGroupItem value="a" aria-label="A" />
      </RadioGroup>,
    );
    // What a 16px radio leaves of the spacing; under raymond a 12px one.
    expect(classesOf(screen.getByRole("radiogroup"))).toEqual(
      expect.arrayContaining([
        "touch:gap-[calc(var(--spacing-touch)-1rem)]",
        "raymond:touch:gap-[calc(var(--spacing-touch)-0.75rem)]",
      ]),
    );
  });

  it("Input draws its 16px text, which iOS does not zoom, in a field tall enough for it", () => {
    render(<Input aria-label="I" />);
    expect(classesOf(screen.getByRole("textbox"))).toEqual(
      expect.arrayContaining(["touch:h-field-touch", "touch:text-base"]),
    );
  });

  it("NumberInput draws a field's height with 16px text, its step buttons side by side and the touch spacing wide", () => {
    const { container } = render(<NumberInput aria-label="N" />);
    expect(
      classesOf(
        container.querySelector('[data-slot="number-input"]') as Element,
      ),
    ).toEqual(
      expect.arrayContaining(["touch:h-field-touch", "touch:text-base"]),
    );
    expect(
      classesOf(
        container.querySelector('[data-slot="number-input-steps"]') as Element,
      ),
    ).toContain("touch:flex-row-reverse");
    for (const name of ["Increase", "Decrease"]) {
      expect(classesOf(screen.getByRole("button", { name }))).toEqual(
        expect.arrayContaining(["touch:w-touch", "raymond:touch:w-touch"]),
      );
    }
  });

  it("Textarea keeps 16px text at every width", () => {
    render(<Textarea aria-label="T" />);
    expect(classesOf(screen.getByRole("textbox"))).toContain("touch:text-base");
  });

  it("HighlightedInput draws a field's height, with 16px text in both layers", () => {
    const { container } = render(
      <HighlightedInput
        aria-label="H"
        value="a"
        onValueChange={() => {}}
        render={(text) => text}
      />,
    );
    const box = container.firstElementChild as Element;
    expect(classesOf(box)).toContain("touch:h-field-touch");
    const mirror = box.querySelector("[aria-hidden]") as Element;
    for (const layer of [mirror, screen.getByRole("textbox")]) {
      expect(classesOf(layer)).toContain("touch:text-base");
    }
  });

  it("QueryBox suggestion rows are the touch spacing tall", () => {
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
    for (const row of rows) {
      expect(classesOf(row)).toContain("touch:min-h-touch");
    }
  });

  it("FilterMenu rows are the touch spacing tall; its search field keeps 16px text", () => {
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
      expect.arrayContaining(["touch:h-field-touch", "touch:text-base"]),
    );
    const rows = screen.getAllByRole("option");
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(classesOf(row)).toContain("touch:min-h-touch");
    }
  });

  it("Select trigger takes a field's height at the default size; its items are rows the touch spacing tall", () => {
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
        "touch:data-[size=default]:h-field-touch",
      ]),
    );
    const item = document.querySelector('[data-slot="select-item"]');
    expect(classesOf(item as Element)).toContain("touch:min-h-touch");
  });

  it("DropdownMenu items of every kind are the touch spacing tall", () => {
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
      expect(classesOf(row as Element), slot).toContain("touch:min-h-touch");
    }
  });

  it("Tabs triggers keep their drawn height, with a hit area", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    expectHitAreaOnly(screen.getByRole("tab"));
  });

  it("TabNav links fill a row the touch spacing tall, with a hit area", () => {
    render(
      <TabNav aria-label="Sections">
        <TabNavLink href="#a" current>
          A
        </TabNavLink>
      </TabNav>,
    );
    expectHitAreaOnly(screen.getByRole("link"));
    expect(classesOf(screen.getByRole("navigation"))).toContain(
      "touch:min-h-touch",
    );
  });

  it("NavList links are the touch spacing tall", () => {
    render(
      <NavList>
        <NavListItem>
          <NavListLink href="#a">A</NavListLink>
        </NavListItem>
      </NavList>,
    );
    expect(classesOf(screen.getByRole("link"))).toContain("touch:min-h-touch");
  });

  it("a NavList group's toggle is a square of the touch spacing in its row, a hit area in its heading", () => {
    render(
      <>
        <NavListGroup>
          <NavListGroupRow>
            <NavListLink href="#a">A</NavListLink>
            <NavListGroupToggle />
          </NavListGroupRow>
          <NavListGroupContent />
        </NavListGroup>
        <NavListGroup>
          <NavListHeading>
            <NavListGroupToggle>B</NavListGroupToggle>
          </NavListHeading>
          <NavListGroupContent />
        </NavListGroup>
      </>,
    );
    const [inRow, inHeading] = screen.getAllByRole("button");
    expect(classesOf(inRow)).toContain("touch:w-touch");
    expectHitAreaOnly(inHeading);
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

  it("ColorPicker swatches widen to six a row, with a hit area, and its tracks are bars the touch spacing tall", () => {
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
    // The bar, not the drawn track: the thumb's slider role is on its child.
    const hue = screen.getByRole("slider", { name: "Hue" });
    const bar = hue.closest(".touch-none:not([role])");
    expect(classesOf(bar as Element)).toContain("touch:h-touch");
  });

  it("Reorder rows are the touch spacing tall, the handle as wide, the move buttons as far apart", () => {
    const { container } = render(
      <Reorder items={["a", "b"]} onMove={() => {}}>
        {["a", "b"].map((id) => (
          <ReorderItem key={id} id={id} name={id}>
            <ReorderHandle />
            <ReorderButtons />
          </ReorderItem>
        ))}
      </Reorder>,
    );
    const slot = (name: string) =>
      container.querySelector(`[data-slot="${name}"]`) as Element;
    // A table row takes a height, which it holds as its least.
    expect(classesOf(slot("reorder-item"))).toEqual(
      expect.arrayContaining(["touch:min-h-touch", "touch:[&:is(tr)]:h-touch"]),
    );
    expect(classesOf(slot("reorder-handle"))).toEqual(
      expect.arrayContaining(["touch:w-touch", "raymond:touch:w-touch"]),
    );
    // Centres at least the touch spacing apart, whatever the style's button
    // size: each button keeps the rest of it beside it, so the pair needs no
    // touch gap of its own.
    expect(
      classesOf(slot("reorder-buttons")).filter((c) => c.includes("touch:")),
    ).toEqual([]);
    for (const name of ["Move a up", "Move a down"]) {
      const button = screen.getByRole("button", { name });
      expect(classesOf(button)).toEqual(
        expect.arrayContaining([
          "size-control-xs",
          "mx-(--hit-room)",
          "touch:[--hit-room:var(--spacing-hit-xs)]",
        ]),
      );
      expectHitAreaOnly(button);
    }
  });

  it("a Toolbar is at least the touch spacing tall; its icon commands and its ⋯ keep the room beside them", () => {
    render(
      <Toolbar aria-label="Thread">
        <ToolbarButton aria-label="Archive">
          <svg aria-hidden />
        </ToolbarButton>
        <ToolbarOverflow>
          <DropdownMenuItem>Forward</DropdownMenuItem>
        </ToolbarOverflow>
      </Toolbar>,
    );
    expect(classesOf(screen.getByRole("toolbar"))).toContain(
      "touch:min-h-touch",
    );
    // What a coarse pointer does to the bar is move commands, never draw
    // them larger: the room beside each is the margin an icon button keeps.
    for (const name of ["Archive", "More actions"]) {
      const button = screen.getByRole("button", { name });
      expect(classesOf(button)).toEqual(
        expect.arrayContaining([
          "size-control",
          "mx-(--hit-room)",
          "touch:[--hit-room:var(--spacing-hit)]",
        ]),
      );
      expectHitAreaOnly(button);
    }
  });

  it("SplitButton's halves join: each is the touch spacing wide, with no room between", () => {
    render(
      <SplitButton>
        <SplitButtonAction>Merge</SplitButtonAction>
        <SplitButtonMenu triggerLabel="Merge options">
          <DropdownMenuItem>Squash and merge</DropdownMenuItem>
        </SplitButtonMenu>
      </SplitButton>,
    );
    const action = screen.getByRole("button", { name: "Merge" });
    const arrow = screen.getByRole("button", { name: "Merge options" });
    expect(classesOf(action)).toContain("touch:min-w-touch");
    expect(classesOf(arrow)).toEqual(
      expect.arrayContaining([
        "in-data-[slot=button-group]:mx-0",
        "in-data-[slot=button-group]:touch:min-w-touch",
      ]),
    );
    expectHitAreaOnly(action);
    expectHitAreaOnly(arrow);
  });
});

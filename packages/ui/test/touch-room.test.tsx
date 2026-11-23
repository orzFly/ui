import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "../src/components/button.tsx";
import {
  Card,
  CardAction,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../src/components/card.tsx";
import { Checkbox } from "../src/components/checkbox.tsx";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTitleBar,
} from "../src/components/dialog.tsx";
import { InfoPopover } from "../src/components/info-popover.tsx";
import { List, ListItem } from "../src/components/list.tsx";
import { MediaControls } from "../src/components/media-controls.tsx";
import { Pane } from "../src/components/pane.tsx";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "../src/components/segmented-control.tsx";
import { SelectionBar } from "../src/components/selection-bar.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../src/components/table.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../src/components/tabs.tsx";
import { Toggle } from "../src/components/toggle.tsx";

// What a box that clips its controls leaves them on touch, so a hit area
// stays whole inside it. The geometry itself needs a browser; this holds the
// classes that make it.

const THEME = readFileSync(join(import.meta.dirname, "../theme.css"), "utf8");
const classesOf = (el: Element) => el.className.split(/\s+/);

describe("hit room tokens", () => {
  it("are what the hit area reaches past a control of each size, read in the style it is drawn in", () => {
    const start = THEME.indexOf("@theme inline {\n  --spacing-hit-xs");
    expect(start).toBeGreaterThan(-1);
    const block = THEME.slice(start, THEME.indexOf("\n}", start));
    expect(block).toContain(
      "--spacing-hit-xs: calc((44px - var(--spacing-control-xs)) / 2);",
    );
    expect(block).toContain(
      "--spacing-hit-sm: calc((44px - var(--spacing-control-sm)) / 2);",
    );
    expect(block).toContain(
      "--spacing-hit: calc((44px - var(--spacing-control)) / 2);",
    );
    expect(block).toContain(
      "--spacing-hit-lg: calc((44px - var(--spacing-control-lg)) / 2);",
    );
  });
});

describe("an icon button's room on touch", () => {
  it.each([
    ["icon-xs", "hit-xs"],
    ["icon-sm", "hit-sm"],
    ["icon", "hit"],
    ["icon-lg", "hit-lg"],
  ] as const)(
    "Button %s keeps the rest of its 44px, %s, as inline margin",
    (size, token) => {
      render(<Button size={size}>B</Button>);
      expect(classesOf(screen.getByRole("button"))).toEqual(
        expect.arrayContaining([
          "mx-(--hit-room)",
          `touch:[--hit-room:var(--spacing-${token})]`,
        ]),
      );
    },
  );

  it("gives a text size no room: it is as wide as its words", () => {
    render(<Button size="xs">Words</Button>);
    expect(classesOf(screen.getByRole("button"))).not.toContain(
      "mx-(--hit-room)",
    );
  });

  it("lets a caller's margin place it: ml-auto keeps its push, mx replaces the room", () => {
    render(
      <>
        <Button size="icon-xs" className="ml-auto" aria-label="Pushed" />
        <Button size="icon-xs" className="mx-0.5" aria-label="Own room" />
      </>,
    );
    expect(classesOf(screen.getByRole("button", { name: "Pushed" }))).toEqual(
      expect.arrayContaining(["mx-(--hit-room)", "ml-auto"]),
    );
    const own = classesOf(screen.getByRole("button", { name: "Own room" }));
    expect(own).toContain("mx-0.5");
    expect(own).not.toContain("mx-(--hit-room)");
  });

  it("in a button group, joins its neighbours and is drawn 44px wide instead", () => {
    render(
      <div data-slot="button-group">
        <Button size="icon-sm" aria-label="Bold" />
      </div>,
    );
    expect(classesOf(screen.getByRole("button"))).toEqual(
      expect.arrayContaining([
        "in-data-[slot=button-group]:mx-0",
        "in-data-[slot=button-group]:touch:min-w-11",
      ]),
    );
  });

  it("leaves InfoPopover's trigger none, beside the text it explains", () => {
    render(<InfoPopover>Why</InfoPopover>);
    const trigger = classesOf(
      screen.getByRole("button", { name: "More information" }),
    );
    expect(trigger).toContain("mx-0");
    expect(trigger).not.toContain("mx-(--hit-room)");
  });

  it("follows a raymond caption box's drawn 16px in a Pane titlebar and a DialogTitleBar", () => {
    const { container } = render(
      <Pane purpose="titlebar" data-testid="titlebar" />,
    );
    const room = "raymond:touch:[&_button[data-size^=icon]]:[--hit-room:14px]";
    expect(
      classesOf(container.querySelector("[data-testid=titlebar]") as Element),
    ).toContain(room);
    render(
      <Dialog open>
        <DialogContent aria-describedby={undefined} showCloseButton={false}>
          <DialogTitleBar data-testid="bar">
            <DialogTitle>Title</DialogTitle>
          </DialogTitleBar>
        </DialogContent>
      </Dialog>,
    );
    expect(classesOf(screen.getByTestId("bar"))).toContain(room);
  });
});

describe("parts that space themselves on touch", () => {
  it("a Toggle chip keeps its room above and below and is at least 44px wide", () => {
    render(<Toggle>#ui</Toggle>);
    expect(classesOf(screen.getByRole("button"))).toEqual(
      expect.arrayContaining(["touch:my-hit-xs", "touch:min-w-11"]),
    );
  });

  it("a segment and a tab are at least 44px wide, since their faces join", () => {
    render(
      <>
        <SegmentedControl aria-label="View" value="a" onValueChange={() => {}}>
          <SegmentedControlItem value="a">A</SegmentedControlItem>
        </SegmentedControl>
        <Tabs defaultValue="b">
          <TabsList>
            <TabsTrigger value="b">B</TabsTrigger>
          </TabsList>
        </Tabs>
      </>,
    );
    expect(classesOf(screen.getByRole("button", { name: "A" }))).toContain(
      "touch:min-w-11",
    );
    expect(classesOf(screen.getByRole("tab", { name: "B" }))).toContain(
      "touch:min-w-11",
    );
  });

  it("a vertical ListItem that holds a control is a hit area tall; a horizontal one is not", () => {
    render(
      <>
        <List purpose="collection">
          <ListItem data-testid="row">
            <Button size="icon-xs" aria-label="More" />
          </ListItem>
        </List>
        <List purpose="collection" orientation="horizontal">
          <ListItem data-testid="column" />
        </List>
      </>,
    );
    const tall = "touch:has-[button,a[href],input,[role=checkbox]]:min-h-11";
    expect(classesOf(screen.getByTestId("row"))).toContain(tall);
    expect(classesOf(screen.getByTestId("column"))).not.toContain(tall);
  });
});

describe("room on touch", () => {
  it("sets the Dialog's corner X down by its hit area's overhang and in by its own room, and grows raymond's caption to keep it there", () => {
    render(
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    const close = screen.getByRole("button", { name: "Close" });
    expect(classesOf(close)).toEqual(
      expect.arrayContaining([
        "mx-(--hit-room)",
        "touch:top-hit-sm",
        "touch:right-0",
        "raymond:touch:top-[18px]",
        "raymond:touch:right-0",
        "raymond:touch:[--hit-room:14px]",
      ]),
    );
    expect(
      classesOf(screen.getByText("Title").closest("h2") as Element),
    ).toContain("raymond:touch:min-h-11");
  });

  it("makes a Card's header with an action and its footer a hit area tall, an icon button's own room at its end", () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardAction>
            <button type="button">Edit</button>
          </CardAction>
        </CardHeader>
        <CardFooter>
          <button type="button">Done</button>
        </CardFooter>
      </Card>,
    );
    const header = classesOf(
      container.querySelector("[data-slot=card-header]") as Element,
    );
    expect(header).toContain("touch:has-[>[data-slot=card-action]]:min-h-11");
    expect(header.filter((c) => /pr-hit/.test(c))).toEqual([]);
    const footer = container.querySelector("[data-slot=card-footer]");
    expect(classesOf(footer as Element)).toContain("touch:min-h-11");
  });

  it("makes a Table row with a checkbox a hit area tall, the box in from the table's edge", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Checkbox aria-label="Select all" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>
              <Checkbox aria-label="Select one" />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    for (const name of ["Select all", "Select one"]) {
      const cell = screen.getByRole("checkbox", { name }).parentElement;
      expect(classesOf(cell as Element), name).toEqual(
        expect.arrayContaining([
          "touch:has-[>[role=checkbox],>[role=radio]]:h-11",
          "touch:first:has-[>[role=checkbox],>[role=radio]]:pl-3.5",
        ]),
      );
    }
  });

  it("makes a framed set's tabs a hit area tall, and leaves the rest at 40px", () => {
    render(
      <Tabs variant="framed" defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Framed</TabsTrigger>
        </TabsList>
        <TabsContent value="a">
          <Tabs defaultValue="b">
            <TabsList>
              <TabsTrigger value="b">Nested</TabsTrigger>
            </TabsList>
          </Tabs>
        </TabsContent>
      </Tabs>,
    );
    expect(classesOf(screen.getByRole("tab", { name: "Framed" }))).toContain(
      "touch:min-h-11",
    );
    expect(
      classesOf(screen.getByRole("tab", { name: "Nested" })),
    ).not.toContain("touch:min-h-11");
  });

  it("makes a Pane toolbar or titlebar a hit area tall, in every style", () => {
    const { container } = render(
      <>
        <Pane purpose="toolbar" data-testid="toolbar" />
        <Pane purpose="titlebar" data-testid="titlebar" />
      </>,
    );
    const toolbar = container.querySelector("[data-testid=toolbar]") as Element;
    const titlebar = container.querySelector(
      "[data-testid=titlebar]",
    ) as Element;
    expect(classesOf(toolbar)).toEqual(
      expect.arrayContaining([
        "touch:min-h-11",
        "raymond:touch:min-h-11",
        "raymond:touch:py-hit-sm",
      ]),
    );
    expect(classesOf(titlebar)).toEqual(
      expect.arrayContaining(["touch:min-h-11", "raymond:touch:min-h-11"]),
    );
    expect(classesOf(titlebar)).not.toContain("raymond:touch:pr-[11px]");
  });

  it("makes the media bar a hit area tall, its end buttons' own room at its sides", () => {
    const { container } = render(
      <MediaControls
        playing={false}
        time={0}
        duration={60}
        speed={1}
        onToggle={() => {}}
        onSeek={() => {}}
        onSpeed={() => {}}
      />,
    );
    const bar = classesOf(
      container.querySelector("[data-slot=media-controls]") as Element,
    );
    expect(bar).toContain("touch:min-h-11");
    expect(bar).not.toContain("touch:px-hit-sm");
  });

  it("makes SelectionBar's box slot as wide as the box's hit area, and pads no room before Clear", () => {
    const { container } = render(
      <SelectionBar
        count={1}
        total={2}
        onSelectAll={() => {}}
        onClear={() => {}}
      />,
    );
    const bar = container.querySelector("[data-slot=selection-bar]");
    expect(classesOf(bar as Element)).not.toContain("touch:pr-hit");
    const slot = screen.getByRole("checkbox").parentElement as Element;
    expect(classesOf(slot)).toEqual(
      expect.arrayContaining(["size-8", "touch:w-11"]),
    );
    expect(
      classesOf(screen.getByRole("button", { name: "Clear selection" })),
    ).toEqual(expect.arrayContaining(["mx-(--hit-room)", "ml-auto"]));
  });
});

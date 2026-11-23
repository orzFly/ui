import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
} from "../src/components/dialog.tsx";
import { MediaControls } from "../src/components/media-controls.tsx";
import { Pane } from "../src/components/pane.tsx";
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
  });
});

describe("room on touch", () => {
  it("sets the Dialog's corner X in by its hit area's overhang, and grows raymond's caption to keep it there", () => {
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
        "touch:top-hit-sm",
        "touch:right-hit-sm",
        "raymond:touch:top-[18px]",
        "raymond:touch:right-[14px]",
      ]),
    );
    expect(
      classesOf(screen.getByText("Title").closest("h2") as Element),
    ).toContain("raymond:touch:min-h-11");
  });

  it("makes a Card's header with an action and its footer a hit area tall", () => {
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
    const header = container.querySelector("[data-slot=card-header]");
    expect(classesOf(header as Element)).toEqual(
      expect.arrayContaining([
        "touch:has-[>[data-slot=card-action]]:min-h-11",
        "touch:has-[>[data-slot=card-action]]:pr-hit-sm",
      ]),
    );
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
      expect.arrayContaining([
        "touch:min-h-11",
        "raymond:touch:min-h-11",
        "raymond:touch:pr-[11px]",
      ]),
    );
  });

  it("makes the media bar a hit area tall, its end controls in by the rest of one", () => {
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
    const bar = container.querySelector("[data-slot=media-controls]");
    expect(classesOf(bar as Element)).toEqual(
      expect.arrayContaining(["touch:min-h-11", "touch:px-hit-sm"]),
    );
  });

  it("sets SelectionBar's Clear in from the end", () => {
    const { container } = render(
      <SelectionBar
        count={1}
        total={2}
        onSelectAll={() => {}}
        onClear={() => {}}
      />,
    );
    const bar = container.querySelector("[data-slot=selection-bar]");
    expect(classesOf(bar as Element)).toContain("touch:pr-hit");
  });
});

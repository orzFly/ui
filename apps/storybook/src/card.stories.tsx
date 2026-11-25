import { Button } from "@orz/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  ModuleGrid as ModuleGridView,
} from "@orz/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@orz/ui/components/table";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ListChecksIcon } from "lucide-react";
import { withHeight, withWidth } from "./decorators.tsx";

const meta = {
  title: "ui/Primitives/Card",
  component: Card,
  args: { size: "default" },
  argTypes: { size: { control: "inline-radio", options: ["default", "sm"] } },
  parameters: {
    guidelines: "/guidelines/foundations/layout-and-spacing/",
  },
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Release notes</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        The theme store now takes its storage key from the app.
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline" size="sm">
          Dismiss
        </Button>
        <Button size="sm">Read more</Button>
      </CardFooter>
    </Card>
  ),
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

// The ModuleGrid stories lay several cards out across the frame, so only the
// single-card stories narrow it.
const narrow = [withWidth("max-w-sm")];

export const Playground: Story = { decorators: narrow };

export const Small: Story = { args: { size: "sm" }, decorators: narrow };

/** The header's marker shows the module's icon; without one it draws ▶. */
export const WithIcon: Story = {
  decorators: narrow,
  render: (args) => (
    <Card {...args}>
      <CardHeader icon={<ListChecksIcon />}>
        <CardTitle>Checks</CardTitle>
      </CardHeader>
      <CardContent>
        Lint, typecheck and build passed; one test failed.
      </CardContent>
    </Card>
  ),
};

export const ContentOnly: Story = {
  decorators: narrow,
  render: (args) => (
    <Card {...args}>
      <CardContent>A card with nothing but content.</CardContent>
    </Card>
  ),
};

const STATS = [
  { label: "Accounts", value: "12" },
  { label: "Requests today", value: "3,481" },
  { label: "Errors", value: "17" },
  { label: "Next reset", value: "04:00" },
];

const ACCOUNTS = [
  { name: "alpha", requests: "1,204", share: "35%" },
  { name: "bravo", requests: "982", share: "28%" },
  { name: "charlie", requests: "655", share: "19%" },
  { name: "delta", requests: "640", share: "18%" },
];

/**
 * A page of modules: a stat row of four over a main module beside an aside
 * of stacked modules. The row and the aside are grids nested in the page's,
 * so their edges line up with the main module's.
 */
export const ModuleGrid: Story = {
  parameters: { layout: "fullscreen" },
  render: () => (
    <ModuleGridView>
      <ModuleGridView className="grid-cols-2 md:grid-cols-4">
        {STATS.map((stat) => (
          <Card key={stat.label} size="sm">
            <CardContent>
              <div className="text-muted-foreground">{stat.label}</div>
              <div className="font-bold text-lg tabular-nums">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </ModuleGridView>
      <ModuleGridView className="lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ACCOUNTS.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.requests}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.share}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <ModuleGridView>
          <Card>
            <CardHeader>
              <CardTitle>Resets</CardTitle>
            </CardHeader>
            <CardContent>Daily quotas reset at 04:00.</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Errors</CardTitle>
            </CardHeader>
            <CardContent>17 in the last hour, all from bravo.</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>charlie is paused until Monday.</CardContent>
          </Card>
        </ModuleGridView>
      </ModuleGridView>
    </ModuleGridView>
  ),
};

/** Equal modules in two columns; modules in a row match heights. */
export const TwoColumns: Story = {
  parameters: { layout: "fullscreen" },
  render: () => (
    <ModuleGridView className="md:grid-cols-2">
      {ACCOUNTS.map((row) => (
        <Card key={row.name}>
          <CardHeader>
            <CardTitle>{row.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {row.requests} requests ({row.share} of today).
          </CardContent>
        </Card>
      ))}
    </ModuleGridView>
  ),
};

const TRANSCRIPT = Array.from(
  { length: 40 },
  (_, i) => `${String(i + 1).padStart(2, "0")}  Step ${i + 1} finished.`,
);

/**
 * A reader that fills the height beside a rail of modules. The grid has one
 * row that fits the height; the reader's body and the rail each scroll.
 */
export const FullHeight: Story = {
  decorators: [withHeight(480)],
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, iframeHeight: 480 } },
  },
  render: () => (
    <ModuleGridView className="h-full grid-rows-[minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <CardHeader>
          <CardTitle>Transcript · Run 42</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 overflow-y-auto font-mono">
          {TRANSCRIPT.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </CardContent>
      </Card>
      <ModuleGridView className="min-h-0 overflow-y-auto">
        {["Run", "Inputs", "Outputs", "Timing", "Owner"].map((title) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>Details for this run.</CardContent>
          </Card>
        ))}
      </ModuleGridView>
    </ModuleGridView>
  ),
};

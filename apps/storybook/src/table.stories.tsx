import { Badge } from "@orz/ui/components/badge";
import { Checkbox } from "@orz/ui/components/checkbox";
import { RadioGroup, RadioGroupItem } from "@orz/ui/components/radio-group";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@orz/ui/components/table";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";

const ROWS = [
  { name: "@orz/ui", status: "Ready", size: "48 kB" },
  { name: "@orz/ui-codemirror", status: "Planned", size: "—" },
  { name: "@orz/ui-markdown", status: "Planned", size: "—" },
];

const meta = {
  title: "ui/Primitives/Table",
  component: Table,
  render: (args) => (
    <Table {...args}>
      <TableCaption>Packages in this workspace.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Package</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Size</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map((row, i) => (
          <TableRow
            key={row.name}
            data-state={i === 0 ? "selected" : undefined}
          >
            <TableCell>{row.name}</TableCell>
            <TableCell>
              <Badge variant={row.status === "Ready" ? "default" : "outline"}>
                {row.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right">{row.size}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2}>Total</TableCell>
          <TableCell className="text-right">48 kB</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
  parameters: { guidelines: "/guidelines/foundations/styles/" },
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Picked rows tick their box; the current row, whose details are open, is `aria-current`. */
export const CurrentAndSelected: Story = {
  render: (args) => (
    <Table {...args}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">
            <Checkbox aria-label="Select all" checked="indeterminate" />
          </TableHead>
          <TableHead>Package</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map((row, i) => (
          <TableRow
            key={row.name}
            data-state={i < 2 ? "selected" : undefined}
            aria-current={i === 1 ? "true" : undefined}
          >
            <TableCell>
              <Checkbox aria-label={`Select ${row.name}`} checked={i < 2} />
            </TableCell>
            <TableCell>{row.name}</TableCell>
            <TableCell>{row.status}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

const STATES = [
  {
    state: "Loaded, nothing there",
    show: "What would be here, why it is empty, and the action that fills it",
    use: "EmptyState",
  },
  {
    state: "Failed, nothing to show",
    show: "The error, the server's own words, and a way to try again",
    use: "LoadFailure",
  },
];

/** `purpose="prose"`, sentences laid out in columns: the cells wrap and sit at the top. */
export const Prose: Story = {
  args: { purpose: "prose" },
  render: (args) => (
    <Table {...args}>
      <TableHeader>
        <TableRow>
          <TableHead>State</TableHead>
          <TableHead>Show</TableHead>
          <TableHead>Component</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {STATES.map((row) => (
          <TableRow key={row.state}>
            <TableCell>{row.state}</TableCell>
            <TableCell>{row.show}</TableCell>
            <TableCell>{row.use}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

// Radix adds a hidden input beside each box and radio only inside a form.
const inAForm: Decorator = (Story) => (
  <form>
    <Story />
  </form>
);

/**
 * Inside a form, each box's hidden input lies on the box: the table keeps to its rows and does
 * not scroll.
 */
export const CheckboxesInAForm: Story = {
  tags: ["edge", "!autodocs"],
  decorators: [inAForm],
  render: (args) => (
    <Table {...args}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">
            <Checkbox aria-label="Select all" defaultChecked="indeterminate" />
          </TableHead>
          <TableHead>Package</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map((row, i) => (
          <TableRow key={row.name}>
            <TableCell>
              <Checkbox
                aria-label={`Select ${row.name}`}
                defaultChecked={i === 0}
              />
            </TableCell>
            <TableCell>{row.name}</TableCell>
            <TableCell>{row.status}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

/** The same with a radio in each row. */
export const RadiosInAForm: Story = {
  tags: ["edge", "!autodocs"],
  decorators: [
    (Story) => (
      <RadioGroup aria-label="Default package" defaultValue={ROWS[0].name}>
        <Story />
      </RadioGroup>
    ),
    inAForm,
  ],
  render: (args) => (
    <Table {...args}>
      <TableBody>
        {ROWS.map((row) => (
          <TableRow key={row.name}>
            <TableCell className="w-8">
              <RadioGroupItem value={row.name} aria-label={row.name} />
            </TableCell>
            <TableCell>{row.name}</TableCell>
            <TableCell>{row.status}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

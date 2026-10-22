import { Badge } from "@orz/ui/components/badge";
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
import type { Meta, StoryObj } from "@storybook/react-vite";

const ROWS = [
  { name: "@orz/ui", status: "Ready", size: "48 kB" },
  { name: "@orz/ui-codemirror", status: "Planned", size: "—" },
  { name: "@orz/ui-markdown", status: "Planned", size: "—" },
];

const meta = {
  title: "Primitives/Table",
  component: Table,
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Table>
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
            <TableCell className="font-medium">{row.name}</TableCell>
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
};

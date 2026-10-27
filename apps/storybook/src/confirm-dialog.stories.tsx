import { ConfirmDialog } from "@orz/ui/components/confirm-dialog";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { argsUpdater } from "./args.ts";
import { withOpener } from "./decorators.tsx";

const meta = {
  title: "ui/ConfirmDialog",
  component: ConfirmDialog,
  parameters: { guidelines: "/guidelines/patterns/destructive-actions/" },
  args: {
    open: false,
    onOpenChange: fn(),
    onConfirm: fn(),
    title: "Delete this item?",
    description: "It moves to the trash, where it can be restored.",
    confirmLabel: "Delete",
    destructive: true,
    pending: false,
  },
  decorators: [withOpener("Delete…")],
  render: function Render(args, context) {
    const updateArgs = argsUpdater(context);
    return (
      <ConfirmDialog
        {...args}
        onOpenChange={(open) => {
          updateArgs({ open });
          args.onOpenChange(open);
        }}
        onConfirm={() => {
          args.onConfirm();
          updateArgs({ open: false });
        }}
      />
    );
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Neutral: Story = {
  args: {
    title: "Archive this project?",
    description: undefined,
    confirmLabel: "Archive",
    destructive: false,
  },
};

export const Children: Story = {
  args: {
    title: "Delete report.pdf?",
    description: "Two places still link it; they will show it as deleted.",
    children: (
      <ul className="list-disc pl-5 text-sm">
        <li>The description</li>
        <li>A comment from alice</li>
      </ul>
    ),
  },
};

export const Pending: Story = {
  args: { open: true, pending: true },
  // In an iframe of its own, so the open dialog does not cover the docs page.
  parameters: { docs: { story: { inline: false, iframeHeight: 360 } } },
};

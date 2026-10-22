import { Button } from "@orz/ui/components/button";
import { ConfirmDialog } from "@orz/ui/components/confirm-dialog";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";

const meta = {
  title: "Patterns/ConfirmDialog",
  component: ConfirmDialog,
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
  render: function Render(args) {
    const [open, setOpen] = useState(args.open);
    return (
      <>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Delete…
        </Button>
        <ConfirmDialog
          {...args}
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            args.onOpenChange(next);
          }}
          onConfirm={() => {
            args.onConfirm();
            setOpen(false);
          }}
        />
      </>
    );
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Destructive: Story = {};

export const Neutral: Story = {
  args: {
    title: "Archive this project?",
    description: undefined,
    confirmLabel: "Archive",
    destructive: false,
  },
};

export const Pending: Story = { args: { open: true, pending: true } };

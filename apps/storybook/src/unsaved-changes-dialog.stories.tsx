import { Button } from "@orz/ui/components/button";
import { Textarea } from "@orz/ui/components/textarea";
import { UnsavedChangesDialog } from "@orz/ui/components/unsaved-changes-dialog";
import { hasUnsavedWork, useDirtySource } from "@orz/ui/lib/unsaved-guard";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";

const meta = {
  title: "ui/Patterns/UnsavedChangesDialog",
  component: UnsavedChangesDialog,
  args: { open: true, onProceed: fn(), onStay: fn() },
} satisfies Meta<typeof UnsavedChangesDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

/** A stand-in for a router: "Leave" asks the dirty-source registry first. */
export const WithRegistry: Story = {
  render: function Render(args) {
    const [draft, setDraft] = useState("");
    const [asking, setAsking] = useState(false);
    const [left, setLeft] = useState(false);
    useDirtySource(() => draft !== "");
    const leave = () => {
      if (hasUnsavedWork()) setAsking(true);
      else setLeft(true);
    };
    if (left)
      return (
        <Button variant="outline" onClick={() => setLeft(false)}>
          Back
        </Button>
      );
    return (
      <div className="grid max-w-sm gap-2">
        <Textarea
          aria-label="Draft"
          placeholder="Type, then leave"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button variant="outline" onClick={leave}>
          Leave
        </Button>
        <UnsavedChangesDialog
          open={asking}
          onProceed={() => {
            args.onProceed();
            setAsking(false);
            setDraft("");
            setLeft(true);
          }}
          onStay={() => {
            args.onStay();
            setAsking(false);
          }}
        />
      </div>
    );
  },
};

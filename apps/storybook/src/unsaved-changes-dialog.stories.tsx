import { Button } from "@orz/ui/components/button";
import { Textarea } from "@orz/ui/components/textarea";
import { UnsavedChangesDialog } from "@orz/ui/components/unsaved-changes-dialog";
import { hasUnsavedWork, useDirtySource } from "@orz/ui/lib/unsaved-guard";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { argsUpdater } from "./args.ts";
import { withOpener, withWidth } from "./decorators.tsx";

const REGISTRY_SOURCE = `import { Button } from "@orz/ui/components/button";
import { UnsavedChangesDialog } from "@orz/ui/components/unsaved-changes-dialog";
import { hasUnsavedWork, useDirtySource } from "@orz/ui/lib/unsaved-guard";

// In an editor: registered while mounted, dirty while there is a draft.
useDirtySource(() => draft !== "");

// Where the app leaves the page (a router's blocker, a "Back" button):
const [asking, setAsking] = useState(false);
<>
  <Button onClick={() => (hasUnsavedWork() ? setAsking(true) : leave())}>Leave</Button>
  <UnsavedChangesDialog
    open={asking}
    onProceed={() => {
      setAsking(false);
      leave();
    }}
    onStay={() => setAsking(false)}
  />
</>`;

const meta = {
  title: "ui/UnsavedChangesDialog",
  component: UnsavedChangesDialog,
  parameters: { guidelines: "/guidelines/patterns/forms/" },
  args: { open: false, onProceed: fn(), onStay: fn() },
  render: function Render(args, context) {
    const updateArgs = argsUpdater(context);
    return (
      <UnsavedChangesDialog
        {...args}
        onProceed={() => {
          args.onProceed();
          updateArgs({ open: false });
        }}
        onStay={() => {
          args.onStay();
          updateArgs({ open: false });
        }}
      />
    );
  },
} satisfies Meta<typeof UnsavedChangesDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  decorators: [withOpener("Leave…")],
};

/** A stand-in for a router: "Leave" asks the dirty-source registry first. */
export const WithRegistry: Story = {
  decorators: [withWidth("max-w-sm")],
  parameters: {
    docs: { source: { code: REGISTRY_SOURCE, language: "tsx" } },
  },
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
      <div className="grid gap-2">
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

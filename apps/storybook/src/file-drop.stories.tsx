import { Avatar, AvatarFallback } from "@orz/ui/components/avatar";
import { Button } from "@orz/ui/components/button";
import { EmptyState } from "@orz/ui/components/empty-state";
import { FieldError } from "@orz/ui/components/field";
import { FileDrop, FileDropTrigger } from "@orz/ui/components/file-drop";
import { Pane as PaneView } from "@orz/ui/components/pane";
import {
  Toolbar,
  ToolbarButton,
  ToolbarLabel,
} from "@orz/ui/components/toolbar";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  FolderOpenIcon,
  PaperclipIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useState } from "react";
import { fn } from "storybook/test";

const PURPOSES = ["field", "pane"] as const;

// A profile's picture: the zone is the whole row, not the avatar alone.
const AVATAR_ROW = {
  "aria-label": "Avatar",
  className: "flex items-center gap-3",
  children: (
    <>
      <Avatar size="lg">
        <AvatarFallback>AL</AvatarFallback>
      </Avatar>
      <FileDropTrigger>
        <UploadIcon />
        Upload…
      </FileDropTrigger>
      <Button variant="outline">
        <Trash2Icon />
        Remove
      </Button>
    </>
  ),
};

const meta = {
  title: "ui/Primitives/FileDrop",
  component: FileDrop,
  parameters: { guidelines: "/guidelines/patterns/forms/" },
  args: { onFile: fn(), onReject: fn() },
  argTypes: {
    accept: { control: "text" },
    purpose: { control: "inline-radio", options: PURPOSES },
    children: { control: false },
  },
} satisfies Meta<typeof FileDrop>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { ...AVATAR_ROW, accept: "image/*", disabled: false, purpose: "field" },
};

/** A region that fills its box, put on it with `asChild`, drawn on its edge. */
export const Pane: Story = {
  args: {
    purpose: "pane",
    asChild: true,
    children: (
      <PaneView purpose="panel" className="grid h-64 place-items-center">
        <FileDropTrigger>
          <FolderOpenIcon />
          Open file…
        </FileDropTrigger>
      </PaneView>
    ),
  },
};

/** Takes nothing: the trigger is disabled, and a dragged file cannot be let go on it. */
export const Disabled: Story = {
  args: { ...AVATAR_ROW, disabled: true },
};

/** What `accept` turns away goes to `onReject`, which says so under the field. */
export const Rejecting: Story = {
  args: { ...AVATAR_ROW, accept: "image/*" },
  render: function Render(args) {
    const [error, setError] = useState<string>();
    return (
      <div className="grid gap-2">
        <FileDrop
          {...args}
          aria-describedby={error ? "avatar-error" : undefined}
          onFile={(file) => {
            setError(undefined);
            args.onFile(file);
          }}
          onReject={(file) => {
            setError(`"${file.name}" is not an image.`);
            args.onReject?.(file);
          }}
        />
        {error && <FieldError id="avatar-error">{error}</FieldError>}
      </div>
    );
  },
};

/** The trigger put on a bar's own button with `asChild`, so it keeps the bar's look. */
export const ToolbarTrigger: Story = {
  args: {
    purpose: "pane",
    asChild: true,
    children: (
      <PaneView purpose="panel" className="flex h-64 flex-col">
        <Toolbar aria-label="Attachments" edge="bottom">
          <FileDropTrigger asChild>
            <ToolbarButton>
              <PaperclipIcon />
              <ToolbarLabel>Attach…</ToolbarLabel>
            </ToolbarButton>
          </FileDropTrigger>
        </Toolbar>
        <EmptyState
          icon={PaperclipIcon}
          title="No attachments"
          className="m-auto"
        />
      </PaneView>
    ),
  },
};

/** A field inside a pane: the pointer's zone is the innermost, and only it takes the drop. */
export const Nested: Story = {
  tags: ["edge", "!autodocs"],
  args: {
    purpose: "pane",
    asChild: true,
    children: (
      <PaneView purpose="panel" className="grid h-80 content-center gap-6 p-6">
        <FileDropTrigger className="justify-self-start">
          <FolderOpenIcon />
          Open file…
        </FileDropTrigger>
        <FileDrop
          aria-label="Avatar"
          onFile={fn()}
          className="flex items-center gap-3"
        >
          {AVATAR_ROW.children}
        </FileDrop>
      </PaneView>
    ),
  },
};

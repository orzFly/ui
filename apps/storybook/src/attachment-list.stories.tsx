import { file } from "@orz/fixtures/files.ts";
import { ATTACHMENT_RENDERERS } from "@orz/fixtures/renderers.ts";
import { Button } from "@orz/ui/components/button";
import { ConfirmDialog } from "@orz/ui/components/confirm-dialog";
import { ToolbarButton } from "@orz/ui/components/toolbar";
import {
  type AttachmentItem,
  AttachmentList,
} from "@orz/ui-content/attachment";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { argsUpdater } from "./args.ts";
import { withRenderers, withViewer, withWidth } from "./decorators.tsx";

const LISTED: AttachmentItem[] = [
  "gradient.png",
  "demo.html",
  "paper.pdf",
  "clip.webm",
  "tone.ogg",
  "guide.md",
  "fetch-task.ts",
  "bundle.zip",
].map((name, i) => ({
  ...file(name),
  key: name,
  createdAt: `2026-09-01T0${i}:15:00Z`,
}));

const ACTIONS_SNIPPET = `import { AttachmentList } from "@orz/ui-content/attachment";

// After each row's download link: the app's own controls, a delete button here.
<AttachmentList
  items={files}
  actions={(item) => (
    <Button variant="ghost" size="icon-xs" aria-label={\`delete \${item.name}\`} onClick={() => remove(item)}>
      <Trash2Icon />
    </Button>
  )}
/>`;

/** A file list, newest first. A row click opens the viewer; a modifier click is the browser's. */
const meta = {
  title: "ui-content/AttachmentList",
  component: AttachmentList,
  args: { items: LISTED },
  decorators: [
    withWidth("max-w-xl"),
    withViewer({}),
    withRenderers(...ATTACHMENT_RENDERERS),
  ],
} satisfies Meta<typeof AttachmentList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Eight files: the newest five show, and the rest fold behind a toggle. */
export const Playground: Story = {};

/** Few enough files that none fold away. */
export const NoFold: Story = {
  args: { items: LISTED.slice(0, 4), title: "Files" },
};

/** `actions` draws the app's own controls at the end of each row, after the download link. */
export const Actions: Story = {
  args: {
    items: LISTED.slice(0, 4),
    actions: (item) => (
      <Button
        variant="ghost"
        size="icon-xs"
        className="mr-1.5"
        aria-label={`delete ${item.name}`}
      >
        <Trash2Icon />
      </Button>
    ),
  },
  parameters: {
    docs: { source: { code: ACTIONS_SNIPPET, language: "tsx" } },
  },
};

/** `fold={false}` keeps every row on screen, for a list whose order is the point. */
export const Unfolded: Story = {
  args: {
    items: [
      ...LISTED,
      ...["series.patch", "pause.diff"].map((name) => ({
        ...file(name),
        key: name,
      })),
    ],
    fold: false,
  },
};

/** `thumbnails` draws the images under the rows; the viewer still pages in the list's order. */
export const Thumbnails: Story = {
  args: {
    items: [
      "series.patch",
      "gradient.png",
      "guide.md",
      "sprite.png",
      "logo.svg",
    ].map((name) => ({ ...file(name), key: name })),
    thumbnails: true,
  },
};

const SELECTABLE_SNIPPET = `import { ConfirmDialog } from "@orz/ui/components/confirm-dialog";
import { ToolbarButton } from "@orz/ui/components/toolbar";
import { AttachmentList } from "@orz/ui-content/attachment";

const [deleting, setDeleting] = useState<AttachmentItem[]>([]);

<AttachmentList
  items={files}
  selectable
  // In the header while any file is selected: what the app does with them.
  selectionActions={(chosen) => (
    <ToolbarButton aria-label="Delete" onClick={() => setDeleting(chosen)}>
      <Trash2Icon />
    </ToolbarButton>
  )}
/>
<ConfirmDialog
  open={deleting.length > 0}
  onOpenChange={(open) => !open && setDeleting([])}
  title={\`Delete \${deleting.length} files?\`}
  destructive
  confirmLabel="Delete"
  onConfirm={() => {
    remove(deleting);
    setDeleting([]);
  }}
/>`;

/**
 * `selectable`: hover a row and its icon gives way to a checkbox. Shift-click selects a range,
 * a drag down the boxes selects every row it crosses, and the paperclip selects them all. The
 * header then counts them and holds `selectionActions`, here a delete that asks first.
 */
export const Selectable: Story = {
  args: { items: LISTED.slice(0, 6), selectable: true, selected: [] },
  parameters: {
    docs: { source: { code: SELECTABLE_SNIPPET, language: "tsx" } },
  },
  render: function Render(args, context) {
    const updateArgs = argsUpdater(context);
    const [items, setItems] = useState(args.items);
    const [deleting, setDeleting] = useState<AttachmentItem[]>([]);
    // Kept apart from `deleting` so the dialog keeps its wording while it fades out.
    const [confirming, setConfirming] = useState(false);
    return (
      <>
        <AttachmentList
          {...args}
          items={items}
          onSelectedChange={(selected) => updateArgs({ selected })}
          selectionActions={(chosen) => (
            <ToolbarButton
              aria-label="Delete"
              onClick={() => {
                setDeleting(chosen);
                setConfirming(true);
              }}
            >
              <Trash2Icon />
            </ToolbarButton>
          )}
        />
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={
            deleting.length === 1
              ? `Delete ${deleting[0]?.name}?`
              : `Delete ${deleting.length} files?`
          }
          description="They leave the list for good."
          destructive
          confirmLabel="Delete"
          onConfirm={() => {
            setItems((was) => was.filter((item) => !deleting.includes(item)));
            setConfirming(false);
          }}
        />
      </>
    );
  },
};

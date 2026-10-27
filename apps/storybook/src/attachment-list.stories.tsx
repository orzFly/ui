import { file } from "@orz/fixtures/files.ts";
import { ATTACHMENT_RENDERERS } from "@orz/fixtures/renderers.ts";
import { Button } from "@orz/ui/components/button";
import {
  type AttachmentItem,
  AttachmentList,
} from "@orz/ui-content/attachment";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Trash2Icon } from "lucide-react";
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
        className="mr-1.5 text-muted-foreground"
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

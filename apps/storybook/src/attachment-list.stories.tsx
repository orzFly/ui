import {
  type AttachmentItem,
  AttachmentList,
} from "@orz/ui-content/attachment";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withRenderers, withViewer, withWidth } from "./decorators.tsx";
import { file } from "./fixtures/files.ts";
import { ATTACHMENT_RENDERERS } from "./fixtures/renderers.ts";

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

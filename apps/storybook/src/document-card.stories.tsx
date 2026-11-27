import { Badge } from "@orz/ui/components/badge";
import { DocumentCard } from "@orz/ui-content/attachment";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileTextIcon } from "lucide-react";
import { fn } from "storybook/test";
import { withWidth } from "./decorators.tsx";

const LINES = Array.from({ length: 60 }, (_, i) => (
  // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list that never reorders
  <p key={i}>Line {i + 1} of a long document.</p>
));

/**
 * A bordered card with a filename header and a body cut at the shared cap, behind a bar that opens
 * `onExpand` (the viewer) or, without it, shows the rest in place. An attachment embed puts the
 * drawn file in it; an app can put anything there, with its own controls in `headerActions`.
 */
const meta = {
  title: "ui-content/DocumentCard",
  component: DocumentCard,
  args: {
    name: "notes.md",
    meta: "1.2 KB",
    downloadUrl: "#notes.md",
    onExpand: fn(),
    children: <p>The fetch task now retries once before it gives up.</p>,
  },
  decorators: [withWidth("max-w-xl")],
  parameters: { guidelines: "/guidelines/patterns/long-content/" },
} satisfies Meta<typeof DocumentCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/**
 * A body taller than one and a half times the cap is cut there and fades; Show all under it calls
 * `onExpand`, as the name and ⤢ do.
 */
export const Overflowing: Story = {
  args: { children: <>{LINES}</> },
};

export const HeaderActions: Story = {
  args: { headerActions: <Badge variant="outline">v3</Badge> },
};

/**
 * Without `onExpand` there is no ⤢ and the name is plain text; a long body's bar shows the rest in
 * place.
 */
export const NoExpand: Story = {
  args: { onExpand: undefined, children: <>{LINES}</> },
};

/** By default the icon follows the file name; `icon` overrides it. */
export const Icon: Story = { args: { icon: FileTextIcon } };

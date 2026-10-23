import { Badge } from "@orz/ui/components/badge";
import { DocumentCard } from "@orz/ui-content/attachment";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileTextIcon } from "lucide-react";
import { fn } from "storybook/test";
import { withWidth } from "./decorators.tsx";

const LINES = Array.from({ length: 30 }, (_, i) => (
  // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list that never reorders
  <p key={i}>
    Line {i + 1} of a long document, tall enough to pass the card's height cap.
  </p>
));

/**
 * A bordered card with a filename header and a height-capped body. An attachment embed puts the
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
    children: (
      <p>
        The card draws whatever it is given. Past its height cap the body fades,
        and an expand control offers the full document.
      </p>
    ),
  },
  decorators: [withWidth("max-w-xl")],
} satisfies Meta<typeof DocumentCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Past `collapsedClassName`'s cap the body fades, and a "Show full document" button appears. */
export const Overflowing: Story = {
  args: { collapsedClassName: "max-h-40", children: <>{LINES}</> },
};

export const HeaderActions: Story = {
  args: { headerActions: <Badge variant="outline">v3</Badge> },
};

/** Without `onExpand` the body still fades, but there is no button and the name is plain text. */
export const NoExpand: Story = {
  args: {
    onExpand: undefined,
    collapsedClassName: "max-h-40",
    children: <>{LINES}</>,
  },
};

/** By default the icon follows the file name; `icon` overrides it. */
export const Icon: Story = { args: { icon: FileTextIcon } };

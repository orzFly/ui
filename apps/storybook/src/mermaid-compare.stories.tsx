import reviewAfter from "@orz/fixtures/diagrams/review-after.mmd?raw";
import reviewBefore from "@orz/fixtures/diagrams/review-before.mmd?raw";
import { MermaidCompare } from "@orz/ui-mermaid";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withViewer, withWidth } from "./decorators.tsx";

const FLOW_BEFORE = `flowchart LR
  open[Open] --> review{Review}
  review -- approve --> merged[Merged]
  review -- request changes --> open`;

const FLOW_AFTER = `flowchart LR
  open[Open] --> review{Review}
  review -- approve --> queue[Merge queue]
  queue --> merged[Merged]
  review -- request changes --> open`;

const BROKEN = `flowchart LR
  A[start --> B[[end`;

const meta = {
  title: "ui-mermaid/MermaidCompare",
  component: MermaidCompare,
  args: { before: reviewBefore, after: reviewAfter },
  decorators: [withWidth("max-w-5xl")],
  parameters: { guidelines: "/guidelines/patterns/comparing-images/" },
} satisfies Meta<typeof MermaidCompare>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A sequence diagram whose runner was renamed and which gained a message: the participant and
 * the new message are coloured, and the messages to the renamed participant are not.
 */
export const Playground: Story = {};

/** The sides' tags, and a filename named at the head. */
export const Labels: Story = {
  args: { labels: { before: "v1", after: "v2" }, title: "review.mmd" },
};

/** A flowchart that gained a node: the node and both its edges are coloured. */
export const Flowchart: Story = {
  args: { before: FLOW_BEFORE, after: FLOW_AFTER },
};

/** Within an `AttachmentViewerProvider` either picture opens both in the viewer at one zoom. */
export const Viewer: Story = {
  args: { title: "review.mmd" },
  decorators: [withViewer()],
};

/** A side that does not parse shows its error and its source; the other still draws. */
export const ParseError: Story = {
  tags: ["edge", "!autodocs"],
  args: { before: BROKEN, after: FLOW_AFTER },
};

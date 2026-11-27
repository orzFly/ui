import { ToolbarButton } from "@orz/ui/components/toolbar";
import { CodeBlock } from "@orz/ui-code";
import {
  ContentCollapse,
  ContentCollapseBody,
  ContentFrame,
  ContentHeader,
} from "@orz/ui-content/attachment";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DownloadIcon, FileCode2Icon } from "lucide-react";
import { fn } from "storybook/test";
import { withWidth } from "./decorators.tsx";

const steps = (count: number) =>
  Array.from(
    { length: count },
    (_, i) => `export const step${i + 1} = () => run(${i + 1});`,
  ).join("\n");

const LONG = steps(40);
const SHORT = steps(6);

const BUTTON = "text-muted-foreground raymond:text-foreground";

const download = (name: string) => (
  <ToolbarButton asChild size="icon-xs" className={BUTTON}>
    <a href={`#${name}`} download={name} aria-label={`download ${name}`}>
      <DownloadIcon />
    </a>
  </ToolbarButton>
);

const code = (text: string) => (
  <CodeBlock filename="steps.ts" contents={text} copy={false} />
);

/**
 * The parts every block in a document is built from: `ContentFrame`, its edge; `ContentHeader`, the
 * strip that names it; and `ContentCollapse` with `ContentCollapseBody`, which cut a long body at
 * the shared cap behind a bar that shows the rest, in place or in the viewer. A virtualized view
 * inside reads `useContentCollapse` to pick its box. `FenceFrame` and `DocumentCard` are these
 * parts put together.
 */
const meta = {
  title: "ui-content/ContentFrame",
  component: ContentFrame,
  args: {
    children: (
      <ContentCollapse collapse lines={40}>
        <ContentHeader icon={<FileCode2Icon />} name="steps.ts">
          {download("steps.ts")}
        </ContentHeader>
        <ContentCollapseBody>{code(LONG)}</ContentCollapseBody>
      </ContentCollapse>
    ),
  },
  argTypes: { children: { control: false } },
  decorators: [withWidth("max-w-xl")],
  parameters: { guidelines: "/guidelines/patterns/long-content/" },
} satisfies Meta<typeof ContentFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A named block, cut past its line count: Show all draws the rest in place, Show less cuts it again. */
export const Playground: Story = {};

/** The header: the kind's icon in the marker, the name, a note such as a size, then the controls. */
export const Header: Story = {
  args: {
    children: (
      <>
        <ContentHeader icon={<FileCode2Icon />} name="steps.ts" meta="312 B">
          {download("steps.ts")}
        </ContentHeader>
        {code(SHORT)}
      </>
    ),
  },
};

/** Without a name, the language stands in its place, muted. */
export const Lang: Story = {
  args: {
    children: (
      <>
        <ContentHeader icon={<FileCode2Icon />} lang="ts" />
        {code(SHORT)}
      </>
    ),
  },
};

/** Given `onOpen`, the bar opens the whole block elsewhere, the viewer, rather than expanding. */
export const OnOpen: Story = {
  args: {
    children: (
      <ContentCollapse collapse onOpen={fn()}>
        <ContentHeader icon={<FileCode2Icon />} name="steps.ts" />
        <ContentCollapseBody>{code(LONG)}</ContentCollapseBody>
      </ContentCollapse>
    ),
  },
};

/**
 * `collapse="measure"`, for a body whose length is not known up front: cut once it proves taller
 * than one and a half times the cap, and measured again as it or the window changes.
 */
export const Measure: Story = {
  args: {
    children: (
      <ContentCollapse collapse="measure">
        <ContentHeader icon={<FileCode2Icon />} name="steps.ts" />
        <ContentCollapseBody>{code(LONG)}</ContentCollapseBody>
      </ContentCollapse>
    ),
  },
};

/** A measured body under one and a half times the cap is drawn whole, with no bar. */
export const MeasureShort: Story = {
  args: {
    children: (
      <ContentCollapse collapse="measure">
        <ContentHeader icon={<FileCode2Icon />} name="steps.ts" />
        <ContentCollapseBody>{code(SHORT)}</ContentCollapseBody>
      </ContentCollapse>
    ),
  },
};

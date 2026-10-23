import { LinkChip } from "@orz/ui/components/link-chip";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircleDotIcon, FileTextIcon, GlobeIcon } from "lucide-react";

const meta = {
  title: "ui/Primitives/LinkChip",
  component: LinkChip,
  args: {
    children: "Release guide",
    href: "https://app.example/docs/release",
    icon: FileTextIcon,
    boxed: false,
  },
  argTypes: { icon: { control: false } },
} satisfies Meta<typeof LinkChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Inside running text and a heading, plain and boxed: the label stays on the line's baseline. */
export const InText: Story = {
  render: () => (
    <div className="markdown-body flex max-w-xl flex-col gap-3">
      {[false, true].map((boxed) => (
        <div key={String(boxed)}>
          <h3>
            {boxed ? "Boxed" : "Plain"} in a heading:{" "}
            <LinkChip href="#" icon={CircleDotIcon} boxed={boxed}>
              Issue 7
            </LinkChip>
          </h3>
          <p>
            See{" "}
            <LinkChip href="#" icon={FileTextIcon} boxed={boxed}>
              the release guide
            </LinkChip>
            , the{" "}
            <LinkChip href="#" icon={GlobeIcon} boxed={boxed}>
              project site
            </LinkChip>{" "}
            and{" "}
            <LinkChip href="#" boxed={boxed}>
              a chip without an icon
            </LinkChip>
            .
          </p>
        </div>
      ))}
    </div>
  ),
};

/** A long label is cut, not wrapped. */
export const Truncated: Story = {
  render: () => (
    <p className="max-w-56">
      <LinkChip href="#" icon={FileTextIcon} boxed>
        a-file-with-a-very-long-name-that-cannot-fit.md
      </LinkChip>
    </p>
  ),
};

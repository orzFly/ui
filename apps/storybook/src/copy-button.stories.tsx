import { CopyButton } from "@orz/ui/components/copy-button";
import {
  Toolbar,
  ToolbarButton,
  ToolbarLabel,
} from "@orz/ui/components/toolbar";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { BanIcon, BracesIcon, LinkIcon, RotateCwIcon } from "lucide-react";

const VARIANTS = ["ghost", "outline", "secondary", "default"] as const;
const SIZES = ["xs", "sm", "default", "lg"] as const;

const TOKEN = "orz_pat_fallback";

// The bar the button stands in, among a token's other commands: narrowed, it hides their words,
// then moves them into the ⋯ menu from the end.
const withToolbar: Decorator = (Story) => (
  <Toolbar aria-label="Access token" edge="bottom">
    <ToolbarButton>
      <RotateCwIcon />
      <ToolbarLabel>Regenerate</ToolbarLabel>
    </ToolbarButton>
    <Story />
    <ToolbarButton>
      <BanIcon />
      <ToolbarLabel>Revoke</ToolbarLabel>
    </ToolbarButton>
  </Toolbar>
);

const meta = {
  title: "ui/Primitives/CopyButton",
  component: CopyButton,
  parameters: { guidelines: "/guidelines/patterns/feedback/" },
  args: { text: TOKEN },
  argTypes: {
    text: { control: "text" },
    variant: { control: "select", options: VARIANTS },
    size: { control: "inline-radio", options: SIZES },
    icon: { control: false },
    children: { control: "text" },
  },
} satisfies Meta<typeof CopyButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** With words, at the text size; the icon still turns into a check. */
export const WithWords: Story = {
  args: { variant: "outline", size: "sm", children: "Copy token" },
};

/** Without words the button is the square of its size, named by `aria-label` and its tooltip. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {VARIANTS.map((variant) => (
        <div key={variant} className="flex flex-wrap items-center gap-2">
          {SIZES.map((size) => (
            <CopyButton {...args} key={size} variant={variant} size={size} />
          ))}
          {SIZES.map((size) => (
            <CopyButton
              {...args}
              key={`${size} words`}
              variant={variant}
              size={size}
            >
              Copy
            </CopyButton>
          ))}
        </div>
      ))}
    </div>
  ),
};

/** An icon of the caller's own, for what the copy is of. */
export const Icon: Story = {
  args: {
    text: "https://app.example/tasks/42",
    icon: <LinkIcon />,
    copiedLabel: "Link copied",
    children: "Copy link",
  },
};

/**
 * A function is read at the press, for a value that is costly to write out. One that gives `null`
 * copies nothing; `disabled` says so before the press.
 */
export const TextAtPress: Story = {
  args: {
    text: () => JSON.stringify({ id: 42, labels: ["ui", "docs"] }, null, 2),
    icon: <BracesIcon />,
    size: "sm",
    children: "Copy as JSON",
  },
  parameters: {
    docs: {
      source: {
        code: `<CopyButton
  text={() => JSON.stringify(value, null, 2)}
  icon={<BracesIcon />}
  size="sm"
>
  Copy as JSON
</CopyButton>`,
        language: "tsx",
      },
    },
  },
};

export const Disabled: Story = {
  args: { disabled: true, children: "Copy token" },
};

/**
 * With `asChild` the copying goes on a button of the caller's own, here a `ToolbarButton` drawn
 * as the commands of a header strip are, and the icon goes before its children.
 */
export const AsChild: Story = {
  args: {
    asChild: true,
    children: <ToolbarButton size="icon-xs" aria-label="Copy" title="Copy" />,
  },
};

/**
 * In a `Toolbar` its words, in a `ToolbarLabel`, hide to fit, and it goes into the ⋯ menu, where
 * a toast says the copy was made.
 */
export const InToolbar: Story = {
  args: {
    children: <ToolbarLabel>Copy token</ToolbarLabel>,
    copiedLabel: "Token copied",
  },
  decorators: [withToolbar],
};

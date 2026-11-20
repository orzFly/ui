import {
  LoadFailure,
  RefreshFailure as RefreshFailureView,
} from "@orz/ui/components/load-failure";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { InboxIcon, WebhookIcon } from "lucide-react";
import { fn } from "storybook/test";
import { withWidth } from "./decorators.tsx";

const meta = {
  title: "ui/LoadFailure",
  component: LoadFailure,
  parameters: { guidelines: "/guidelines/patterns/loading-empty-and-error/" },
  args: {
    message: "Couldn't load the list.",
    detail: "503 Service Unavailable",
    onRetry: fn(),
    retrying: false,
    size: "sm",
  },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "xs"] },
    orientation: {
      control: "inline-radio",
      options: ["line", "vertical", "horizontal"],
      mapping: { line: undefined },
    },
    icon: { control: false },
  },
} satisfies Meta<typeof LoadFailure>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const ExtraSmall: Story = { args: { size: "xs" } };

export const Retrying: Story = { args: { retrying: true } };

export const Vertical: Story = {
  args: {
    orientation: "vertical",
    icon: InboxIcon,
    message: "Couldn't load your notes.",
  },
  decorators: [withWidth("max-w-sm")],
};

export const Horizontal: Story = {
  args: {
    orientation: "horizontal",
    icon: WebhookIcon,
    message: "Couldn't load webhooks",
  },
  decorators: [withWidth("max-w-lg")],
};

export const RefreshFailure: Story = {
  render: (args) => (
    <div className="grid gap-3">
      {(["sm", "xs"] as const).map((size) => (
        <RefreshFailureView
          key={size}
          what="the inbox"
          detail="503 Service Unavailable"
          onRetry={args.onRetry}
          retrying={false}
          size={size}
        />
      ))}
    </div>
  ),
};

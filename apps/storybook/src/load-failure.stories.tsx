import { LoadFailure, RefreshFailure } from "@orz/ui/components/load-failure";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

const meta = {
  title: "Patterns/LoadFailure",
  component: LoadFailure,
  args: {
    message: "Couldn't load the list.",
    detail: "503 Service Unavailable",
    onRetry: fn(),
    retrying: false,
    size: "sm",
  },
  argTypes: { size: { control: "inline-radio", options: ["sm", "xs"] } },
} satisfies Meta<typeof LoadFailure>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const ExtraSmall: Story = { args: { size: "xs" } };

export const Retrying: Story = { args: { retrying: true } };

export const Refresh: Story = {
  render: (args) => (
    <div className="grid gap-3">
      {(["sm", "xs"] as const).map((size) => (
        <RefreshFailure
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

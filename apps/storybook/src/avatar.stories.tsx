import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@orz/ui/components/avatar";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CheckIcon } from "lucide-react";

const SIZES = ["sm", "default", "lg"] as const;
const SHAPES = ["circle", "square"] as const;

const meta = {
  title: "ui/Primitives/Avatar",
  parameters: { guidelines: "/guidelines/foundations/icons/" },
  component: Avatar,
  args: { size: "default", shape: "circle" },
  argTypes: {
    size: { control: "inline-radio", options: SIZES },
    shape: { control: "inline-radio", options: SHAPES },
  },
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback>AL</AvatarFallback>
    </Avatar>
  ),
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const SizesAndShapes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {SHAPES.map((shape) => (
        <div key={shape} className="flex items-center gap-3">
          {SIZES.map((size) => (
            <Avatar {...args} key={size} size={size} shape={shape}>
              <AvatarFallback>{size === "sm" ? "A" : "AL"}</AvatarFallback>
              <AvatarBadge>
                <CheckIcon />
              </AvatarBadge>
            </Avatar>
          ))}
        </div>
      ))}
    </div>
  ),
};

export const WithImage: Story = {
  args: { size: "lg" },
  render: (args) => (
    <Avatar {...args}>
      {/* An unreachable image, so the fallback is what renders offline. */}
      <AvatarImage src="https://avatar.example/alice.png" alt="alice" />
      <AvatarFallback>AL</AvatarFallback>
    </Avatar>
  ),
};

export const Group: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {SIZES.map((size) => (
        <AvatarGroup key={size}>
          {["AL", "BO", "NE"].map((initials) => (
            <Avatar {...args} key={initials} size={size}>
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          ))}
          <AvatarGroupCount>+4</AvatarGroupCount>
        </AvatarGroup>
      ))}
    </div>
  ),
};

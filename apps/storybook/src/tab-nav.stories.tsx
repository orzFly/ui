import { TabNav, TabNavLink } from "@orz/ui/components/tab-nav";
import { isPlainClick } from "@orz/ui/lib/link";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowUpRightIcon } from "lucide-react";
import { useState } from "react";
import { withWidth } from "./decorators.tsx";

const SECTIONS = ["Start", "Guidelines", "Demos"];

const meta = {
  title: "ui/Primitives/TabNav",
  component: TabNav,
  parameters: { guidelines: "/guidelines/patterns/navigation/" },
  args: { "aria-label": "Site" },
  render: function Render(args) {
    const [current, setCurrent] = useState("Guidelines");
    return (
      <TabNav {...args}>
        {SECTIONS.map((section) => (
          <TabNavLink
            key={section}
            href={`#${section.toLowerCase()}`}
            current={section === current}
            onClick={(event) => {
              if (!isPlainClick(event)) return;
              event.preventDefault();
              setCurrent(section);
            }}
          >
            {section}
          </TabNavLink>
        ))}
        <TabNavLink href="#storybook">
          Storybook
          <ArrowUpRightIcon />
        </TabNavLink>
      </TabNav>
    );
  },
} satisfies Meta<typeof TabNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Too narrow for every link: the last ones wait in the ⋯, the current one stays. */
export const Overflow: Story = {
  decorators: [withWidth("w-56")],
};

/** Too narrow for the current link and the ⋯: the current link keeps two letters and an ellipsis. */
export const CurrentCutShort: Story = {
  tags: ["edge", "!autodocs"],
  decorators: [withWidth("w-24")],
};

/** Too narrow even for that: the ⋯ alone, wearing the current mark. */
export const CurrentInMenu: Story = {
  tags: ["edge", "!autodocs"],
  decorators: [withWidth("w-16")],
};

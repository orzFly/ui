import { TabNav, TabNavLink } from "@orz/ui/components/tab-nav";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowUpRightIcon } from "lucide-react";
import { useState } from "react";

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

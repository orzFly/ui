import {
  ember,
  glacier,
  Header,
  PageSample,
  sampleCustomThemes,
  TerminalPane,
} from "@orz/fixtures/themes.tsx";
import { builtinThemes } from "@orz/themes";
import { ThemeEditor } from "@orz/ui/components/theme-editor";
import { ThemeMenu } from "@orz/ui/components/theme-menu";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { withOwnStore } from "./decorators.tsx";

/** The story in a page header over a sample page, with a terminal pane if asked. */
function menuPage(terminal: boolean): Decorator {
  return (Story) => (
    <div className="grid max-w-2xl gap-4">
      <Header>
        <Story />
      </Header>
      <PageSample />
      {terminal && <TerminalPane />}
    </div>
  );
}

/**
 * Picks a theme for one slot of the store: filter, Auto / Light / Dark, and
 * each theme's variants in a submenu. Hovering a row previews it on the page.
 */
const meta = {
  title: "ui/ThemeMenu",
  component: ThemeMenu,
  argTypes: {
    slot: { control: "inline-radio", options: ["ui", "terminal"] },
    trigger: { control: false },
  },
  parameters: {
    // Each story but Playground paints the page from a store of its own; in
    // one docs page they would repaint each other.
    docs: { story: { inline: false, iframeHeight: 520 } },
  },
} satisfies Meta<typeof ThemeMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Drives the toolbar's store, so a pick here changes the whole preview. */
export const Playground: Story = {};

/**
 * Both slots: the UI picker in the header, and a terminal pane with a picker
 * of its own. "Same as UI" follows the page, previews included.
 */
export const UiAndTerminal: Story = {
  parameters: { layout: "padded" },
  decorators: [
    menuPage(true),
    withOwnStore({
      storageKey: "orz-storybook-theme-menu-slots",
      themes: builtinThemes,
      terminalThemes: [...builtinThemes, ember, glacier],
    }),
  ],
};

/**
 * Custom themes lead the list. "Custom themes…" opens the editor on a new
 * theme, and a row's edit button opens it on that theme; Driftwood's base is
 * missing, so it is only reachable from the editor's own list.
 */
export const CustomThemes: Story = {
  parameters: { layout: "padded" },
  args: { onCustomize: fn() },
  decorators: [
    menuPage(false),
    withOwnStore(
      {
        storageKey: "orz-storybook-theme-menu-custom",
        themes: builtinThemes,
        persistCustomThemes: false,
      },
      (s) => s.setCustomThemes(sampleCustomThemes),
    ),
  ],
  render: function Render(args) {
    const [editing, setEditing] = useState<{ id?: string } | null>(null);
    return (
      <>
        <ThemeMenu
          {...args}
          onCustomize={(id, slot) => {
            args.onCustomize?.(id, slot);
            setEditing({ id });
          }}
        />
        <ThemeEditor
          open={editing !== null}
          themeId={editing?.id}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      </>
    );
  },
};

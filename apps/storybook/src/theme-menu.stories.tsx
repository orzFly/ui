import { builtinThemes } from "@orz/themes";
import { ThemeEditor } from "@orz/ui/components/theme-editor";
import { ThemeMenu } from "@orz/ui/components/theme-menu";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import {
  ember,
  glacier,
  Header,
  OwnStore,
  PageSample,
  sampleCustomThemes,
  TerminalPane,
} from "./theme-fixtures.tsx";

/**
 * Picks a theme for one slot of the store: filter, Auto / Light / Dark, and
 * each theme's variants in a submenu. Hovering a row previews it on the page.
 */
const meta = {
  title: "Patterns/ThemeMenu",
  component: ThemeMenu,
  parameters: {
    // Each story but Default paints the page from a store of its own; in one
    // docs page they would repaint each other.
    docs: { story: { inline: false, iframeHeight: 520 } },
  },
} satisfies Meta<typeof ThemeMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Drives the toolbar's store, so a pick here changes the whole preview. */
export const Default: Story = {};

/**
 * Both slots: the UI picker in the header, and a terminal pane with a picker
 * of its own. "Same as UI" follows the page, previews included.
 */
export const UiAndTerminal: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <OwnStore
      options={{
        storageKey: "orz-storybook-theme-menu-slots",
        themes: builtinThemes,
        terminalThemes: [...builtinThemes, ember, glacier],
      }}
    >
      <div className="grid max-w-2xl gap-4">
        <Header>
          <ThemeMenu />
        </Header>
        <PageSample />
        <TerminalPane />
      </div>
    </OwnStore>
  ),
};

function MenuWithEditor({
  onCustomize,
}: {
  onCustomize?: (id: string | undefined, slot: "ui" | "terminal") => void;
}) {
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  return (
    <div className="grid max-w-2xl gap-4">
      <Header>
        <ThemeMenu
          onCustomize={(id, slot) => {
            onCustomize?.(id, slot);
            setEditing({ id });
          }}
        />
      </Header>
      <PageSample />
      <ThemeEditor
        open={editing !== null}
        themeId={editing?.id}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
    </div>
  );
}

/**
 * Custom themes lead the list. "Custom themes…" opens the editor on a new
 * theme, and a row's edit button opens it on that theme; Driftwood's base is
 * missing, so it is only reachable from the editor's own list.
 */
export const CustomThemes: Story = {
  parameters: { layout: "padded" },
  args: { onCustomize: fn() },
  render: (args) => (
    <OwnStore
      options={{
        storageKey: "orz-storybook-theme-menu-custom",
        themes: builtinThemes,
        persistCustomThemes: false,
      }}
      setup={(store) => store.setCustomThemes(sampleCustomThemes)}
    >
      <MenuWithEditor onCustomize={args.onCustomize} />
    </OwnStore>
  ),
};

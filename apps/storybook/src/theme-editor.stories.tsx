import { builtinThemes } from "@orz/themes";
import { Button } from "@orz/ui/components/button";
import { ThemeEditor } from "@orz/ui/components/theme-editor";
import { ThemeMenu } from "@orz/ui/components/theme-menu";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PaletteIcon } from "lucide-react";
import { useState } from "react";
import { fn } from "storybook/test";
import {
  Header,
  OwnStore,
  PageSample,
  sampleCustomThemes,
  TerminalPane,
} from "./theme-fixtures.tsx";

/**
 * Edits the store's custom themes in a panel docked to the right, while the
 * page previews the draft. Save adds the theme to `ThemeMenu`'s Custom group
 * and picks it; Import… and Export carry themes between apps as JSON.
 */
const meta = {
  title: "Patterns/ThemeEditor",
  component: ThemeEditor,
  args: { open: false, onOpenChange: fn() },
  argTypes: { open: { control: false }, themeId: { control: false } },
  parameters: {
    layout: "padded",
    // Each story paints the page from a store of its own; in one docs page
    // they would repaint each other.
    docs: { story: { inline: false, iframeHeight: 720 } },
  },
} satisfies Meta<typeof ThemeEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Seeded with three custom themes that are not persisted, so a reload starts
 * over; the pick is kept under a storage key of the story's own.
 */
function EditorDemo({
  initial,
  onOpenChange,
}: {
  initial?: { id?: string };
  onOpenChange: (open: boolean) => void;
}) {
  const [editing, setEditing] = useState<{ id?: string } | null>(
    initial ?? null,
  );
  return (
    <OwnStore
      options={{
        storageKey: "orz-storybook-theme-editor",
        themes: builtinThemes,
        terminalThemes: builtinThemes,
        persistCustomThemes: false,
      }}
      setup={(store) => store.setCustomThemes(sampleCustomThemes)}
    >
      <div className="grid max-w-2xl gap-4">
        <Header>
          <Button variant="outline" size="sm" onClick={() => setEditing({})}>
            <PaletteIcon />
            Custom themes
          </Button>
          <ThemeMenu onCustomize={(id) => setEditing({ id })} />
        </Header>
        <PageSample />
        <TerminalPane />
      </div>
      <ThemeEditor
        open={editing !== null}
        themeId={editing?.id}
        onOpenChange={(open) => {
          onOpenChange(open);
          if (!open) setEditing(null);
        }}
      />
    </OwnStore>
  );
}

/**
 * Closed until "Custom themes" or `ThemeMenu`'s "Custom themes…" and edit
 * buttons open it.
 */
export const Default: Story = {
  render: (args) => <EditorDemo onOpenChange={args.onOpenChange} />,
};

/** Open on Paper & Ink: Solarized and Dracula AMOLED with a few overrides. */
export const EditingTheme: Story = {
  render: (args) => (
    <EditorDemo
      initial={{ id: "custom-paper-ink" }}
      onOpenChange={args.onOpenChange}
    />
  ),
};

/**
 * Open on Driftwood, whose base this app does not have: the store keeps it
 * out of the menus, and the editor offers to repair it.
 */
export const MissingBase: Story = {
  render: (args) => (
    <EditorDemo
      initial={{ id: "custom-driftwood" }}
      onOpenChange={args.onOpenChange}
    />
  ),
};

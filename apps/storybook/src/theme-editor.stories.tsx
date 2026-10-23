import { builtinThemes } from "@orz/themes";
import { Button } from "@orz/ui/components/button";
import { ThemeEditor } from "@orz/ui/components/theme-editor";
import { ThemeMenu } from "@orz/ui/components/theme-menu";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PaletteIcon } from "lucide-react";
import { useState } from "react";
import { fn } from "storybook/test";
import {
  ember,
  glacier,
  Header,
  OwnStore,
  PageSample,
  sampleCustomThemes,
  sampleTerminalThemes,
  TerminalPane,
} from "./theme-fixtures.tsx";

/**
 * Edits the store's custom themes in a panel docked to the right, while the
 * page previews the draft. Save adds the theme to `ThemeMenu`'s Custom group
 * and picks it; Import… and Export carry themes between apps as JSON. A store
 * with a terminal slot also edits terminal themes, made of terminal colours
 * alone.
 */
const meta = {
  title: "ui/ThemeEditor",
  component: ThemeEditor,
  args: { open: false, onOpenChange: fn() },
  argTypes: {
    open: { control: false },
    themeId: { control: false },
    kind: { control: false },
  },
  parameters: {
    layout: "padded",
    // Each story paints the page from a store of its own; in one docs page
    // they would repaint each other.
    docs: { story: { inline: false, iframeHeight: 720 } },
  },
} satisfies Meta<typeof ThemeEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

type Editing = { id?: string; slot?: "ui" | "terminal" };

/**
 * Both slots, seeded with custom themes of both kinds that are not
 * persisted, so a reload starts over; the pick is kept under a storage key
 * of the story's own. Each menu opens the editor on its own slot's kind.
 */
function EditorDemo({
  initial,
  onOpenChange,
}: {
  initial?: Editing;
  onOpenChange: (open: boolean) => void;
}) {
  const [editing, setEditing] = useState<Editing | null>(initial ?? null);
  const customize = (id: string | undefined, slot: "ui" | "terminal") =>
    setEditing({ id, slot });
  return (
    <OwnStore
      options={{
        storageKey: "orz-storybook-theme-editor",
        themes: builtinThemes,
        terminalThemes: [...builtinThemes, ember, glacier],
        persistCustomThemes: false,
      }}
      setup={(store) =>
        store.setCustomThemes([...sampleCustomThemes, ...sampleTerminalThemes])
      }
    >
      <div className="grid max-w-2xl gap-4">
        <Header>
          <Button variant="outline" size="sm" onClick={() => setEditing({})}>
            <PaletteIcon />
            Custom themes
          </Button>
          <ThemeMenu onCustomize={customize} />
        </Header>
        <PageSample />
        <TerminalPane onCustomize={customize} />
      </div>
      <ThemeEditor
        open={editing !== null}
        themeId={editing?.id}
        kind={editing?.slot}
        onOpenChange={(open) => {
          onOpenChange(open);
          if (!open) setEditing(null);
        }}
      />
    </OwnStore>
  );
}

/**
 * Closed until "Custom themes" or a `ThemeMenu`'s "Custom themes…" and edit
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

/**
 * Both slots, opened as the terminal menu's "Custom themes…" opens it: a new
 * terminal theme copied from what the terminal shows. The list groups the
 * two kinds, and + New asks which one to make.
 */
export const BothSlots: Story = {
  render: (args) => (
    <EditorDemo
      initial={{ slot: "terminal" }}
      onOpenChange={args.onOpenChange}
    />
  ),
};

/**
 * A store with a terminal slot only: the editor makes terminal themes, each
 * side None, based on a palette, or fully custom. Ember dusk is based on
 * Ember with two colours changed; Moss is fully custom.
 */
export const TerminalOnly: Story = {
  render: (args) => <TerminalOnlyDemo onOpenChange={args.onOpenChange} />,
};

function TerminalOnlyDemo({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  return (
    <OwnStore
      options={{
        storageKey: "orz-storybook-theme-editor-terminal",
        terminalThemes: [...builtinThemes, ember, glacier],
        persistCustomThemes: false,
      }}
      setup={(store) => store.setCustomThemes(sampleTerminalThemes)}
    >
      <div className="grid max-w-2xl gap-4">
        <TerminalPane onCustomize={(id, slot) => setEditing({ id, slot })} />
      </div>
      <ThemeEditor
        open={editing !== null}
        themeId={editing?.id}
        kind={editing?.slot}
        onOpenChange={(open) => {
          onOpenChange(open);
          if (!open) setEditing(null);
        }}
      />
    </OwnStore>
  );
}

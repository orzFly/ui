import { builtinThemes } from "@orz/themes";
import { Button } from "@orz/ui/components/button";
import { ThemeEditor } from "@orz/ui/components/theme-editor";
import { ThemeMenu } from "@orz/ui/components/theme-menu";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { PaletteIcon } from "lucide-react";
import { fn } from "storybook/test";
import { argsUpdater } from "./args.ts";
import { withOwnStore } from "./decorators.tsx";
import {
  ember,
  glacier,
  Header,
  PageSample,
  sampleCustomThemes,
  sampleTerminalThemes,
  TerminalPane,
} from "./fixtures/themes.tsx";

/** A page with both menus and a button, each opening the editor through the args. */
const editorPage: Decorator = (Story, context) => {
  const updateArgs = argsUpdater(context);
  const customize = (themeId: string | undefined, kind: "ui" | "terminal") =>
    updateArgs({ open: true, themeId, kind });
  return (
    <div className="grid max-w-2xl gap-4">
      <Header>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            updateArgs({ open: true, themeId: undefined, kind: undefined })
          }
        >
          <PaletteIcon />
          Custom themes
        </Button>
        <ThemeMenu onCustomize={customize} />
      </Header>
      <PageSample />
      <TerminalPane onCustomize={customize} />
      <Story />
    </div>
  );
};

/** The same page with a terminal pane alone, for a store with no UI slot. */
const terminalPage: Decorator = (Story, context) => {
  const updateArgs = argsUpdater(context);
  const customize = (themeId: string | undefined, kind: "ui" | "terminal") =>
    updateArgs({ open: true, themeId, kind });
  return (
    <div className="grid max-w-2xl gap-4">
      <TerminalPane onCustomize={customize} />
      <Story />
    </div>
  );
};

/**
 * Both slots, seeded with custom themes of both kinds that are not
 * persisted, so a reload starts over; the pick is kept under a storage key
 * of the story's own. Each menu opens the editor on its own slot's kind.
 */
const BOTH = {
  storageKey: "orz-storybook-theme-editor",
  themes: builtinThemes,
  terminalThemes: [...builtinThemes, ember, glacier],
  persistCustomThemes: false,
};
// The page inside the store, so its menus read the story's own store.
const bothSlots = [
  editorPage,
  withOwnStore(BOTH, (s) =>
    s.setCustomThemes([...sampleCustomThemes, ...sampleTerminalThemes]),
  ),
];

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
    open: { control: "boolean" },
    themeId: { control: "text" },
    kind: { control: "inline-radio", options: ["ui", "terminal"] },
  },
  parameters: {
    layout: "padded",
    // Each story paints the page from a store of its own; in one docs page
    // they would repaint each other.
    docs: { story: { inline: false, iframeHeight: 720 } },
  },
  render: function Render(args, context) {
    const updateArgs = argsUpdater(context);
    return (
      <ThemeEditor
        {...args}
        onOpenChange={(open) => {
          args.onOpenChange(open);
          if (!open)
            updateArgs({ open: false, themeId: undefined, kind: undefined });
        }}
      />
    );
  },
} satisfies Meta<typeof ThemeEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Closed until "Custom themes" or a `ThemeMenu`'s "Custom themes…" and edit
 * buttons open it.
 */
export const Playground: Story = {
  decorators: bothSlots,
};

/** Open on Paper & Ink: Solarized and Dracula AMOLED with a few overrides. */
export const EditingTheme: Story = {
  args: { open: true, themeId: "custom-paper-ink" },
  decorators: bothSlots,
};

/**
 * Open on Driftwood, whose base this app does not have: the store keeps it
 * out of the menus, and the editor offers to repair it.
 */
export const MissingBase: Story = {
  args: { open: true, themeId: "custom-driftwood" },
  decorators: bothSlots,
};

/**
 * Both slots, opened as the terminal menu's "Custom themes…" opens it: a new
 * terminal theme copied from what the terminal shows. The list groups the
 * two kinds, and + New asks which one to make.
 */
export const BothSlots: Story = {
  args: { open: true, kind: "terminal" },
  decorators: bothSlots,
};

/**
 * A store with a terminal slot only: the editor makes terminal themes, each
 * side None, based on a palette, or fully custom. Ember dusk is based on
 * Ember with two colours changed; Moss is fully custom.
 */
export const TerminalOnly: Story = {
  decorators: [
    terminalPage,
    withOwnStore(
      {
        storageKey: "orz-storybook-theme-editor-terminal",
        terminalThemes: [...builtinThemes, ember, glacier],
        persistCustomThemes: false,
      },
      (s) => s.setCustomThemes(sampleTerminalThemes),
    ),
  ],
};

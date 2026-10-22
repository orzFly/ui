import {
  builtinThemes,
  type TerminalTheme,
  type TerminalTokens,
} from "@orz/themes";
import { ThemeEditor } from "@orz/ui/components/theme-editor";
import { ThemeMenu } from "@orz/ui/components/theme-menu";
import type { Meta, StoryObj } from "@storybook/react-vite";
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

function terminalTokens(
  background: string,
  foreground: string,
  ansi: string[],
): TerminalTokens {
  const names = [
    "black",
    "red",
    "green",
    "yellow",
    "blue",
    "magenta",
    "cyan",
    "white",
  ] as const;
  const tokens: Record<string, string> = {
    "terminal-background": background,
    "terminal-foreground": foreground,
    "terminal-cursor": foreground,
    "terminal-selection": `color-mix(in oklab, ${foreground} 25%, transparent)`,
  };
  names.forEach((name, i) => {
    tokens[`ansi-${name}`] = ansi[i] as string;
    tokens[`ansi-bright-${name}`] = ansi[i + 8] as string;
  });
  return tokens as TerminalTokens;
}

/** Terminal-only themes: terminal colours and nothing else. */
const ember: TerminalTheme = {
  id: "ember",
  label: "Ember",
  dark: {
    terminal: terminalTokens("#1b1410", "#eadccf", [
      "#2a201a",
      "#e0603c",
      "#9fbf5a",
      "#e8b04a",
      "#6f97c6",
      "#c47aa8",
      "#5fb3a6",
      "#d6c8ba",
      "#5a4a3e",
      "#ff8a63",
      "#bedb7a",
      "#ffcf6e",
      "#94b8e3",
      "#e29cc5",
      "#83d1c4",
      "#fff3e6",
    ]),
  },
};
const glacier: TerminalTheme = {
  id: "glacier",
  label: "Glacier",
  light: {
    terminal: terminalTokens("#f4f8fb", "#1f2d3a", [
      "#1f2d3a",
      "#c0392b",
      "#2e8b57",
      "#b7791f",
      "#2b6cb0",
      "#8e44ad",
      "#138d90",
      "#cbd5e0",
      "#4a5568",
      "#e53e3e",
      "#38a169",
      "#d69e2e",
      "#3182ce",
      "#9f7aea",
      "#0bc5ea",
      "#ffffff",
    ]),
  },
};

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
  onCustomize?: (id?: string) => void;
}) {
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  return (
    <div className="grid max-w-2xl gap-4">
      <Header>
        <ThemeMenu
          onCustomize={(id) => {
            onCustomize?.(id);
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

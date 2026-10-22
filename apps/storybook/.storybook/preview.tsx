import { builtinThemes, type ColorScheme, schemesOf } from "@orz/themes";
import { Toaster } from "@orz/ui/components/sonner";
import {
  createThemeStore,
  type ResolvedTheme,
  type ThemePick,
  type ThemePref,
  ThemeProvider,
} from "@orz/ui/theme";
import { DocsContainer } from "@storybook/addon-docs/blocks";
import type { Decorator, Preview } from "@storybook/react-vite";
import { type ComponentProps, useEffect, useSyncExternalStore } from "react";
import { addons } from "storybook/preview-api";
import { storybookTheme } from "./storybook-theme.ts";
import { THEME_EVENT } from "./theme-channel.ts";
import "./preview.css";

const themes = createThemeStore({
  storageKey: "orz-storybook-theme",
  themes: builtinThemes,
  terminalThemes: builtinThemes,
});

const SCHEME_TITLE: Record<ColorScheme, string> = {
  light: "Light",
  dark: "Dark",
};

// Toolbar values must be plain strings, so each item is `id_scheme` (plus
// `_variant`), and prefOf turns the two globals back into a pref. Not `:`:
// Storybook drops a URL global holding anything but [a-zA-Z0-9 _-], so a
// reload would lose the pick.
const SEPARATOR = "_";
const palettes = builtinThemes.flatMap((theme) =>
  schemesOf(theme).map((scheme) => ({
    value: `${theme.id}${SEPARATOR}${scheme}`,
    title: `${theme.label} ${theme[scheme]?.label ?? SCHEME_TITLE[scheme]}`,
    hasAmoled: theme[scheme]?.variants?.amoled !== undefined,
  })),
);
const THEME_ITEMS = [
  { value: "system", title: "System" },
  ...palettes.map(({ value, title }) => ({ value, title })),
  ...palettes
    .filter((p) => p.hasAmoled)
    .map(({ value, title }) => ({
      value: `${value}${SEPARATOR}amoled`,
      title: `${title} AMOLED`,
    })),
];
const TERMINAL_ITEMS = [
  { value: "follow", title: "Follow theme" },
  ...palettes.map(({ value, title }) => ({ value, title })),
];

function pickOf(value: string): ThemePick {
  const [theme, mode, variant] = value.split(SEPARATOR);
  const pick: ThemePick = { theme, mode: mode as ColorScheme };
  if (variant) pick.variant = variant;
  return pick;
}

function prefOf(theme: string, terminal: string): ThemePref {
  const pref: ThemePref = {
    ui:
      theme === "system"
        ? { theme: builtinThemes[0].id, mode: "system" }
        : pickOf(theme),
  };
  if (terminal !== "follow") pref.terminal = pickOf(terminal);
  return pref;
}

const withTheme: Decorator = (Story, context) => {
  const theme = (context.globals.theme as string | undefined) ?? "system";
  const terminal = (context.globals.terminal as string | undefined) ?? "follow";
  useEffect(() => {
    themes.setPref(prefOf(theme, terminal));
  }, [theme, terminal]);
  return (
    <ThemeProvider store={themes}>
      <Story />
      <Toaster />
    </ThemeProvider>
  );
};

// The store has a UI slot, so it always resolves a UI theme.
const resolvedTheme = () => themes.getResolved() as ResolvedTheme;

void addons.ready().then((channel) => {
  const send = () => channel.emit(THEME_EVENT, storybookTheme(resolvedTheme()));
  send();
  themes.subscribe(send);
});

// Docs pages are drawn by Storybook's own theme, which knows nothing of the
// toolbar; left alone it stays light under a dark @orz/ui theme and the
// stories' light text lands on a white page.
function ThemedDocsContainer(props: ComponentProps<typeof DocsContainer>) {
  const resolved = useSyncExternalStore(themes.subscribe, resolvedTheme);
  return <DocsContainer {...props} theme={storybookTheme(resolved)} />;
}

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Theme",
      toolbar: {
        title: "Theme",
        icon: "paintbrush",
        dynamicTitle: true,
        items: THEME_ITEMS,
      },
    },
    terminal: {
      description: "Terminal theme",
      toolbar: {
        title: "Terminal",
        // Storybook ships no terminal icon; ⌘ is the nearest shell glyph.
        icon: "command",
        dynamicTitle: true,
        items: TERMINAL_ITEMS,
      },
    },
  },
  initialGlobals: { theme: "system", terminal: "follow" },
  parameters: {
    docs: { container: ThemedDocsContainer },
    options: {
      // Storybook lifts this function out of the source and evals it on its
      // own: it cannot reach anything outside its body, and a type
      // annotation inside it is a syntax error there.
      // Equal titles compare as 0, and the sort is stable, which keeps a file's
      // docs entry and stories in their written order.
      storySort: (a, b) => {
        const order = ["Foundations", "Primitives", "Patterns", "Hooks", "Hex"];
        const [ra, rb] = [a.title, b.title].map((title) => {
          const i = order.indexOf(title.split("/")[0]);
          return i === -1 ? order.length : i;
        });
        return ra - rb || a.title.localeCompare(b.title);
      },
    },
  },
  decorators: [withTheme],
  tags: ["autodocs"],
};

export default preview;

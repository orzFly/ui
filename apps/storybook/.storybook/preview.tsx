import { Toaster } from "@orz/ui/components/sonner";
import {
  createThemeStore,
  THEMES,
  type ThemePref,
  ThemeProvider,
  themeKind,
} from "@orz/ui/theme";
import { DocsContainer } from "@storybook/addon-docs/blocks";
import type { Decorator, Preview } from "@storybook/react-vite";
import { type ComponentProps, useEffect, useSyncExternalStore } from "react";
import { themes as sbThemes } from "storybook/theming";
import "./preview.css";

const themes = createThemeStore({ storageKey: "orz-storybook-theme" });

const withTheme: Decorator = (Story, context) => {
  const pref = context.globals.theme as ThemePref;
  useEffect(() => {
    themes.setPref(pref);
  }, [pref]);
  return (
    <ThemeProvider store={themes}>
      <Story />
      <Toaster />
    </ThemeProvider>
  );
};

// Docs pages are drawn by Storybook's own theme, which knows nothing of the
// toolbar: left alone it stays light under a dark @orz/ui theme and the
// stories' light text lands on a white page. Its colour functions cannot
// parse oklch, so it only picks the matching light/dark base here and
// preview.css paints the exact surface.
function ThemedDocsContainer(props: ComponentProps<typeof DocsContainer>) {
  const theme = useSyncExternalStore(themes.subscribe, themes.getTheme);
  return (
    <DocsContainer
      {...props}
      theme={themeKind(theme) === "dark" ? sbThemes.dark : sbThemes.light}
    />
  );
}

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Theme",
      toolbar: {
        title: "Theme",
        icon: "paintbrush",
        dynamicTitle: true,
        items: [
          { value: "system", title: "System" },
          ...THEMES.map((t) => ({ value: t.value, title: t.label })),
        ],
      },
    },
  },
  initialGlobals: { theme: "system" },
  parameters: { docs: { container: ThemedDocsContainer } },
  decorators: [withTheme],
  tags: ["autodocs"],
};

export default preview;

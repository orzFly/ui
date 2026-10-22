import { Toaster } from "@orz/ui/components/sonner";
import {
  createThemeStore,
  THEMES,
  type Theme,
  type ThemePref,
  ThemeProvider,
  themeKind,
} from "@orz/ui/theme";
import { DocsContainer } from "@storybook/addon-docs/blocks";
import type { Decorator, Preview } from "@storybook/react-vite";
import { type ComponentProps, useEffect, useSyncExternalStore } from "react";
import { addons } from "storybook/preview-api";
import { create, type ThemeVars } from "storybook/theming";
import { THEME_EVENT } from "./theme-channel.ts";
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

// Storybook's theming runs every colour through polished, which cannot parse
// oklch. Painting a token onto a canvas and reading the pixel back lets the
// browser do the conversion, gamut mapping and var() resolution included.
const canvas = document
  .createElement("canvas")
  .getContext("2d", { willReadFrequently: true });

function token(name: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(
    `--${name}`,
  );
  if (canvas === null) return value;
  canvas.clearRect(0, 0, 1, 1);
  canvas.fillStyle = "transparent";
  canvas.fillStyle = value;
  canvas.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data;
  return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`;
}

// Reads the theme the store has just written onto <html>, so it must only be
// called for the store's current theme; the cache keys on that.
const varsCache = new Map<Theme, ThemeVars>();
function storybookTheme(theme: Theme): ThemeVars {
  let vars = varsCache.get(theme);
  if (vars === undefined) {
    vars = create({
      base: themeKind(theme),
      colorPrimary: token("primary"),
      // Storybook draws the selected sidebar item in white on this.
      colorSecondary: token("sidebar-primary"),
      appBg: token("sidebar"),
      appContentBg: token("background"),
      appPreviewBg: token("background"),
      appHoverBg: token("accent"),
      appBorderColor: token("border"),
      textColor: token("foreground"),
      textMutedColor: token("muted-foreground"),
      textInverseColor: token("primary-foreground"),
      barBg: token("background"),
      barTextColor: token("muted-foreground"),
      buttonBg: token("secondary"),
      buttonBorder: token("border"),
      booleanBg: token("muted"),
      booleanSelectedBg: token("background"),
      inputBg: token("background"),
      inputBorder: token("input"),
      inputTextColor: token("foreground"),
    });
    varsCache.set(theme, vars);
  }
  return vars;
}

void addons.ready().then((channel) => {
  const send = () =>
    channel.emit(THEME_EVENT, storybookTheme(themes.getTheme()));
  send();
  themes.subscribe(send);
});

// Docs pages are drawn by Storybook's own theme, which knows nothing of the
// toolbar; left alone it stays light under a dark @orz/ui theme and the
// stories' light text lands on a white page.
function ThemedDocsContainer(props: ComponentProps<typeof DocsContainer>) {
  const theme = useSyncExternalStore(themes.subscribe, themes.getTheme);
  return <DocsContainer {...props} theme={storybookTheme(theme)} />;
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

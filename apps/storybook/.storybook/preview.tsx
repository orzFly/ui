import { Toaster } from "@orz/ui/components/sonner";
import {
  createThemeStore,
  THEMES,
  type ThemePref,
  ThemeProvider,
} from "@orz/ui/theme";
import type { Decorator, Preview } from "@storybook/react-vite";
import { useEffect } from "react";
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
  decorators: [withTheme],
  tags: ["autodocs"],
};

export default preview;

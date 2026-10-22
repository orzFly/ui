import { addons } from "storybook/manager-api";
import type { ThemeVars } from "storybook/theming";
import { THEME_EVENT } from "./theme-channel.ts";

// The vars only arrive once the preview iframe has loaded; until then the
// last theme seen stands in, so a reload under a dark theme opens dark.
const CACHE_KEY = "orz-storybook-manager-theme";

try {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) addons.setConfig({ theme: JSON.parse(cached) as ThemeVars });
} catch {
  // no storage, or an unreadable entry: start from Storybook's default
}

addons.register("orz/theme", (api) => {
  api.on(THEME_EVENT, (theme: ThemeVars) => {
    api.setOptions({ theme });
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(theme));
    } catch {
      // the theme just won't survive a reload
    }
  });
});

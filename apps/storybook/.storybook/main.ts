import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { mergeConfig } from "vite";
import { MANAGER_FONTS_AT, managerFonts } from "./manager-fonts.ts";
import { buildToolbar, VITE_SHARED } from "./toolbar/build.ts";

const fonts = managerFonts();

// StorybookConfig does not declare the managerEntries preset, which is the
// one hook that runs before the manager's esbuild bundle.
type Config = StorybookConfig & {
  managerEntries?: (
    entries: string[] | undefined,
    options: { configType?: string },
  ) => Promise<string[]>;
};

const config: Config = {
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
  // The checklist walks a new Storybook project's author through its setup;
  // a visitor here came to read the components.
  features: {
    sidebarOnboardingChecklist: false,
    menuOnboardingChecklist: false,
  },
  staticDirs: [{ from: fonts.dir, to: MANAGER_FONTS_AT }],
  managerHead: (head = "") => `${head}\n${fonts.head}`,
  // Edge, perf and regression stories: out of the sidebar until its tag
  // filter selects them; their own "!autodocs" keeps them off the docs page.
  tags: { edge: { defaultFilterSelection: "exclude" } },
  // First, so the island has set globalThis.__ORZ_TOOLBAR__ by the time
  // manager.ts, the last entry, reads it.
  managerEntries: async (entries = [], options) => [
    await buildToolbar(options.configType),
    ...entries,
  ],
  viteFinal: (base) =>
    mergeConfig(base, {
      plugins: [react(), tailwindcss()],
      resolve: VITE_SHARED,
    }),
};

export default config;

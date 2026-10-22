import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { mergeConfig } from "vite";
import { buildToolbar, VITE_SHARED } from "./toolbar/build.ts";

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
  core: { disableTelemetry: true },
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

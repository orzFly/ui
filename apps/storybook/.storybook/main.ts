import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defaultClientConditions, mergeConfig } from "vite";

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  core: { disableTelemetry: true },
  viteFinal: (base) =>
    mergeConfig(base, {
      plugins: [react(), tailwindcss()],
      resolve: {
        // @orz/ui's exports point this condition at src/, so stories run on
        // the package's source through the same entry points a consumer
        // imports, with no watch build in between.
        conditions: ["@orz/source", ...defaultClientConditions],
        // Source files resolve their peers from packages/ui/node_modules; a
        // second React or radix-ui beside the app's would split their module
        // state the moment the two lockfile entries drift apart.
        dedupe: [
          "react",
          "react-dom",
          "radix-ui",
          "sonner",
          "lucide-react",
          "@pierre/diffs",
          "@orz/ui-content",
        ],
      },
    }),
};

export default config;

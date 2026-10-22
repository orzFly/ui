import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { build, defaultClientConditions } from "vite";
import { islandCss } from "./island-css.ts";

/** The resolve settings the preview's Vite and the island's build share. */
export const VITE_SHARED = {
  // @orz/ui's exports point this condition at src/, so stories run on the
  // package's source through the same entry points a consumer imports, with
  // no watch build in between.
  conditions: ["@orz/source", ...defaultClientConditions],
  // Source files resolve their peers from packages/ui/node_modules; a second
  // React or radix-ui beside the app's would split their module state the
  // moment the two lockfile entries drift apart.
  dedupe: [
    "react",
    "react-dom",
    "radix-ui",
    "sonner",
    "lucide-react",
    "@pierre/diffs",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/highlight",
    "@orz/ui-content",
  ],
};

const app = (relative: string) =>
  fileURLToPath(new URL(`../../${relative}`, import.meta.url));

/**
 * Builds island.tsx for Storybook's manager and returns the manager entry
 * that loads it. Storybook builds the manager once per `storybook dev` start,
 * with no watch, so an edit to the toolbar or to ThemeMenu reaches the
 * toolbar on the next start; stories keep HMR.
 */
export async function buildToolbar(
  configType = "DEVELOPMENT",
): Promise<string> {
  // Under node_modules: gitignored, outside biome and tsc, and its imports
  // resolve from the app's node_modules. One directory per config type, so a
  // running `storybook dev` and a deploy build never overwrite each other.
  const dir = app(`node_modules/.cache/orz-toolbar/${configType}`);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "island.css"), islandCss());
  // The Vite input, so island.tsx itself needs no CSS import that tsc and
  // biome would have to resolve on a fresh clone.
  await writeFile(
    join(dir, "main.js"),
    `import "./island.css";\nexport * from ${JSON.stringify(app(".storybook/toolbar/island.tsx"))};\n`,
  );
  const production = configType === "PRODUCTION";
  await build({
    configFile: false,
    root: dir,
    logLevel: "warn",
    mode: production ? "production" : "development",
    define: {
      "process.env.NODE_ENV": JSON.stringify(
        production ? "production" : "development",
      ),
    },
    plugins: [react(), tailwindcss()],
    resolve: VITE_SHARED,
    build: {
      outDir: join(dir, "dist"),
      emptyOutDir: true,
      minify: production,
      // Storybook wraps each manager entry in an IIFE, so no top-level await.
      target: "es2022",
      lib: {
        entry: join(dir, "main.js"),
        formats: ["es"],
        fileName: () => "island.js",
        cssFileName: "island",
      },
      // React 19 goes into the bundle: the manager's own react is 18.
      rolldownOptions: { external: [] },
    },
  });
  // Library mode leaves the CSS beside the JS, unimported, and Storybook
  // links only the CSS its own esbuild emits; importing both from one entry
  // makes it emit that CSS.
  const entry = join(dir, "entry.js");
  await writeFile(
    entry,
    'import "./dist/island.css";\nimport "./dist/island.js";\n',
  );
  return entry;
}

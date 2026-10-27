import { defaultClientConditions } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Tests run on @orz/ui's source, so a fresh clone needs no build first.
    conditions: ["@orz/source", ...defaultClientConditions],
    // CodeMirror checks extensions, facets and highlight tags by identity; a
    // second copy of any of these makes the editor reject or ignore them.
    dedupe: [
      "react",
      "react-dom",
      "@codemirror/state",
      "@codemirror/view",
      "@codemirror/language",
      "@lezer/highlight",
    ],
  },
  test: {
    // Its own module cache: the default one is shared at the workspace root, and
    // when the lockfile changes every parallel `pnpm -r test` run clears it at
    // once, failing one of them with ENOTEMPTY.
    fsModuleCachePath: "node_modules/.vitest-cache",
    environment: "happy-dom",
    // Exposes afterEach globally so testing-library auto-cleans between
    // tests (otherwise renders leak across cases).
    globals: true,
  },
});

import { defaultClientConditions } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { conditions: ["@orz/source", ...defaultClientConditions] },
  test: {
    // Its own module cache: the default one is shared at the workspace root, and
    // when the lockfile changes every parallel `pnpm -r test` run clears it at
    // once, failing one of them with ENOTEMPTY.
    fsModuleCachePath: "node_modules/.vitest-cache",
    environment: "node",
    // build.test.ts runs two Vite builds of the whole site.
    testTimeout: 300_000,
    hookTimeout: 300_000,
  },
});

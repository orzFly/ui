import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Its own module cache: the default one is shared at the workspace root, and
    // when the lockfile changes every parallel `pnpm -r test` run clears it at
    // once, failing one of them with ENOTEMPTY.
    fsModuleCachePath: "node_modules/.vitest-cache",
    environment: "node",
  },
});

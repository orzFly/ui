import { defaultClientConditions } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Tests run on @orz/query's source, so a fresh clone needs no build first.
    conditions: ["@orz/source", ...defaultClientConditions],
  },
  test: {
    environment: "happy-dom",
    // Exposes afterEach globally so testing-library auto-cleans between
    // tests (otherwise renders leak across cases).
    globals: true,
  },
});

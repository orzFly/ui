import { defineConfig } from "vitest/config";

export default defineConfig({
  // Tests run on @orz/ui's source, so a fresh clone needs no build first.
  resolve: { conditions: ["@orz/source"] },
  test: {
    environment: "happy-dom",
    // Exposes afterEach globally so testing-library auto-cleans between
    // tests (otherwise renders leak across cases).
    globals: true,
  },
});

import { defaultClientConditions } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { conditions: ["@orz/source", ...defaultClientConditions] },
  // build.test.ts runs two Vite builds of the whole site.
  test: { environment: "node", testTimeout: 300_000, hookTimeout: 300_000 },
});

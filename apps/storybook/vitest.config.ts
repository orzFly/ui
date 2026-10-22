import { defaultClientConditions } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The codec's tests run on the workspace packages' source, as the stories do.
  resolve: { conditions: ["@orz/source", ...defaultClientConditions] },
  test: { environment: "node" },
});

import mdx from "@mdx-js/rollup";
import remarkGfm from "remark-gfm";
import { defaultClientConditions } from "vite";
import { defineConfig } from "vitest/config";
import { docsPlugins } from "./scripts/plugins.ts";
import { remarkHeadings } from "./scripts/remark-headings.ts";

export default defineConfig({
  resolve: { conditions: ["@orz/source", ...defaultClientConditions] },
  plugins: [
    ...docsPlugins(),
    // A page renders in a test as it does in the site: home.test.tsx renders index.mdx.
    {
      enforce: "pre",
      ...mdx({ mdExtensions: [], remarkPlugins: [remarkGfm, remarkHeadings] }),
    },
    {
      name: "uncached-glob",
      // Vitest keys a cached module on its own source, so a module whose
      // import.meta.glob expands to a file list keeps the old list after a file
      // is added. It skips such a module only when the source spells
      // `import.meta.glob(`, which a type argument (`glob<string>(`) defeats.
      configureVitest({ defineCacheKeyGenerator }) {
        defineCacheKeyGenerator(({ sourceCode }) =>
          /\bimport\.meta\.glob\b/.test(sourceCode) ? false : undefined,
        );
      },
    },
  ],
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

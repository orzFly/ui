import mdx from "@mdx-js/rollup";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import remarkGfm from "remark-gfm";
import {
  defaultClientConditions,
  defaultServerConditions,
  defineConfig,
} from "vite";
import { docsPlugins } from "./scripts/plugins.ts";
import { remarkHeadings } from "./scripts/remark-headings.ts";

export default defineConfig({
  // GitHub Pages serves the site under /ui/; everywhere else it sits at /.
  base: process.env.DOCS_BASE ?? "/",
  plugins: [
    ...docsPlugins(),
    {
      enforce: "pre",
      ...mdx({ remarkPlugins: [remarkGfm, remarkHeadings] }),
    },
    react({ include: /\.(mdx|tsx?)$/ }),
    tailwindcss(),
  ],
  resolve: {
    // The site runs on the packages' source, as Storybook does, so it needs
    // no watch build of them.
    conditions: ["@orz/source", ...defaultClientConditions],
    // Source files resolve their peers from their own package's
    // node_modules; a second React or radix-ui would split module state.
    dedupe: [
      "react",
      "react-dom",
      "radix-ui",
      "sonner",
      "lucide-react",
      "@pierre/diffs",
    ],
  },
  // shiki's larger grammars (C++, Emacs Lisp) pass 500 kB; each is its own
  // chunk, fetched only for a block in that language.
  build: { chunkSizeWarningLimit: 1000 },
  // The prerender renders the same source the browser runs.
  ssr: {
    resolve: { conditions: ["@orz/source", ...defaultServerConditions] },
  },
});

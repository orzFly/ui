import { ansiContent, logContent } from "@orz/ui-ansi";
import { codeContent } from "@orz/ui-code";
import { Markdown } from "@orz/ui-markdown";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withRenderers, withWidth } from "./decorators.tsx";
import { registrationSnippet } from "./snippets.ts";

const ANSI_FENCE = `The \`ansi\` fence draws its escapes; the \`sh\` fence below it goes on to the code renderer.

\`\`\`ansi
\x1b[1m$ pnpm test\x1b[0m
\x1b[32m✓\x1b[0m parse \x1b[2m(173 tests)\x1b[22m
\x1b[32m✓\x1b[0m view \x1b[2m(64 tests)\x1b[22m
\x1b[31m✗\x1b[0m content \x1b[2m(1 failed)\x1b[22m
Tests: \x1b[32m237 passed\x1b[0m, \x1b[31m1 failed\x1b[0m
\`\`\`

\`\`\`sh
pnpm test
\`\`\`
`;

const LOG_FENCE = `The \`log\` fence is coloured by level; a fence has no level filter or search box.

\`\`\`log
2026-10-23 09:14:02.118 INFO  [main] c.e.app.Server - Starting server on port 8080
2026-10-23 09:14:02.240 DEBUG [main] c.e.app.Config - loaded 42 keys from config.yaml
2026-10-23 09:14:03.007 WARN  [pool-1] c.e.db.Pool - connection slow: 812 ms to db.example
2026-10-23 09:14:04.101 ERROR [req-81] c.e.api.Handler - request failed: GET /api/items/7
java.lang.IllegalStateException: item 7 has no owner
\tat com.example.api.Handler.load(Handler.java:88)
\t... 23 more
Done in 3.2s.
\`\`\`
`;

/** `@orz/ui-ansi`'s renderers, registered with `@orz/ui-content`. */
const meta = {
  title: "ui-ansi/Content",
  decorators: [withWidth("max-w-3xl")],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * An `ansi` fence in `<Markdown>`, drawn by registering `@orz/ui-ansi`'s `ansiContent` before
 * `codeContent`, which takes every other fence.
 */
export const Ansi: Story = {
  render: () => <Markdown>{ANSI_FENCE}</Markdown>,
  decorators: [withRenderers(ansiContent, codeContent)],
  parameters: {
    docs: {
      source: {
        code: registrationSnippet({
          renderers: [
            ["@orz/ui-ansi", "ansiContent"],
            ["@orz/ui-code", "codeContent"],
          ],
          uses: [["@orz/ui-markdown", "Markdown"]],
          body: "<Markdown>{source}</Markdown>",
        }),
        language: "tsx",
      },
    },
  },
};

/**
 * A `log` fence in `<Markdown>`, drawn by registering `@orz/ui-ansi`'s `logContent` before
 * `codeContent`, which would otherwise draw it with its `log` grammar.
 */
export const Log: Story = {
  render: () => <Markdown>{LOG_FENCE}</Markdown>,
  decorators: [withRenderers(logContent, ansiContent, codeContent)],
  parameters: {
    docs: {
      source: {
        code: registrationSnippet({
          renderers: [
            ["@orz/ui-ansi", "logContent"],
            ["@orz/ui-ansi", "ansiContent"],
            ["@orz/ui-code", "codeContent"],
          ],
          uses: [["@orz/ui-markdown", "Markdown"]],
          body: "<Markdown>{source}</Markdown>",
        }),
        language: "tsx",
      },
    },
  },
};

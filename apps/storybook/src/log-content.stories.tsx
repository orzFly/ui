import { ansiContent, logContent } from "@orz/ui-ansi";
import { codeContent } from "@orz/ui-code";
import { ContentRenderers } from "@orz/ui-content";
import { Markdown } from "@orz/ui-markdown";
import type { Meta, StoryObj } from "@storybook/react-vite";

const SAMPLE = `The \`log\` fence is coloured by level; a fence has no level filter or search box.

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

const RENDERERS = [logContent, ansiContent, codeContent];

function FencesDemo({ source }: { source: string }) {
  return (
    <ContentRenderers renderers={RENDERERS}>
      <div className="max-w-3xl">
        <Markdown>{source}</Markdown>
      </div>
    </ContentRenderers>
  );
}

/**
 * A `log` fence in `<Markdown>`, drawn by registering `@orz/ui-ansi`'s `logContent` before
 * `codeContent`, which would otherwise draw it with its `log` grammar.
 */
const meta = {
  title: "ui-ansi/Log in markdown",
  component: FencesDemo,
  args: { source: SAMPLE },
} satisfies Meta<typeof FencesDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LogFence: Story = { name: "log fence" };

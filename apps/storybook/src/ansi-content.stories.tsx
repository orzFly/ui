import { ansiContent } from "@orz/ui-ansi";
import { codeContent } from "@orz/ui-code";
import { ContentRenderers } from "@orz/ui-content";
import { Markdown } from "@orz/ui-markdown";
import type { Meta, StoryObj } from "@storybook/react-vite";

const SAMPLE = `The \`ansi\` fence draws its escapes; the \`sh\` fence below it goes on to the code renderer.

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

const RENDERERS = [ansiContent, codeContent];

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
 * An `ansi` fence in `<Markdown>`, drawn by registering `@orz/ui-ansi`'s `ansiContent` before
 * `codeContent`, which takes every other fence.
 */
const meta = {
  title: "ui-ansi/In markdown",
  component: FencesDemo,
  args: { source: SAMPLE },
} satisfies Meta<typeof FencesDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AnsiFence: Story = { name: "ansi fence" };

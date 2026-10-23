import { codeContent } from "@orz/ui-code";
import { Content, type ContentSource } from "@orz/ui-content";
import { Markdown } from "@orz/ui-markdown";
import { mermaidContent } from "@orz/ui-mermaid";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withRenderers, withWidth } from "./decorators.tsx";
import { registrationSnippet } from "./snippets.ts";

const DOCUMENT = `## Release flow

A fenced block tagged \`mermaid\` is drawn as its diagram:

\`\`\`mermaid
flowchart LR
  draft[Draft] --> review[Review] --> merge[Merge] --> ship[Ship]
  review -- changes --> draft
\`\`\`

Any other fence stays code:

\`\`\`ts
const steps = ["draft", "review", "merge", "ship"];
\`\`\`
`;

const FILE: ContentSource = {
  kind: "file",
  name: "pipeline.mmd",
  load: async () => `flowchart TD
  push[git push] --> ci[CI]
  ci --> build[Build] & test[Test]
  build --> deploy[Deploy]
  test --> deploy`,
};

/** `@orz/ui-mermaid`'s renderer, registered with `@orz/ui-content`. */
const meta = {
  title: "ui-mermaid/Content",
  decorators: [withWidth("max-w-3xl")],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A ```` ```mermaid ```` fence inside `<Markdown>`, with `mermaidContent` registered, then an
 * in-memory `.mmd` file in `"viewer"` placement.
 */
export const Mermaid: Story = {
  render: () => (
    <>
      <Markdown>{DOCUMENT}</Markdown>
      <Content source={FILE} placement="viewer" />
    </>
  ),
  decorators: [withRenderers(mermaidContent, codeContent)],
  parameters: {
    docs: {
      source: {
        code: registrationSnippet({
          renderers: [
            ["@orz/ui-mermaid", "mermaidContent"],
            ["@orz/ui-code", "codeContent"],
          ],
          uses: [
            ["@orz/ui-markdown", "Markdown"],
            ["@orz/ui-content", "Content"],
          ],
          body: '<Markdown>{source}</Markdown>\n<Content source={file} placement="viewer" />',
        }),
        language: "tsx",
      },
    },
  },
};

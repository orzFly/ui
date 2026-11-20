import { codeContent } from "@orz/ui-code";
import { ContentRenderers } from "@orz/ui-content";
import { Markdown } from "@orz/ui-markdown";

const RENDERERS = [codeContent];

const STEPS = Array.from(
  { length: 36 },
  (_, i) => `  - run: pnpm --filter step-${i + 1} test`,
).join("\n");

const DOC = `Start the stack with the compose file:

\`\`\`yaml compose.yaml
services:
  web:
    image: nginx:1.27
    ports:
      - "8080:80"
\`\`\`

Then run the tests:

\`\`\`sh
pnpm install && pnpm test
\`\`\`

The whole pipeline, for reference:

\`\`\`yaml
steps:
${STEPS}
\`\`\`
`;

export function FramedFences() {
  return (
    <ContentRenderers renderers={RENDERERS}>
      <Markdown>{DOC}</Markdown>
    </ContentRenderers>
  );
}

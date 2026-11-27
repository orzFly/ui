import { textFile } from "@orz/fixtures/files.ts";
import seriesText from "@orz/fixtures/patch/series.patch?raw";
import { ATTACHMENT_RENDERERS } from "@orz/fixtures/renderers.ts";
import { ContentRenderers } from "@orz/ui-content";
import { AttachmentViewerProvider } from "@orz/ui-content/attachment";
import { Markdown, markdownEmbeds } from "@orz/ui-markdown";

const STEPS = Array.from(
  { length: 36 },
  (_, i) => `  - run: pnpm --filter step-${i + 1} test`,
).join("\n");

const CHECKS = [
  "The tag points at the commit the release notes name.",
  "Every package's version matches the tag.",
  "The snapshot from the same commit installed cleanly.",
  "The changelog lists every card shipped since the last tag.",
  "The docs site built from the same commit.",
  "Nobody has a deploy running.",
];

const RUNBOOK = `# Release runbook

## Before the tag

${CHECKS.map((check) => `- ${check}`).join("\n")}

## Tagging

Set the version on every package in one commit, merge it as any other, then push a tag named
after the version to the public mirror. The workflow refuses a tag that does not match.

## After the tag

${CHECKS.map((check) => `- ${check.replace(/\.$/, "")}, again.`).join("\n")}

## When it goes wrong

A failed publish leaves the tag in place. Fix the cause on master, set the next patch version,
and tag again; never move a tag that has been pushed.
`;

const FILES = {
  "runbook.md": textFile("runbook.md", "text/markdown", RUNBOOK),
};

const PLUGINS = [
  markdownEmbeds({
    resolve: (href) => FILES[href as keyof typeof FILES] ?? null,
  }),
];

const DOC = `The pipeline now runs every step's tests:

\`\`\`yaml ci.yaml
steps:
${STEPS}
\`\`\`

The series that changed the fetch task:

\`\`\`patch
${seriesText.trimEnd()}
\`\`\`

And the runbook the release follows:

![runbook](runbook.md)
`;

export function LongBlocks() {
  return (
    <ContentRenderers renderers={ATTACHMENT_RENDERERS}>
      <AttachmentViewerProvider>
        <Markdown plugins={PLUGINS}>{DOC}</Markdown>
      </AttachmentViewerProvider>
    </ContentRenderers>
  );
}

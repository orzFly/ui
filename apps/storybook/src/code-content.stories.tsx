import { PLAIN_DIFF } from "@orz/fixtures/files.ts";
import { codeContent, patchContent } from "@orz/ui-code";
import { Markdown } from "@orz/ui-markdown";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withRenderers, withWidth } from "./decorators.tsx";
import { registrationSnippet } from "./snippets.ts";

const SAMPLE = `## Fetching a task

The client wraps \`fetch\` and keeps the task's shape typed:

\`\`\`ts
export interface Task {
  id: number;
  title: string;
  done: boolean;
}

export async function fetchTask(id: number): Promise<Task> {
  const res = await fetch(\`/api/tasks/\${id}\`);
  if (!res.ok) throw new Error(\`task \${id}: \${res.status}\`);
  return res.json();
}
\`\`\`

A component that shows one:

\`\`\`tsx
export function TaskTitle({ task }: { task: Task }) {
  return <span className={task.done ? "line-through" : undefined}>{task.title}</span>;
}
\`\`\`

The same call from a script:

\`\`\`python
def fetch_task(task_id: int) -> dict:
    # 取一张卡片，失败时抛出异常。
    res = requests.get(f"https://app.example/api/tasks/{task_id}")
    res.raise_for_status()
    return res.json()
\`\`\`

\`\`\`json
{ "id": 7, "title": "Write the parser", "done": true }
\`\`\`

\`\`\`sh
pnpm install && pnpm test
\`\`\`

A tag pierre does not know, and a fence with no tag, are plain text:

\`\`\`zzz
An unknown tag falls back to plain text.
\`\`\`

\`\`\`
No tag at all.
\`\`\`
`;

const PATCH_FENCES = `A fence tagged \`diff\` holding a patch is drawn as its files, in a frame with the controls:

\`\`\`diff
${PLAIN_DIFF}\`\`\`

A bare +/- snippet is not a patch, and stays highlighted text without a complaint:

\`\`\`diff
-const PAUSE_MS = 250;
+const PAUSE_MS = 500;
\`\`\`
`;

/**
 * `@orz/ui-code`'s renderers, registered with `@orz/ui-content`. Neither `@orz/ui-markdown` nor
 * `@orz/ui-code` imports the other; the registry connects them.
 */
const meta = {
  title: "ui-code/Content",
  decorators: [withWidth("max-w-3xl")],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Fenced code in `<Markdown>`, highlighted in the toolbar's theme by `codeContent`. */
export const Code: Story = {
  render: () => <Markdown>{SAMPLE}</Markdown>,
  decorators: [withRenderers(codeContent)],
  parameters: {
    docs: {
      source: {
        code: registrationSnippet({
          renderers: [["@orz/ui-code", "codeContent"]],
          uses: [["@orz/ui-markdown", "Markdown"]],
          body: "<Markdown>{source}</Markdown>",
        }),
        language: "tsx",
      },
    },
  },
};

/**
 * `patchContent` draws a unified diff, from a ```` ```diff ```` / ```` ```patch ```` fence or a
 * `.patch` / `.diff` file, as one diff per file under each commit's subject and message, with a
 * file list and a *raw* toggle back to the text as written.
 */
export const Patch: Story = {
  render: () => <Markdown>{PATCH_FENCES}</Markdown>,
  decorators: [withRenderers(patchContent, codeContent)],
  parameters: {
    docs: {
      source: {
        code: registrationSnippet({
          renderers: [
            ["@orz/ui-code", "patchContent"],
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

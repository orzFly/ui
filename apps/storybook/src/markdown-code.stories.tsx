import { codeContent } from "@orz/ui-code";
import { ContentRenderers } from "@orz/ui-content";
import { Markdown } from "@orz/ui-markdown";
import type { Meta, StoryObj } from "@storybook/react-vite";

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

const RENDERERS = [codeContent];

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
 * Fenced code in `<Markdown>`, highlighted by registering `@orz/ui-code`'s `codeContent`. Neither
 * package imports the other; the registry connects them.
 */
const meta = {
  title: "Markdown/Code fences",
  component: FencesDemo,
  args: { source: SAMPLE },
} satisfies Meta<typeof FencesDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Follows the toolbar's theme. */
export const Highlighted: Story = {};

/** A theme whose syntax colours come from the matching shiki theme. */
export const GithubLight: Story = {
  name: "GitHub Light",
  globals: { theme: "github_light" },
};

export const SolarizedDark: Story = { globals: { theme: "solarized_dark" } };

export const Dracula: Story = { globals: { theme: "dracula_dark" } };

/** A theme with no syntax counterpart: pierre's own token colours over the theme's background. */
export const PicoLight: Story = { globals: { theme: "picotera_light" } };

/** With no code renderer registered, every fence is the registry's plain `<pre><code>`. */
export const WithoutCodeContent: Story = {
  render: ({ source }) => (
    <div className="max-w-3xl">
      <Markdown>{source}</Markdown>
    </div>
  ),
};

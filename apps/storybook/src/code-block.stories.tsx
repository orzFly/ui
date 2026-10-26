import {
  CodeBlock,
  CodeWorkerProvider as CodeWorkerProviderView,
  fenceFilename,
} from "@orz/ui-code";
import PierreWorker from "@pierre/diffs/worker/worker.js?worker";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withWidth } from "./decorators.tsx";

const SNIPPET = `/** 取消当前操作，返回上一层。 */
export function cancel(reason?: string): void {
  console.info("cancelled", reason ?? "没有原因");
}`;

const WHOLE_FILE = `import { createStore } from "./store.ts";

export interface Task {
  id: number;
  title: string;
  done: boolean;
}

type Filter = "all" | "open" | "done";

const tasks = createStore<Task[]>([]);

export function addTask(title: string): Task {
  const task = { id: Date.now(), title, done: false };
  tasks.update((list) => [...list, task]);
  return task;
}

export function toggle(id: number): void {
  tasks.update((list) =>
    list.map((task) => (task.id === id ? { ...task, done: !task.done } : task)),
  );
}

export function visible(filter: Filter): Task[] {
  const list = tasks.get();
  switch (filter) {
    case "open":
      return list.filter((task) => !task.done);
    case "done":
      return list.filter((task) => task.done);
    default:
      return list;
  }
}

export function clearDone(): number {
  const before = tasks.get().length;
  tasks.update((list) => list.filter((task) => !task.done));
  return before - tasks.get().length;
}
`;

const FENCES = [
  {
    tag: "python",
    code: 'def greet(name: str) -> str:\n    return f"hello, {name}"',
  },
  { tag: "rust", code: 'fn main() {\n    println!("hello, world");\n}' },
  { tag: "shell", code: "pnpm install && pnpm test" },
  { tag: "zzz", code: "An unknown tag falls back to plain text." },
];

// About 1 MB of code: enough that tokenizing it on the main thread holds the tab for seconds.
const LONG_FILE = Array.from({ length: 900 }, (_, i) =>
  WHOLE_FILE.replaceAll("Task", `Task${i}`),
).join("\n");

const newPierreWorker = () => new PierreWorker();

const WORKER_SNIPPET = `import { CodeBlock, CodeWorkerProvider } from "@orz/ui-code";
// Vite's worker import; another bundler starts @pierre/diffs/worker/worker.js its own way.
import PierreWorker from "@pierre/diffs/worker/worker.js?worker";

// Once, at the app's root: codeContent's files tokenize off the main thread below it.
<CodeWorkerProvider workerFactory={() => new PierreWorker()}>
  {/* A CodeBlock asks for it with offThread, and caps its height: it virtualizes against its box. */}
  <CodeBlock filename="tasks.ts" contents={text} lineNumbers offThread className="max-h-96 overflow-auto" />
</CodeWorkerProvider>`;

const meta = {
  title: "ui-code/CodeBlock",
  component: CodeBlock,
  args: { filename: "snippet.ts", contents: SNIPPET },
} satisfies Meta<typeof CodeBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const LineNumbers: Story = {
  args: { filename: "tasks.ts", contents: WHOLE_FILE, lineNumbers: true },
};

export const FenceTags: Story = {
  decorators: [withWidth("max-w-xl")],
  render: (args) => (
    <div className="grid gap-4">
      {FENCES.map(({ tag, code }) => (
        <div key={tag} className="grid gap-1">
          <p className="text-muted-foreground text-sm">
            <code>{tag}</code> → <code>{fenceFilename(tag)}</code>
          </p>
          <CodeBlock {...args} filename={fenceFilename(tag)} contents={code} />
        </div>
      ))}
    </div>
  ),
};

/**
 * Without the provider, these lines would hold the tab while they tokenize; with it, they show at
 * once and their colours follow.
 */
export const CodeWorkerProvider: Story = {
  args: {
    filename: "tasks.ts",
    contents: LONG_FILE,
    lineNumbers: true,
    offThread: true,
    className: "max-h-96 overflow-auto",
  },
  render: (args) => (
    <CodeWorkerProviderView workerFactory={newPierreWorker}>
      <CodeBlock {...args} />
    </CodeWorkerProviderView>
  ),
  parameters: { docs: { source: { code: WORKER_SNIPPET, language: "tsx" } } },
};

export const Empty: Story = {
  tags: ["edge", "!autodocs"],
  args: { filename: "empty.txt", contents: "" },
};

import { CodeBlock, fenceFilename } from "@orz/ui-code";
import type { Meta, StoryObj } from "@storybook/react-vite";

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

const meta = {
  title: "ui-code/CodeBlock",
  component: CodeBlock,
  args: { filename: "snippet.ts", contents: SNIPPET },
} satisfies Meta<typeof CodeBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Snippet: Story = {};

export const WholeFile: Story = {
  args: { filename: "tasks.ts", contents: WHOLE_FILE, lineNumbers: true },
};

export const FenceTags: Story = {
  render: () => (
    <div className="grid max-w-xl gap-4">
      {FENCES.map(({ tag, code }) => (
        <div key={tag} className="grid gap-1">
          <p className="text-muted-foreground text-sm">
            <code>{tag}</code> → <code>{fenceFilename(tag)}</code>
          </p>
          <CodeBlock filename={fenceFilename(tag)} contents={code} />
        </div>
      ))}
    </div>
  ),
};

export const Empty: Story = {
  args: { filename: "empty.txt", contents: "" },
};

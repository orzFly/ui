import { CodeDiffBlock } from "@orz/ui-code";
import type { Meta, StoryObj } from "@storybook/react-vite";

const BEFORE = `export function retry<T>(
  run: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  return run().catch((error: unknown) => {
    if (attempts <= 1) throw error;
    return wait(250).then(() => retry(run, attempts - 1));
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function once<T>(run: () => T): () => T {
  let done = false;
  let value: T;
  return () => (done ? value : ((done = true), (value = run())));
}`;

const ONE_LINE_EDIT = BEFORE.replace("wait(250)", "wait(500)");

const REWRITE = BEFORE.replace(
  `  return run().catch((error: unknown) => {
    if (attempts <= 1) throw error;
    return wait(250).then(() => retry(run, attempts - 1));
  });`,
  `  // 每次失败后等待时间翻倍。
  const delay = 250 * 2 ** (3 - attempts);
  return run().catch(async (error: unknown) => {
    if (attempts <= 1) throw error;
    await wait(delay);
    return retry(run, attempts - 1);
  });`,
);

const meta = {
  title: "ui-code/CodeDiffBlock",
  component: CodeDiffBlock,
  args: { filename: "retry.ts", before: BEFORE, after: ONE_LINE_EDIT },
} satisfies Meta<typeof CodeDiffBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Rewrite: Story = {
  args: { after: REWRITE },
};

export const Identical: Story = {
  tags: ["edge", "!autodocs"],
  args: { after: BEFORE },
};

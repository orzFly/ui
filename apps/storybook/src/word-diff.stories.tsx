import { Label } from "@orz/ui/components/label";
import { Textarea } from "@orz/ui/components/textarea";
import {
  coalescedWordDiff,
  type WordDiffResult,
  wordDiff,
} from "@orz/ui-code/word-diff";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useState } from "react";

/** The new text with insertions marked, and each deletion quoted from the old text at its caret. */
function Marked({
  oldText,
  newText,
  result,
}: {
  oldText: string;
  newText: string;
  result: WordDiffResult;
}) {
  const parts: ReactNode[] = [];
  const dels = [...result.del];
  const inss = [...result.ins];
  let pos = 0;
  while (dels.length > 0 || inss.length > 0) {
    const at = Math.min(
      dels[0]?.at ?? Number.POSITIVE_INFINITY,
      inss[0]?.start ?? Number.POSITIVE_INFINITY,
    );
    if (at > pos) {
      parts.push(newText.slice(pos, at));
      pos = at;
    }
    const gone = dels[0]?.at === at ? dels.shift() : undefined;
    if (gone !== undefined) {
      parts.push(
        <del key={`del-${gone.from}`} className="bg-(--diff-deletion)/20">
          {oldText.slice(gone.from, gone.to)}
        </del>,
      );
    }
    const born = inss[0]?.start === at ? inss.shift() : undefined;
    if (born !== undefined) {
      parts.push(
        <ins
          key={`ins-${born.start}`}
          className="bg-(--diff-addition)/20 no-underline"
        >
          {newText.slice(born.start, born.end)}
        </ins>,
      );
      pos = born.end;
    }
  }
  if (pos < newText.length) parts.push(newText.slice(pos));
  return <p className="whitespace-pre-wrap leading-relaxed">{parts}</p>;
}

function WordDiffDemo(props: { before: string; after: string }) {
  const [before, setBefore] = useState(props.before);
  const [after, setAfter] = useState(props.after);
  return (
    <div className="grid max-w-2xl gap-4">
      <div className="grid gap-2">
        <Label htmlFor="word-diff-before">Before</Label>
        <Textarea
          id="word-diff-before"
          value={before}
          onChange={(event) => setBefore(event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="word-diff-after">After</Label>
        <Textarea
          id="word-diff-after"
          value={after}
          onChange={(event) => setAfter(event.target.value)}
        />
      </div>
      <section className="grid gap-1">
        <h3 className="font-medium text-sm">wordDiff</h3>
        <Marked
          oldText={before}
          newText={after}
          result={wordDiff(before, after)}
        />
      </section>
      <section className="grid gap-1">
        <h3 className="font-medium text-sm">coalescedWordDiff</h3>
        <Marked
          oldText={before}
          newText={after}
          result={coalescedWordDiff(before, after)}
        />
      </section>
    </div>
  );
}

const meta = {
  title: "Code/Word diff",
  component: WordDiffDemo,
  // The args only seed the textareas, so a Controls edit has to remount them.
  render: (args) => (
    <WordDiffDemo key={`${args.before}\u0000${args.after}`} {...args} />
  ),
} satisfies Meta<typeof WordDiffDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Cjk: Story = {
  args: {
    before: "这一版先修复登录问题，下周再发布第二版。",
    after: "这一版先修复登录问题，下周再发布第三版。",
  },
};

export const HeavyRewrite: Story = {
  args: {
    before:
      "parser.ts 手写了一个递归下降解析器（不支持注释，也不引依赖），format() 改用它输出。表格的列宽从「经常错位」变成对齐可读——这是这次改动的目的。",
    after:
      "引入一个成熟的解析库（支持注释、容错恢复，无 native 依赖），format() 的 padding 改按它计算。注释、空行和长字符串都由库处理，比手写解析器可靠。表格的列宽从「经常错位」变成对齐可读——这是这次改动的目的。",
  },
};

export const SmallEdit: Story = {
  args: {
    before: "The quick brown fox jumps over the lazy dog.",
    after: "The quick red fox leaps over the lazy dog.",
  },
};

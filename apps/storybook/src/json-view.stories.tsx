import requestText from "@orz/fixtures/json/agent-request.json?raw";
import requestJson5 from "@orz/fixtures/json/agent-request.json5?raw";
import {
  deepNesting,
  hugeString,
  largeArray,
} from "@orz/fixtures/json/large.ts";
import { agentTraceSummary, JsonView, parseJson } from "@orz/ui-json";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { argsUpdater } from "./args.ts";
import { withHeight, withWidth } from "./decorators.tsx";

const REQUEST = JSON.parse(requestText) as Record<string, unknown>;
// The Playground's value, short enough that Show code stays readable.
const SAMPLE = {
  model: REQUEST.model,
  stream: REQUEST.stream,
  max_tokens: REQUEST.max_tokens,
  temperature: REQUEST.temperature,
  messages: REQUEST.messages,
  metadata: REQUEST.metadata,
};

const PARSED = parseJson(requestJson5, { dialect: "json5" });
const DOCUMENT = PARSED.ok ? PARSED.document : { value: null };

const JSON5_COMMENTS = `import { JsonView, parseJson } from "@orz/ui-json";

const parsed = parseJson(text, { dialect: "json5" });

{parsed.ok && <JsonView document={parsed.document} />}`;

/** picotera's Chinese strings, as an app that speaks Chinese passes them. */
const CHINESE = {
  toolbar: "文档",
  collapseAll: "折叠全部",
  expandAll: "展开全部",
  copyDocument: "复制全部 JSON",
  wrap: "软换行",
  inspectDocument: "单独查看",
  search: "搜索键名或值…",
  matches: (n: number) => `${n} 命中`,
  items: (n: number) => `[${n} 项]`,
  chars: (n: string) => `${n} 字符`,
  rowActions: (path: string) => `${path} 的操作`,
  copy: "复制",
  copyAsJson: "复制为 JSON",
  copyCompact: "复制为紧凑 JSON",
  copySource: "复制原文",
  copyPath: "复制路径",
  copyKey: "复制键名",
  inspect: "单独查看",
  expandSubtree: "展开子树",
  collapseSubtree: "折叠子树",
  selectMembers: "选择多项…",
  copyMembers: (n: number) => `复制 ${n} 项`,
  copied: "已复制",
  copiedValue: "已复制",
  copiedJson: "已复制 JSON",
  copiedSource: "已复制原文",
  copiedPath: "已复制路径",
  copiedKey: "已复制键名",
  copiedMembers: (n: number) => `已复制 ${n} 项`,
  cannotSerialise: "无法序列化",
  rowBudget: (limit: string) =>
    `已达 ${limit} 行上限，其余节点未列出 — 折叠部分节点后再展开。`,
  expandBudget: "部分子树过深未展开，避免一次渲染过多节点。",
  searchBudget: "搜索未扫描完整文档，可能还有未列出的命中。",
  dismiss: "知道了",
  inspectTitle: "单独查看",
  close: "关闭",
  download: "下载",
  parseAsJson: "解析为 JSON",
  showText: "查看原文",
  notJson: "不是合法的 JSON",
};

const meta = {
  title: "ui-json/JsonView",
  component: JsonView,
  parameters: { guidelines: "/guidelines/patterns/code-blocks/" },
  args: {
    value: SAMPLE,
    maxHeight: 480,
    fill: false,
    inspectRoot: true,
    defaultWrap: false,
  },
  argTypes: {
    value: { control: "object" },
    document: { control: false },
    summary: { control: false },
    labels: { control: false },
    selection: { control: "object" },
  },
  decorators: [withWidth("max-w-3xl")],
} satisfies Meta<typeof JsonView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/**
 * A JSON5 document through `parseJson`: its comments are rows of their own, before the member
 * they belong to or after a container's last child, and a comment after a value trails its row.
 * Numbers and strings show as written (`0x2000`, `+2`).
 */
export const Json5Comments: Story = {
  args: { document: DOCUMENT, value: undefined },
  parameters: {
    docs: { source: { code: JSON5_COMMENTS, language: "tsx" } },
  },
};

/**
 * A controlled selection. Click a key, a value or a row's gutter, Shift+click or drag for a range
 * of siblings; the `selection` control follows, and editing it moves the selection.
 */
export const Selection: Story = {
  args: {
    selection: { type: "members", anchor: "$.stream", focus: "$.temperature" },
    onSelectionChange: fn(),
  },
  render: function Render(args, context) {
    const updateArgs = argsUpdater(context);
    return (
      <JsonView
        {...args}
        onSelectionChange={(selection) => {
          updateArgs({ selection });
          args.onSelectionChange?.(selection);
        }}
      />
    );
  },
};

/** Soft wrap: strings wrap within the view, and a preview is cut at 1000 characters, not 160. */
export const Wrap: Story = {
  args: { value: REQUEST, wrap: true, onWrapChange: fn() },
  render: function Render(args, context) {
    const updateArgs = argsUpdater(context);
    return (
      <JsonView
        {...args}
        onWrapChange={(wrap) => {
          updateArgs({ wrap });
          args.onWrapChange?.(wrap);
        }}
      />
    );
  },
};

/**
 * `agentTraceSummary` reads a collapsed message or tool call in an LLM request: `user "List the
 * files…"`, `Bash(command="ls -la")`.
 */
export const AgentTraceSummary: Story = {
  args: { value: REQUEST, summary: agentTraceSummary },
};

/** Every string through `labels`: here picotera's Chinese. */
export const Labels: Story = {
  args: { value: REQUEST, summary: agentTraceSummary, labels: CHINESE },
};

/** With `fill` the view takes its parent's height. */
export const Fill: Story = {
  args: { value: REQUEST, fill: true },
  decorators: [withHeight(320)],
};

/** More rows than the row budget once expanded: Expand all stops, and says so. */
export const LargeDocument: Story = {
  tags: ["edge", "!autodocs"],
  args: { value: largeArray() },
};

/** 5000 levels deep: every walk runs on its own stack, so Expand all reaches the bottom. */
export const DeepNesting: Story = {
  tags: ["edge", "!autodocs"],
  args: { value: deepNesting() },
};

/** One 5 MB string: its row is cut from a bounded slice, and Inspect windows the whole text. */
export const HugeString: Story = {
  tags: ["edge", "!autodocs"],
  args: { value: hugeString() },
};

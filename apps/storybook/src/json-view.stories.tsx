import serviceToml from "@orz/fixtures/config/service.toml?raw";
import requestText from "@orz/fixtures/json/agent-request.json?raw";
import requestJson5 from "@orz/fixtures/json/agent-request.json5?raw";
import {
  deepNesting,
  hugeString,
  largeArray,
} from "@orz/fixtures/json/large.ts";
import manifestsYaml from "@orz/fixtures/yaml/manifests.yaml?raw";
import pipelineYaml from "@orz/fixtures/yaml/pipeline.yaml?raw";
import { agentTraceSummary, JsonView, parseJson } from "@orz/ui-json";
import { parseToml } from "@orz/ui-json/toml";
import { parseYaml } from "@orz/ui-json/yaml";
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

const yamlDocument = (text: string) => {
  const parsed = parseYaml(text);
  return parsed.ok ? parsed.document : { value: null };
};

const YAML = `import { JsonView } from "@orz/ui-json";
import { parseYaml } from "@orz/ui-json/yaml";

const parsed = parseYaml(text);

{parsed.ok && <JsonView document={parsed.document} />}`;

const tomlDocument = (text: string) => {
  const parsed = parseToml(text);
  return parsed.ok ? parsed.document : { value: null };
};

const TOML = `import { JsonView } from "@orz/ui-json";
import { parseToml } from "@orz/ui-json/toml";

const parsed = parseToml(text);

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
  goToAnchor: "跳到锚点",
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
 * A YAML document through `parseYaml`: its `#` comments place as JSON5's do, and its anchors,
 * aliases and tags show before the value as YAML writes them. An alias such as `<<: *defaults`
 * opens onto what it names; its menu's Go to anchor selects the anchor.
 */
export const Yaml: Story = {
  args: { document: yamlDocument(pipelineYaml), value: undefined },
  parameters: {
    docs: { source: { code: YAML, language: "tsx" } },
  },
};

/**
 * A TOML document through `parseToml`: each `[table]` header is the member it names and each
 * `[[array]]` item an item of its array, its `#` comments placed as YAML's are. Numbers keep
 * their text (`0x1F`, `1_500`, `inf`), and dates and times show as written. Copy source on a
 * table written in more than one place copies each place.
 */
export const Toml: Story = {
  args: { document: tomlDocument(serviceToml), value: undefined },
  parameters: {
    docs: { source: { code: TOML, language: "tsx" } },
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

/** A stream of three YAML documents: the root lists them, a row each. */
export const YamlStream: Story = {
  tags: ["edge", "!autodocs"],
  args: { document: yamlDocument(manifestsYaml), value: undefined },
  parameters: {
    docs: { source: { code: YAML, language: "tsx" } },
  },
};

/** An alias inside the node it names holds itself: its row is a leaf, and Expand all stops there. */
export const RecursiveAlias: Story = {
  tags: ["edge", "!autodocs"],
  args: {
    document: yamlDocument(
      "# a list that holds itself\nloop: &loop\n  - first\n  - *loop\nagain: *loop\n",
    ),
    value: undefined,
  },
  parameters: {
    docs: { source: { code: YAML, language: "tsx" } },
  },
};

/** `server` is written in two places with `[logging]` between: Copy source gives both, not `[logging]`. */
export const TomlScatteredTable: Story = {
  tags: ["edge", "!autodocs"],
  args: {
    document: tomlDocument(
      '[server]\nhost = "0.0.0.0"\nport = 8080\n\n[logging]\nlevel = "info"\n\n[server.tls]\nenabled = false\n',
    ),
    value: undefined,
    selection: { type: "value", path: "$.server" },
  },
  parameters: {
    docs: { source: { code: TOML, language: "tsx" } },
  },
};

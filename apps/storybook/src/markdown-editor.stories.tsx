import type {
  Completion as CompletionOption,
  CompletionSource,
} from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import {
  createCommandRegistry,
  type ParsedDraft,
  parseCommandLines,
  type ValueProviders,
} from "@orz/query";
import { MarkdownEditor } from "@orz/ui-codemirror/components/markdown-editor";
import {
  inCodeContext,
  inLiteralContext,
} from "@orz/ui-codemirror/extensions/code-context";
import { completionWith } from "@orz/ui-codemirror/extensions/completion";
import { applyWithSpace } from "@orz/ui-codemirror/extensions/completion-space";
import {
  commandCompletionSource,
  commandDecoration,
} from "@orz/ui-codemirror/extensions/slash-commands";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { fn } from "storybook/test";
import { withWidth } from "./decorators.tsx";

const COMPLETION = `import { completionWith } from "@orz/ui-codemirror/extensions/completion";
import { applyWithSpace } from "@orz/ui-codemirror/extensions/completion-space";

const mentions: CompletionSource = (context) => {
  const match = context.matchBefore(/@\\w*$/);
  if (match === null) return null;
  return { from: match.from, options: logins.map((login) => ({ label: \`@\${login}\`, type: "mention", apply: applyWithSpace(\`@\${login}\`) })) };
};

<MarkdownEditor extensions={[completionWith([mentions]), mentionIcon]} />`;

const TAG_COMPLETION = `import { completionWith } from "@orz/ui-codemirror/extensions/completion";

// tagCompletionSource and snippetFieldKeys come with every completionWith.
<MarkdownEditor extensions={completionWith([])} />`;

const SLASH_COMMANDS = `const registry = createCommandRegistry<Command>([/* close, label, assign, move… */]);
const extensions = [
  completionWith([commandCompletionSource(() => registry, () => providers)]),
  commandDecoration(() => registry, () => providers),
];

<MarkdownEditor
  extensions={extensions}
  onChange={(value) => setParsed(parseCommandLines(value, registry, providers))}
/>`;

const CODE_CONTEXT = `import { syntaxTree } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { inCodeContext, inLiteralContext } from "@orz/ui-codemirror/extensions/code-context";

const report = EditorView.updateListener.of((update) => {
  // Required: MarkdownEditor reconfigures its extensions on every render, which
  // fires this listener, so reporting every update would loop on setContext.
  if (!update.selectionSet && !update.docChanged) return;
  const tree = syntaxTree(update.state);
  const pos = update.state.selection.main.head;
  setContext({ literal: inLiteralContext(tree, pos), code: inCodeContext(tree, pos) });
});

<MarkdownEditor extensions={report} />`;

const CONTEXT_SAMPLE = [
  "Prose, `inline code` and <b>inline html</b>.",
  "",
  "```js",
  "fenced code",
  "```",
  "",
  "<details>",
  "raw HTML block",
  "</details>",
  "",
  "<!-- a comment -->",
  "",
].join("\n");

const meta = {
  title: "ui-codemirror/MarkdownEditor",
  component: MarkdownEditor,
  decorators: [withWidth("max-w-xl")],
  args: {
    ariaLabel: "Comment",
    placeholder: "Write a comment… (Mod-Enter submits, Escape cancels)",
    className: "min-h-32 max-h-80",
    onSubmit: fn(),
    onCancel: fn(),
  },
  argTypes: { extensions: { control: false } },
} satisfies Meta<typeof MarkdownEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: {
    initialValue:
      "# A heading\n\nSome **bold**, some _italic_, a [link](https://example.com) and `code`.\n\n> A quote\n",
  },
};

const PEOPLE = ["alice", "bob"];

const mentions: CompletionSource = (context) => {
  const match = context.matchBefore(/@\w*$/);
  if (match === null) return null;
  const options: CompletionOption[] = PEOPLE.map((login) => ({
    label: `@${login}`,
    type: "mention",
    apply: applyWithSpace(`@${login}`),
  }));
  return { from: match.from, options, validFor: /^@\w*$/ };
};

const mentionIcon = EditorView.theme({
  ".cm-completionIcon-mention::after": {
    content: "'@'",
    color: "var(--primary)",
  },
});

const completion = [completionWith([mentions]), mentionIcon];

/**
 * Type `@` for the stub mention source. An accepted mention leaves a space
 * that punctuation typed next replaces.
 */
export const Completion: Story = {
  args: {
    initialValue: "Thanks ",
    extensions: completion,
  },
  parameters: { docs: { source: { code: COMPLETION, language: "tsx" } } },
};

/**
 * Every `completionWith` carries `tagCompletionSource` and `snippetFieldKeys`.
 * `<det` at the start of a line offers the `<details>` template, Tab moves
 * from Title to Body, and the template never triggers inside code.
 */
export const TagCompletion: Story = {
  args: {
    extensions: completionWith([]),
    placeholder: "Type <det on its own line, then Tab through the fields",
  },
  parameters: { docs: { source: { code: TAG_COMPLETION, language: "tsx" } } },
};

type DemoCommand =
  | { type: "close" }
  | { type: "label"; name: string }
  | { type: "hide_all"; force: boolean }
  | { type: "assign"; logins: readonly string[] }
  | { type: "move"; status: string; assignee?: string };

const providers: ValueProviders = {
  label: { options: [{ value: "bug" }, { value: "docs" }] },
  status: {
    options: [{ value: "Todo" }, { value: "In Progress" }, { value: "Done" }],
  },
  member: {
    options: [
      { value: "alice", hint: "Alice" },
      { value: "bot-one", hint: "a bot" },
      { value: "claude-agent", hint: "an agent" },
    ],
  },
};

const member = { kind: "named", source: "member", special: ["@me"] } as const;

const registry = createCommandRegistry<DemoCommand>([
  {
    name: "close",
    detail: "→ Done",
    args: [],
    summarize: () => "close",
    compile: () => ({ type: "close" }),
  },
  {
    name: "label",
    detail: "add a label",
    args: [
      { name: "label", value: { kind: "named", source: "label" }, rest: true },
    ],
    summarize: ([name]) => `label ${name}`,
    compile: ([name]) => ({ type: "label", name: String(name) }),
  },
  {
    name: "hide-all",
    detail: "hide every comment before this one",
    args: [
      {
        name: "force",
        value: { kind: "enum", values: ["force"] },
        optional: true,
      },
    ],
    summarize: ([force]) =>
      force === undefined ? "hide every comment" : "hide every comment, force",
    compile: ([force]) => ({ type: "hide_all", force: force === "force" }),
  },
  {
    name: "assign",
    detail: "assign people",
    args: [{ name: "login", value: member, multiple: true }],
    summarize: ([logins]) => `assign ${[logins ?? []].flat().join(", ")}`,
    compile: ([logins]) => ({ type: "assign", logins: [logins ?? []].flat() }),
  },
  {
    name: "move",
    detail: "change status, and maybe the assignee",
    args: [
      { name: "status", value: { kind: "named", source: "status" } },
      { name: "assignee", value: member, optional: true },
    ],
    summarize: ([status]) => `move to ${status}`,
    compile: ([status, assignee]) => ({
      type: "move",
      status: String(status),
      ...(assignee === undefined ? {} : { assignee: String(assignee) }),
    }),
  },
]);

const getRegistry = () => registry;
const getProviders = () => providers;
const commands = [
  completionWith([commandCompletionSource(getRegistry, getProviders)]),
  commandDecoration(getRegistry, getProviders),
];

const SLASH_DRAFT = [
  "Shipping this.",
  "/close",
  "/label nope",
  "/assign {alice,bot-one}",
  "/move 'In Progress' @me",
  "",
].join("\n");

/**
 * Type `/` at the start of a line for the command panel. A recognized line is
 * tinted, one whose argument names nothing is underlined, and the parse
 * below is what a submit would see. Arguments are shell words, so
 * `'In Progress'` is one; `/assign {alice,bot-one}` expands to a list
 * because its argument is declared `multiple`, and `/label` takes the rest
 * of the line unquoted.
 */
export const SlashCommands: Story = {
  args: { initialValue: SLASH_DRAFT, extensions: commands },
  parameters: { docs: { source: { code: SLASH_COMMANDS, language: "tsx" } } },
  render: function Render(args) {
    const [parsed, setParsed] = useState<ParsedDraft<DemoCommand>>(() =>
      parseCommandLines(SLASH_DRAFT, registry, providers),
    );
    return (
      <div className="grid gap-3">
        <MarkdownEditor
          {...args}
          onChange={(value) =>
            setParsed(parseCommandLines(value, registry, providers))
          }
        />
        <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      </div>
    );
  },
};

/**
 * Both predicates are true in code and comments. Only `inCodeContext` is also
 * true in raw HTML, which is why mention and command sources use it and tag
 * templates use `inLiteralContext`.
 */
export const CodeContext: Story = {
  args: { initialValue: CONTEXT_SAMPLE },
  parameters: { docs: { source: { code: CODE_CONTEXT, language: "tsx" } } },
  render: function Render(args) {
    const [where, setWhere] = useState<{
      literal: boolean;
      code: boolean;
    } | null>(null);
    const report = useMemo(
      () =>
        EditorView.updateListener.of((update) => {
          // MarkdownEditor reconfigures its extensions on every render, so a
          // listener that reported every update would loop on its own setState.
          if (!update.selectionSet && !update.docChanged) return;
          const tree = syntaxTree(update.state);
          const pos = update.state.selection.main.head;
          setWhere({
            literal: inLiteralContext(tree, pos),
            code: inCodeContext(tree, pos),
          });
        }),
      [],
    );
    return (
      <div className="grid gap-3">
        <MarkdownEditor {...args} extensions={report} />
        <p className="text-muted-foreground text-sm">
          {where === null ? (
            "Move the caret to see where it is."
          ) : (
            <>
              inLiteralContext:{" "}
              <code className="text-foreground">{String(where.literal)}</code>
              {" · "}inCodeContext:{" "}
              <code className="text-foreground">{String(where.code)}</code>
            </>
          )}
        </p>
      </div>
    );
  },
};

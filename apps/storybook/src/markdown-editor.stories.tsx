import type {
  Completion as CompletionOption,
  CompletionSource,
} from "@codemirror/autocomplete";
import { EditorView } from "@codemirror/view";
import {
  createCommandRegistry,
  type ParsedDraft,
  parseCommandLines,
  type ValueProviders,
} from "@orz/query";
import { MarkdownEditor } from "@orz/ui-codemirror/components/markdown-editor";
import { completionWith } from "@orz/ui-codemirror/extensions/completion";
import { applyWithSpace } from "@orz/ui-codemirror/extensions/completion-space";
import {
  commandCompletionSource,
  commandDecoration,
} from "@orz/ui-codemirror/extensions/slash-commands";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";

const meta = {
  title: "ui-codemirror/MarkdownEditor",
  component: MarkdownEditor,
  args: {
    ariaLabel: "Comment",
    placeholder: "Write a comment… (Mod-Enter submits, Escape cancels)",
    className: "min-h-32 max-h-80 max-w-xl",
    onSubmit: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof MarkdownEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Plain: Story = {
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
 * Type `@` for the stub mention source, or `<det` on its own line for the
 * `<details>` template. An accepted mention leaves a space that punctuation
 * typed next replaces.
 */
export const Completion: Story = {
  args: {
    initialValue: "Thanks ",
    extensions: completion,
  },
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

function SlashCommandsDemo() {
  const [parsed, setParsed] = useState<ParsedDraft<DemoCommand>>(() =>
    parseCommandLines(SLASH_DRAFT, registry, providers),
  );
  return (
    <div className="grid max-w-xl gap-3">
      <MarkdownEditor
        ariaLabel="Comment"
        initialValue={SLASH_DRAFT}
        className="min-h-32 max-h-80"
        extensions={commands}
        onChange={(value) =>
          setParsed(parseCommandLines(value, registry, providers))
        }
      />
      <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs">
        {JSON.stringify(parsed, null, 2)}
      </pre>
    </div>
  );
}

/**
 * Type `/` at the start of a line for the command panel. A recognized line is
 * tinted, one whose argument names nothing is underlined, and the parse
 * below is what a submit would see. Arguments are shell words, so
 * `'In Progress'` is one; `/assign {alice,bot-one}` expands to a list
 * because its argument is declared `multiple`, and `/label` takes the rest
 * of the line unquoted.
 */
export const SlashCommands: Story = {
  render: () => <SlashCommandsDemo />,
};

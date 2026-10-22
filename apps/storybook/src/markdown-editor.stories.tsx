import type {
  Completion as CompletionOption,
  CompletionSource,
} from "@codemirror/autocomplete";
import { EditorView } from "@codemirror/view";
import { MarkdownEditor } from "@orz/ui-codemirror/components/markdown-editor";
import { completionWith } from "@orz/ui-codemirror/extensions/completion";
import { applyWithSpace } from "@orz/ui-codemirror/extensions/completion-space";
import {
  commandCompletionSource,
  commandDecoration,
} from "@orz/ui-codemirror/extensions/slash-commands";
import {
  createCommandRegistry,
  type ParsedDraft,
  parseCommandLines,
} from "@orz/ui-codemirror/lib/slash-commands";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";

const meta = {
  title: "Editors/MarkdownEditor",
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
  | { type: "hide_all"; force: boolean };

const DEMO_LABELS = ["bug", "docs"];

const registry = createCommandRegistry<DemoCommand>([
  {
    name: "close",
    argument: "none",
    detail: "→ Done",
    summarize: () => "close",
    compile: () => ({ type: "close" }),
  },
  {
    name: "label",
    argument: "required",
    detail: "add a label",
    candidates: DEMO_LABELS,
    summarize: (name) => `label ${name}`,
    compile: (name) =>
      DEMO_LABELS.includes(name) ? { type: "label", name } : null,
  },
  {
    name: "hide-all",
    argument: "optional",
    detail: "hide every comment before this one",
    candidates: ["force"],
    summarize: (argument) =>
      argument === "" ? "hide every comment" : "hide every comment, force",
    compile: (argument) =>
      argument === "" || argument === "force"
        ? { type: "hide_all", force: argument === "force" }
        : null,
    invalidReason: (argument) =>
      `/hide-all takes nothing or "force", not "${argument}"`,
  },
]);

const getRegistry = () => registry;
const commands = [
  completionWith([commandCompletionSource(getRegistry)]),
  commandDecoration(getRegistry),
];

const SLASH_DRAFT = "Shipping this.\n/close\n/label nope\n";

function SlashCommandsDemo() {
  const [parsed, setParsed] = useState<ParsedDraft<DemoCommand>>(() =>
    parseCommandLines(SLASH_DRAFT, registry),
  );
  return (
    <div className="grid max-w-xl gap-3">
      <MarkdownEditor
        ariaLabel="Comment"
        initialValue={SLASH_DRAFT}
        className="min-h-32 max-h-80"
        extensions={commands}
        onChange={(value) => setParsed(parseCommandLines(value, registry))}
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
 * below is what a submit would see.
 */
export const SlashCommands: Story = {
  render: () => <SlashCommandsDemo />,
};

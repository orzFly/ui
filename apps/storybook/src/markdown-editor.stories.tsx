import type {
  Completion as CompletionOption,
  CompletionSource,
} from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { TASK_PEOPLE, type TaskPerson } from "@orz/fixtures/tasks.ts";
import {
  createCommandRegistry,
  type ParsedDraft,
  parseCommandLines,
  type ValueProviders,
} from "@orz/query";
import { Avatar, AvatarFallback } from "@orz/ui/components/avatar";
import { Button } from "@orz/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@orz/ui/components/dialog";
import { MarkdownEditor } from "@orz/ui-codemirror/components/markdown-editor";
import {
  inCodeContext,
  inLiteralContext,
} from "@orz/ui-codemirror/extensions/code-context";
import {
  completionRowClass,
  completionWith,
  reactOption,
} from "@orz/ui-codemirror/extensions/completion";
import { applyWithSpace } from "@orz/ui-codemirror/extensions/completion-space";
import {
  commandCompletionSource,
  commandDecoration,
} from "@orz/ui-codemirror/extensions/slash-commands";
import {
  stagedFileDrag,
  useStagedFiles,
} from "@orz/ui-codemirror/hooks/use-staged-files";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PaperclipIcon, XIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { fn } from "storybook/test";
import { withWidth } from "./decorators.tsx";

const COMPLETION = `import { completionRowClass, completionWith, reactOption } from "@orz/ui-codemirror/extensions/completion";
import { applyWithSpace } from "@orz/ui-codemirror/extensions/completion-space";

// CodeMirror owns the Completion shape, so whose row it is lives beside it.
const people = new WeakMap<Completion, Person>();

const mentions: CompletionSource = (context) => {
  const match = context.matchBefore(/@\\w*$/);
  if (match === null) return null;
  const options = members.map((person) => {
    const option = { label: \`@\${person.login}\`, detail: person.name, type: "mention", apply: applyWithSpace(\`@\${person.login}\`) };
    people.set(option, person);
    return option;
  });
  return { from: match.from, options };
};

const avatar = reactOption(20, "cm-completionAvatar", (option) => {
  const person = people.get(option);
  return person === undefined ? null : (
    <Avatar size="sm" aria-hidden>
      <AvatarFallback>{person.name[0]}</AvatarFallback>
    </Avatar>
  );
});

<MarkdownEditor
  extensions={[
    completionWith([mentions], {
      optionClass: (option) => (people.has(option) ? completionRowClass.drawn : ""),
      addToOptions: [avatar],
    }),
    mentionIcon,
  ]}
/>`;

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
  argTypes: { extensions: { control: false }, staging: { control: false } },
  parameters: { guidelines: "/guidelines/patterns/writing-markdown/" },
} satisfies Meta<typeof MarkdownEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: {
    initialValue:
      "# A heading\n\nSome **bold**, some _italic_, a [link](https://example.com) and `code`.\n\n> A quote\n",
  },
};

/**
 * `plain` mounts a native textarea instead of CodeMirror, read once at
 * mount: the same handle, Mod-Enter and Escape, dirty tracking and paste and
 * drop callbacks, without highlighting, completion or paste conversion.
 */
export const Plain: Story = {
  args: {
    plain: true,
    initialValue: "A native textarea, for a reader who asked for one.\n",
  },
};

const STAGED_FILES = `import { MarkdownEditor } from "@orz/ui-codemirror/components/markdown-editor";
import { stagedFileDrag, useStagedFiles } from "@orz/ui-codemirror/hooks/use-staged-files";

// Uploading is yours; nothing goes up until a send calls resolve.
const staging = useStagedFiles({
  upload: (file) => uploadFile(file), // resolves to { url, filename? }
});

<MarkdownEditor
  staging={staging.editor}
  onSubmit={async (text) => {
    send(await staging.resolve(text)); // placeholders become the uploads' links
    staging.clear();
  }}
/>
{staging.staged.map((item) => (
  <Button key={item.key} {...stagedFileDrag(item.key)} onClick={() => staging.remove(item.key)}>
    {item.file.name}
  </Button>
))}
<Button onClick={() => input.current?.click()}>Attach files</Button>
<input ref={input} type="file" multiple hidden onChange={(e) => staging.stage(e.target.files ?? [])} />`;

/**
 * `staging` with `useStagedFiles`: paste, drop or attach a file and it goes
 * into the text as a placeholder where the caret is, drawn as a chip the caret
 * steps over. The buttons below list what the text places; one removes its
 * file from the text, and dragging one into the text places it once more.
 * Mod-Enter uploads (here, pretends to) and shows the text that would be sent.
 */
export const StagedFiles: Story = {
  args: {
    initialValue: "Here is the screenshot: ",
    placeholder: "Paste or drop a file",
  },
  parameters: { docs: { source: { code: STAGED_FILES, language: "tsx" } } },
  render: function Render(args) {
    const staging = useStagedFiles({
      upload: (file) =>
        new Promise<{ url: string }>((resolve) =>
          setTimeout(
            () =>
              resolve({
                url: `https://files.example/${encodeURIComponent(file.name)}`,
              }),
            300,
          ),
        ),
    });
    const input = useRef<HTMLInputElement>(null);
    const [sent, setSent] = useState<string | null>(null);
    return (
      <div className="grid gap-3">
        <MarkdownEditor
          {...args}
          staging={staging.editor}
          onSubmit={async (text) => {
            setSent(await staging.resolve(text));
            staging.clear();
          }}
        />
        <div className="flex flex-wrap gap-2">
          {staging.staged.map((item) => (
            <Button
              key={item.key}
              variant="outline"
              size="sm"
              aria-label={`Remove ${item.file.name}`}
              onClick={() => staging.remove(item.key)}
              {...stagedFileDrag(item.key)}
            >
              {item.file.name}
              <XIcon data-icon="inline-end" />
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => input.current?.click()}
          >
            <PaperclipIcon data-icon="inline-start" />
            Attach files
          </Button>
          <input
            ref={input}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              staging.stage(event.target.files ?? []);
              event.target.value = "";
            }}
          />
        </div>
        {sent !== null && (
          <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">
            {sent}
          </pre>
        )}
      </div>
    );
  },
};

/**
 * Copy part of a web page or a document and paste it here: links, emphasis, lists, tables and
 * code come through as Markdown, and a toolbar under the paste switches it to plain text or a
 * quote (Mod-. reaches it from the keyboard). Mod-Shift-V pastes plain text, Mod-Alt-V a quote.
 * Built into every MarkdownEditor.
 */
export const PasteAs: Story = {
  args: {
    placeholder: "Paste formatted text from a page here",
  },
};

/**
 * Mod-Shift-. quotes the lines a selection touches, under every cursor, and unquotes them when
 * they are all quoted already. Built into every MarkdownEditor.
 */
export const QuoteToggle: Story = {
  args: {
    initialValue:
      "Select these lines and press Mod-Shift-.\n\nThe blank line between them stays inside the quote.\n\n> Already quoted: press it here to unquote.\n",
  },
};

/**
 * Two images with `→` or `->` between them, alone in a paragraph, get a green
 * arrow: a renderer that knows the convention shows them as one comparison.
 * Copy `![after](/after.png)` and paste it on the empty last line, and a
 * toolbar under it offers to join it to the image above (Mod-. reaches it).
 * Built into every MarkdownEditor.
 */
export const ImagePairs: Story = {
  args: {
    initialValue:
      "![before](/before.png) → ![after](/after.png)\n\nNot a pair: see ![a](/a.png) -> ![b](/b.png) here.\n\n![before](/before.png)\n\n",
  },
};

const people = new WeakMap<CompletionOption, TaskPerson>();

const mentions: CompletionSource = (context) => {
  const match = context.matchBefore(/@\w*$/);
  if (match === null) return null;
  const options: CompletionOption[] = TASK_PEOPLE.map((person) => {
    const option: CompletionOption = {
      label: `@${person.login}`,
      detail: person.name,
      type: "mention",
      apply: applyWithSpace(`@${person.login}`),
    };
    people.set(option, person);
    return option;
  });
  options.push({
    label: "@here",
    detail: "everyone watching",
    type: "mention",
    apply: applyWithSpace("@here"),
  });
  return { from: match.from, options, validFor: /^@\w*$/ };
};

const avatar = reactOption(20, "cm-completionAvatar", (option) => {
  const person = people.get(option);
  if (person === undefined) return null;
  return (
    <Avatar size="sm" aria-hidden>
      <AvatarFallback>{person.name.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
});

const mentionIcon = EditorView.theme({
  ".cm-completionIcon-mention::after": {
    content: "'@'",
    color: "var(--primary)",
  },
});

const completion = [
  completionWith([mentions], {
    optionClass: (option) =>
      people.has(option) ? completionRowClass.drawn : "",
    addToOptions: [avatar],
  }),
  mentionIcon,
];

/**
 * Type `@` for the stub mention source. A person's row draws an avatar with
 * React (`reactOption`) where the type icon stands, in a taller row
 * (`completionRowClass.drawn`); `@here`, which names nobody, keeps its icon.
 * An accepted mention leaves a space that punctuation typed next replaces.
 */
export const Completion: Story = {
  args: {
    initialValue: "Thanks ",
    extensions: completion,
  },
  parameters: { docs: { source: { code: COMPLETION, language: "tsx" } } },
};

/**
 * The popup inside a centred dialog, whose transform makes CodeMirror place it
 * `absolute`: type `@` on the last line, and it flips above the line, or
 * shortens, to stay inside the dialog instead of being cut by the editor or by
 * the dialog's own box.
 */
export const CompletionInDialog: Story = {
  tags: ["edge", "!autodocs"],
  args: {
    initialValue: "Thanks\n\n\n\n",
    extensions: completion,
    className: "min-h-32",
  },
  decorators: [
    (Story) => (
      <Dialog open>
        <DialogContent>
          <DialogTitle>Finish review</DialogTitle>
          <DialogDescription>A summary for the review.</DialogDescription>
          <Story />
        </DialogContent>
      </Dialog>
    ),
  ],
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

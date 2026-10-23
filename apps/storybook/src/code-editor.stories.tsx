import type { EditorView } from "@codemirror/view";
import { Button } from "@orz/ui/components/button";
import {
  CodeEditor,
  type CodeEditorHandle,
  PROGRAMMATIC_USER_EVENT,
} from "@orz/ui-codemirror/components/code-editor";
import {
  markdownHighlightStyle,
  markdownLanguage,
} from "@orz/ui-codemirror/components/markdown-editor";
import { jsonSupport } from "@orz/ui-codemirror/extensions/json";
import { trimTrailingSpaceOnEnter } from "@orz/ui-codemirror/extensions/trim-trailing-space";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useReducer, useRef } from "react";
import { withWidth } from "./decorators.tsx";

const TRIM_HINT = [
  "A word, then a space: Enter drops the space.",
  "Two spaces end a hard break  ",
  "",
  "```",
  "code keeps its trailing space ",
  "```",
  "",
].join("\n");

const MARKDOWN_SAMPLE =
  "# A heading\n\nSome **bold**, some _italic_, ~~struck~~, a [link](https://example.com) and `code`.\n\n> A quote\n";

const JSON_SOURCE = `import { CodeEditor } from "@orz/ui-codemirror/components/code-editor";
import { jsonSupport } from "@orz/ui-codemirror/extensions/json";

<CodeEditor ariaLabel="Metadata" language={jsonSupport} initialValue={json} />`;

const MARKDOWN_LANGUAGE = `import { CodeEditor } from "@orz/ui-codemirror/components/code-editor";
import { markdownHighlightStyle, markdownLanguage } from "@orz/ui-codemirror/components/markdown-editor";

<CodeEditor language={markdownLanguage} highlightStyle={markdownHighlightStyle} initialValue={markdown} />`;

const TRIM_TRAILING_SPACE = `import { trimTrailingSpaceOnEnter } from "@orz/ui-codemirror/extensions/trim-trailing-space";

<CodeEditor
  language={markdownLanguage}
  keymap={[{ key: "Enter", run: trimTrailingSpaceOnEnter, shift: trimTrailingSpaceOnEnter }]}
/>`;

const PROVENANCE = `const editor = useRef<CodeEditorHandle>(null);
const view = useRef<EditorView | null>(null);

view.current?.dispatch({ changes: { from: 0, insert: "written by code" }, userEvent: PROGRAMMATIC_USER_EVENT });
editor.current?.userChanged(); // still false

<CodeEditor ref={editor} onView={(next) => { view.current = next; }} />`;

const meta = {
  title: "ui-codemirror/CodeEditor",
  component: CodeEditor,
  decorators: [withWidth("max-w-xl")],
  args: {
    ariaLabel: "Notes",
    placeholder: "Write something…",
    className: "min-h-24 max-h-64",
  },
  argTypes: {
    language: { control: false },
    highlightStyle: { control: false },
    keymap: { control: false },
    extensions: { control: false },
    onView: { control: false },
  },
} satisfies Meta<typeof CodeEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const ReadOnly: Story = {
  args: {
    readOnly: true,
    initialValue: "This editor takes no input.\nIts host is dimmed.",
  },
};

export const Json: Story = {
  args: {
    ariaLabel: "Metadata",
    language: jsonSupport,
    initialValue: JSON.stringify(
      { owner: "bot-one", retries: 3, tags: ["nightly", "docs"], draft: null },
      null,
      2,
    ),
  },
  parameters: { docs: { source: { code: JSON_SOURCE, language: "tsx" } } },
};

// Not args: Storybook serializes a story's args when it prepares the story, and a
// `Language` refers back to itself through its `extension`, so the story would never render.
const markdownRender: Story["render"] = (args) => (
  <CodeEditor
    {...args}
    language={markdownLanguage}
    highlightStyle={markdownHighlightStyle}
  />
);

/**
 * The language and highlight style `MarkdownEditor` uses, on a plain `CodeEditor`: markdown
 * colouring without its submit and line-editing keys.
 */
export const MarkdownLanguage: Story = {
  render: markdownRender,
  args: {
    ariaLabel: "Markdown",
    initialValue: MARKDOWN_SAMPLE,
  },
  parameters: {
    docs: { source: { code: MARKDOWN_LANGUAGE, language: "tsx" } },
  },
};

/**
 * Enter after a single trailing space drops the space together with the line break, in one undo
 * step. Two spaces (a hard break), whitespace-only lines and code keep theirs. The command reads
 * the syntax tree, so it needs a markdown `language`.
 */
export const TrimTrailingSpace: Story = {
  render: markdownRender,
  args: {
    ariaLabel: "Markdown",
    keymap: [
      {
        key: "Enter",
        run: trimTrailingSpaceOnEnter,
        shift: trimTrailingSpaceOnEnter,
      },
    ],
    initialValue: TRIM_HINT,
  },
  parameters: {
    docs: { source: { code: TRIM_TRAILING_SPACE, language: "tsx" } },
  },
};

/** Only the write tagged `PROGRAMMATIC_USER_EVENT` leaves `userChanged()` false. */
export const Provenance: Story = {
  args: {
    ariaLabel: "Draft",
    initialValue: "Type here, or use the buttons below.",
  },
  parameters: { docs: { source: { code: PROVENANCE, language: "tsx" } } },
  render: function Render(args) {
    const handle = useRef<CodeEditorHandle>(null);
    const view = useRef<EditorView | null>(null);
    const [, refresh] = useReducer((n: number) => n + 1, 0);
    const changed = handle.current?.userChanged() ?? false;

    const programmatic = () => {
      const current = view.current;
      if (current === null) return;
      current.dispatch({
        changes: {
          from: current.state.doc.length,
          insert: "\nwritten by code",
        },
        userEvent: PROGRAMMATIC_USER_EVENT,
      });
      refresh();
    };

    return (
      <div className="grid gap-3">
        <CodeEditor
          {...args}
          ref={handle}
          onView={(next) => {
            view.current = next;
          }}
          onChange={refresh}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={programmatic}>
            Programmatic write
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              handle.current?.append("\nappended");
              refresh();
            }}
          >
            append()
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              handle.current?.setValue("replaced by setValue()");
              refresh();
            }}
          >
            setValue()
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">
          userChanged():{" "}
          <code className="text-foreground">{String(changed)}</code>
        </p>
      </div>
    );
  },
};

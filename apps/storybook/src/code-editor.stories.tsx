import type { EditorView } from "@codemirror/view";
import { Button } from "@orz/ui/components/button";
import {
  CodeEditor,
  type CodeEditorHandle,
  PROGRAMMATIC_USER_EVENT,
} from "@orz/ui-codemirror/components/code-editor";
import { jsonSupport } from "@orz/ui-codemirror/extensions/json";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useReducer, useRef } from "react";

const meta = {
  title: "ui-codemirror/CodeEditor",
  component: CodeEditor,
  args: {
    ariaLabel: "Notes",
    placeholder: "Write something…",
    className: "min-h-24 max-h-64 max-w-xl",
  },
} satisfies Meta<typeof CodeEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Plain: Story = {};

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
};

function ProvenanceDemo() {
  const handle = useRef<CodeEditorHandle>(null);
  const view = useRef<EditorView | null>(null);
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const changed = handle.current?.userChanged() ?? false;

  const programmatic = () => {
    const current = view.current;
    if (current === null) return;
    current.dispatch({
      changes: { from: current.state.doc.length, insert: "\nwritten by code" },
      userEvent: PROGRAMMATIC_USER_EVENT,
    });
    refresh();
  };

  return (
    <div className="grid max-w-xl gap-3">
      <CodeEditor
        ref={handle}
        ariaLabel="Draft"
        initialValue="Type here, or use the buttons below."
        className="min-h-24 max-h-64"
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
}

/** Only the write tagged `PROGRAMMATIC_USER_EVENT` leaves `userChanged()` false. */
export const Provenance: Story = {
  render: () => <ProvenanceDemo />,
};

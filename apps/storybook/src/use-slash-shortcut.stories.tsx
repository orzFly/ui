import { useSlashShortcut } from "@orz/ui/hooks/use-slash-shortcut";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState } from "react";
import { withWidth } from "./decorators.tsx";

const USAGE = `import { useSlashShortcut } from "@orz/ui/hooks/use-slash-shortcut";
import { useRef } from "react";

function Search() {
  const input = useRef<HTMLInputElement>(null);
  // Ignored while the reader is typing in an input, textarea, select or contenteditable.
  useSlashShortcut(() => input.current?.focus());
  return <input ref={input} type="search" placeholder="Search (press /)" />;
}`;

const meta = {
  title: "ui/Hooks/useSlashShortcut",
  decorators: [withWidth("max-w-sm")],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Press `/` anywhere on the canvas to focus the search; in the notes field it
 * types a slash as usual.
 */
export const Usage: Story = {
  parameters: { docs: { source: { code: USAGE, language: "tsx" } } },
  render: function Render() {
    const search = useRef<HTMLInputElement>(null);
    const [taken, setTaken] = useState(0);
    useSlashShortcut(() => {
      search.current?.focus();
      setTaken((n) => n + 1);
    });

    return (
      <div className="grid gap-3">
        <input
          ref={search}
          type="search"
          placeholder="Search (press /)"
          aria-label="Search"
          className="rounded-md border px-2 py-1"
        />
        <textarea
          placeholder="Notes: / types here"
          aria-label="Notes"
          className="rounded-md border px-2 py-1"
        />
        <span>
          Shortcut taken: <strong>{taken}</strong>
        </span>
      </div>
    );
  },
};

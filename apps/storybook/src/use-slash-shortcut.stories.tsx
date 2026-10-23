import { useSlashShortcut } from "@orz/ui/hooks/use-slash-shortcut";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState } from "react";

const meta = {
  title: "ui/Hooks/useSlashShortcut",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Press `/` anywhere on the canvas to focus the search; in the notes field it
 * types a slash as usual.
 */
export const FocusSearch: Story = {
  render: function Render() {
    const search = useRef<HTMLInputElement>(null);
    const [taken, setTaken] = useState(0);
    useSlashShortcut(() => {
      search.current?.focus();
      setTaken((n) => n + 1);
    });

    return (
      <div className="grid max-w-sm gap-3">
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

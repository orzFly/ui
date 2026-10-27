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
  parameters: { guidelines: "/guidelines/platforms/desktop-and-pointer/" },
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

const ENABLED = `import { useSlashShortcut } from "@orz/ui/hooks/use-slash-shortcut";
import { useRef } from "react";

function Search({ shortcuts }: { shortcuts: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  // A single-key shortcut must be possible to turn off (WCAG 2.1.4):
  // wire \`enabled\` to the app's keyboard-shortcuts setting.
  useSlashShortcut(() => input.current?.focus(), { enabled: shortcuts });
  return <input ref={input} type="search" placeholder="Search" />;
}`;

/**
 * `enabled: false` unbinds `/`, so a reader who dictates or trips over single
 * keys can turn it off from a keyboard-shortcuts setting.
 */
export const Enabled: Story = {
  parameters: { docs: { source: { code: ENABLED, language: "tsx" } } },
  render: function Render() {
    const search = useRef<HTMLInputElement>(null);
    const [shortcuts, setShortcuts] = useState(false);
    useSlashShortcut(() => search.current?.focus(), { enabled: shortcuts });

    return (
      <div className="grid gap-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={shortcuts}
            onChange={(e) => setShortcuts(e.target.checked)}
          />
          Keyboard shortcuts
        </label>
        <input
          ref={search}
          type="search"
          placeholder={shortcuts ? "Search (press /)" : "Search"}
          aria-label="Search"
          className="rounded-md border px-2 py-1"
        />
      </div>
    );
  },
};

import { usePagedAppend } from "@orz/ui/hooks/use-paged-append";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

const meta = {
  title: "Hooks/usePagedAppend",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const LISTS = {
  fruit: ["Apple", "Banana", "Cherry", "Damson", "Elderberry", "Fig"],
  vegetables: ["Artichoke", "Bean", "Carrot", "Daikon", "Endive", "Fennel"],
};
type List = keyof typeof LISTS;

function fetchPage(list: List, page: number, fail: boolean) {
  return new Promise<string[]>((resolve, reject) =>
    setTimeout(() => {
      if (fail) reject(new Error("503 Service Unavailable"));
      else resolve(LISTS[list].slice(page * 2, page * 2 + 2));
    }, 1200),
  );
}

/**
 * Switch the list while a page is loading: the reset key changes, the pages
 * start over, and the answer for the old list is dropped when it arrives.
 */
export const SwitchingLists: Story = {
  render: function Render() {
    const [list, setList] = useState<List>("fruit");
    const [fail, setFail] = useState(false);
    const { pages, pending, error, append } = usePagedAppend<string[]>(list);
    const exhausted = pages.length * 2 >= LISTS[list].length;
    return (
      <div className="grid max-w-sm gap-3">
        <div className="flex items-center gap-2">
          {(Object.keys(LISTS) as List[]).map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={list === name}
              className="rounded-md border px-2 aria-pressed:bg-accent"
              onClick={() => setList(name)}
            >
              {name}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-1">
            <input
              type="checkbox"
              checked={fail}
              onChange={(e) => setFail(e.target.checked)}
            />
            Fail the next load
          </label>
        </div>
        <ul className="grid gap-1">
          {pages.flat().map((item) => (
            <li key={item} className="rounded-md border px-2 py-1">
              {item}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border px-2 disabled:opacity-50"
            disabled={pending || exhausted}
            onClick={() => {
              const page = pages.length;
              const failing = fail;
              setFail(false);
              append(() => fetchPage(list, page, failing));
            }}
          >
            {exhausted ? "No more" : "Load page"}
          </button>
          <span className="text-muted-foreground">
            {pages.length} page{pages.length === 1 ? "" : "s"}
            {pending && " · loading…"}
            {/* The hook keeps the last error until a retry settles. */}
            {!pending && error && ` · ${error.message}`}
          </span>
        </div>
      </div>
    );
  },
};

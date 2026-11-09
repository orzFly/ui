import { Button } from "@orz/ui/components/button";
import { Checkbox } from "@orz/ui/components/checkbox";
import { Label } from "@orz/ui/components/label";
import { List, ListItem } from "@orz/ui/components/list";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@orz/ui/components/segmented-control";
import { usePagedAppend } from "@orz/ui/hooks/use-paged-append";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { withWidth } from "./decorators.tsx";

const USAGE = `import { usePagedAppend } from "@orz/ui/hooks/use-paged-append";

function Items({ list }: { list: string }) {
  // Pages start over when the list changes; a late answer for the old list is dropped.
  const { pages, pending, error, append } = usePagedAppend<Item[]>(list);
  return (
    <>
      <ul>{pages.flat().map((item) => <li key={item.id}>{item.name}</li>)}</ul>
      <Button disabled={pending} onClick={() => append(() => fetchPage(list, pages.length))}>
        Load more
      </Button>
      {error && <p>{error.message}</p>}
    </>
  );
}`;

const meta = {
  title: "ui/Hooks/usePagedAppend",
  decorators: [withWidth("max-w-sm")],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const LISTS = {
  fruit: ["Apple", "Banana", "Cherry", "Damson", "Elderberry", "Fig"],
  vegetables: ["Artichoke", "Bean", "Carrot", "Daikon", "Endive", "Fennel"],
};
type ListName = keyof typeof LISTS;

function fetchPage(list: ListName, page: number, fail: boolean) {
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
export const Usage: Story = {
  parameters: { docs: { source: { code: USAGE, language: "tsx" } } },
  render: function Render() {
    const [list, setList] = useState<ListName>("fruit");
    const [fail, setFail] = useState(false);
    const { pages, pending, error, append } = usePagedAppend<string[]>(list);
    const exhausted = pages.length * 2 >= LISTS[list].length;
    return (
      <div className="grid gap-3">
        <div className="flex items-center gap-2">
          <SegmentedControl
            aria-label="List"
            value={list}
            onValueChange={(name) => setList(name as ListName)}
          >
            {(Object.keys(LISTS) as ListName[]).map((name) => (
              <SegmentedControlItem key={name} value={name}>
                {name}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
          <Label className="ml-auto">
            <Checkbox
              checked={fail}
              onCheckedChange={(checked) => setFail(checked === true)}
            />
            Fail the next load
          </Label>
        </div>
        <List purpose="collection">
          <ul>
            {pages.flat().map((item) => (
              <ListItem key={item} asChild>
                <li className="px-2 py-1">{item}</li>
              </ListItem>
            ))}
          </ul>
        </List>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pending || exhausted}
            onClick={() => {
              const page = pages.length;
              const failing = fail;
              setFail(false);
              append(() => fetchPage(list, page, failing));
            }}
          >
            {exhausted ? "No more" : "Load page"}
          </Button>
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

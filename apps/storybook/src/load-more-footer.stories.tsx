import {
  LoadMoreFailure as LoadMoreFailureView,
  LoadMoreFooter,
} from "@orz/ui/components/load-more";
import { usePagedAppend } from "@orz/ui/hooks/use-paged-append";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState } from "react";
import { fn } from "storybook/test";
import { withWidth } from "./decorators.tsx";

const FAILURE = new Error("503 Service Unavailable");

const PAGING_SOURCE = `import { LoadMoreFooter } from "@orz/ui/components/load-more";
import { usePagedAppend } from "@orz/ui/hooks/use-paged-append";

const { pages, pending, error, append } = usePagedAppend<Row[]>(listKey);
const focusRequested = useRef(false);
const loadMore = () => {
  // Retry focus goes back to the footer only after a click on it.
  focusRequested.current = true;
  append(() => fetchPage(pages.length));
};

<>
  <RowList rows={pages.flat()} />
  <LoadMoreFooter pending={pending} error={error} onLoadMore={loadMore} focusRequested={focusRequested} />
</>`;

const meta = {
  title: "ui/LoadMoreFooter",
  component: LoadMoreFooter,
  parameters: { guidelines: "/guidelines/patterns/loading-empty-and-error/" },
  args: {
    pending: false,
    error: null,
    onLoadMore: fn(),
    focusRequested: { current: false },
  },
} satisfies Meta<typeof LoadMoreFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Pending: Story = { args: { pending: true } };

export const Failed: Story = {
  args: { error: new Error("503 Service Unavailable") },
};

/**
 * The footer's failure row alone, for a list with its own load-more control;
 * it takes focus back to Retry after a failed click.
 */
export const LoadMoreFailure: Story = {
  args: { error: FAILURE },
  render: (args) => (
    <LoadMoreFailureView
      error={args.error ?? FAILURE}
      onRetry={args.onLoadMore}
      retrying={args.pending}
      focusRequested={args.focusRequested}
    />
  ),
};

/** Driven by usePagedAppend; every third page fails. */
export const WithPaging: Story = {
  decorators: [withWidth("max-w-sm")],
  parameters: { docs: { source: { code: PAGING_SOURCE, language: "tsx" } } },
  render: function Render() {
    const { pages, pending, error, append } = usePagedAppend<string[]>("demo");
    const focusRequested = useRef(false);
    const [calls, setCalls] = useState(0);
    const loadMore = () => {
      focusRequested.current = true;
      const call = calls + 1;
      setCalls(call);
      append(
        () =>
          new Promise<string[]>((resolve, reject) =>
            setTimeout(() => {
              if (call % 3 === 0) reject(new Error("timed out"));
              else
                resolve(
                  Array.from(
                    { length: 3 },
                    (_, i) => `Row ${pages.length * 3 + i + 1}`,
                  ),
                );
            }, 600),
          ),
      );
    };
    return (
      <div className="grid gap-3">
        <ul className="grid gap-1">
          {pages.flat().map((row) => (
            <li key={row} className="rounded-md border px-2 py-1">
              {row}
            </li>
          ))}
        </ul>
        <LoadMoreFooter
          pending={pending}
          error={error}
          onLoadMore={loadMore}
          focusRequested={focusRequested}
        />
      </div>
    );
  },
};

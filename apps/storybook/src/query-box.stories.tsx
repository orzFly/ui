import {
  type CompiledQuerySchema,
  defineQuerySchema,
  parseQuery,
} from "@orz/query";
import { QueryBox, type RowSource } from "@orz/ui/components/query-box";
import { highlightQuery } from "@orz/ui/components/query-highlight";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ClockIcon, SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { fn } from "storybook/test";
import { withWidth } from "./decorators.tsx";
import { PROVIDERS, QUALIFIERS } from "./fixtures/query.ts";

// Compiled once per mode at module load, as an app would: the schema is a
// static table, and a new object per render would defeat memoised parsing.
const SCHEMAS: Record<"plain" | "shell", CompiledQuerySchema> = {
  plain: defineQuerySchema({
    qualifiers: QUALIFIERS,
    braces: true,
    maxFilters: 8,
  }),
  shell: defineQuerySchema({
    qualifiers: QUALIFIERS,
    braces: true,
    maxFilters: 8,
    escapes: "shell",
  }),
};

type Past = { q: string };

const INITIAL_HISTORY: readonly Past[] = [
  { q: "is:open label:{kind:bug,area:web}" },
  { q: "assignee:@me -label:area:ui" },
  { q: "flaky test" },
];

// Written by hand: the story wires a schema, providers, a history source and
// highlightQuery into the box, and the generated snippet would print the
// compiled schema, Map and all.
const querySource = (
  shell: boolean,
) => `import { defineQuerySchema, parseQuery, type ValueProviders } from "@orz/query";
import { QueryBox, type RowSource } from "@orz/ui/components/query-box";
import { highlightQuery } from "@orz/ui/components/query-highlight";

// Once, at module load: parsing is memoised per schema.
const schema = defineQuerySchema({ qualifiers: { is, label, assignee }, braces: true, maxFilters: 8${shell ? ', escapes: "shell"' : ""} });

const providers: ValueProviders = {
  label: { options: [{ value: "kind:bug" }, { value: "area:web" }] },
  member: { search: (prefix, signal) => searchMembers(prefix, signal) },
};

type Past = { q: string };

const [value, setValue] = useState("");
const history: RowSource<Past> = {
  id: "history",
  matched: false,
  yields: true,
  rows: past.filter((e) => e.q.includes(value.trim())),
  key: (row) => row.q,
  render: (row, option) => (
    <div {...option}>{highlightQuery(row.q, parseQuery(schema, row.q), schema, providers)}</div>
  ),
  apply: (row) => ({ value: row.q, caret: row.q.length }),
  remove: (row) => forget(row),
};

<QueryBox
  schema={schema}
  providers={providers}
  value={value}
  onValueChange={setValue}
  onSubmit={(query, chosen) => search(chosen?.q ?? query)}
  sources={[history]}
  renderSubmitRow={(query, option) => <div {...option}>Search for “{query}”</div>}
  inputProps={{ "aria-label": "Search" }}
/>`;

const meta = {
  title: "ui/QueryBox",
  component: QueryBox,
  args: {
    schema: SCHEMAS.plain,
    providers: PROVIDERS,
    value: "",
    onValueChange: fn(),
    onSubmit: fn(),
    renderSubmitRow: (query, option) => (
      <div {...option}>
        <SearchIcon
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span className="truncate">Search for “{query}”</span>
      </div>
    ),
    listAlign: "start",
    leading: (
      <SearchIcon className="size-3.5 text-muted-foreground" aria-hidden />
    ),
    inputProps: { "aria-label": "Search", placeholder: "Search…" },
  },
  argTypes: {
    schema: { control: false },
    providers: { control: false },
    sources: { control: false },
    renderSubmitRow: { control: false },
    leading: { control: false },
  },
  parameters: {
    docs: { source: { code: querySource(false), language: "tsx" } },
  },
  decorators: [withWidth("max-w-xl")],
  // The text lives in state, not in the args: a late `updateArgs` would make
  // the caret jump. The effect still lets the `value` control drive it.
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    useEffect(() => setValue(args.value), [args.value]);
    const [past, setPast] = useState<readonly Past[]>(INITIAL_HISTORY);
    const needle = value.trim().toLowerCase();
    const history: RowSource<Past> = {
      id: "history",
      matched: false,
      yields: true,
      rows: past.filter((e) => e.q.toLowerCase().includes(needle)),
      key: (row) => row.q,
      render: (row, option) => (
        <div {...option}>
          <ClockIcon
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span className="truncate">
            {highlightQuery(
              row.q,
              parseQuery(args.schema, row.q),
              args.schema,
              args.providers,
            )}
          </span>
        </div>
      ),
      apply: (row) => ({ value: row.q, caret: row.q.length }),
      remove: (row) => setPast((e) => e.filter((x) => x !== row)),
    };
    return (
      <QueryBox<Past>
        {...args}
        value={value}
        sources={[history]}
        onValueChange={(next) => {
          setValue(next);
          args.onValueChange(next);
        }}
        onSubmit={(query, chosen) => {
          const q = chosen?.q ?? query;
          setValue(q);
          setPast((e) => [{ q }, ...e.filter((x) => x.q !== q)]);
          args.onSubmit(query, chosen);
        }}
      />
    );
  },
} satisfies Meta<typeof QueryBox<Past>>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Type `label:` for the label list, Tab to take the first offer, or arrow
 * down and press Enter. `assignee:` asks a slow search provider, so its rows
 * arrive after a short wait. Braces are on: `label:{kind:bug,area:` completes
 * inside the group. A value the schema does not know (`is:opne`,
 * `label:nope`) is underlined.
 *
 * Past queries form the history source: they fill whatever room the
 * completions leave, Tab loads one into the box, and Shift+Delete on a
 * highlighted one forgets it. Escape closes the panel.
 *
 * Switch to `ShellEscapes` to quote inside values: `label:'In Progress'`
 * or `label:a\,b` hold one value each.
 */
export const Playground: Story = {};

/**
 * Shell escaping, where quotes and backslashes inside a value are muted.
 * `escapes` sets how quotes and backslashes read: `plain` is todou's grammar,
 * `shell` reads words as a POSIX shell would.
 */
export const ShellEscapes: Story = {
  args: { schema: SCHEMAS.shell },
  parameters: {
    docs: { source: { code: querySource(true), language: "tsx" } },
  },
};

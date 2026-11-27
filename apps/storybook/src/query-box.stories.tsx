import { PROVIDERS, QUALIFIERS } from "@orz/fixtures/query.ts";
import { type CompiledQuerySchema, defineQuerySchema } from "@orz/query";
import { QueryBox } from "@orz/ui/components/query-box";
import {
  type QueryHistoryEntry,
  useQueryHistory,
} from "@orz/ui/hooks/use-query-history";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { fn } from "storybook/test";
import { withWidth } from "./decorators.tsx";

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

// Newest first, as useQueryHistory keeps them; the times matter to nothing
// the box draws.
const INITIAL_HISTORY: readonly QueryHistoryEntry[] = [
  { q: "is:open label:{kind:bug,area:web}", t: 3 },
  { q: "assignee:@me -label:area:ui", t: 2 },
  { q: "flaky test", t: 1 },
];

// Written by hand: the story wires a schema, providers and a history into
// the box, and the generated snippet would print the compiled schema, Map
// and all.
const querySource = (
  shell: boolean,
) => `import { defineQuerySchema, type ValueProviders } from "@orz/query";
import { QueryBox } from "@orz/ui/components/query-box";
import { useQueryHistory } from "@orz/ui/hooks/use-query-history";

// Once, at module load: parsing is memoised per schema.
const schema = defineQuerySchema({ qualifiers: { is, label, assignee }, braces: true, maxFilters: 8${shell ? ', escapes: "shell"' : ""} });

const providers: ValueProviders = {
  label: { options: [{ value: "kind:bug" }, { value: "area:web" }] },
  member: { search: (prefix, signal) => searchMembers(prefix, signal) },
};

const [value, setValue] = useState("");
const history = useQueryHistory({ storageKey: "app:search-history", scope: project.id });

<QueryBox
  schema={schema}
  providers={providers}
  value={value}
  onValueChange={setValue}
  history={history}
  onSubmit={(query) => {
    history.record(query);
    search(query);
  }}
  renderSubmitRow={(query, option) => <div {...option}>Search for “{query}”</div>}
  inputProps={{ "aria-label": "Search" }}
/>`;

const storedSource = `import { QueryBox } from "@orz/ui/components/query-box";
import { useQueryHistory } from "@orz/ui/hooks/use-query-history";

const [value, setValue] = useState("");
const history = useQueryHistory({ storageKey: "app:search-history", scope: "issues" });

<QueryBox
  schema={schema}
  providers={providers}
  value={value}
  onValueChange={setValue}
  history={history}
  queryHref={(query) => \`/issues?q=\${encodeURIComponent(query)}\`}
  onSubmit={(query) => {
    history.record(query);
    navigate(\`/issues?q=\${encodeURIComponent(query)}\`);
  }}
  renderSubmitRow={(query, option) => <div {...option}>Search for “{query}”</div>}
  inputProps={{ "aria-label": "Search issues" }}
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
    history: { control: false },
    queryHref: { control: false },
    renderSubmitRow: { control: false },
    leading: { control: false },
  },
  parameters: {
    docs: { source: { code: querySource(false), language: "tsx" } },
    guidelines: "/guidelines/patterns/search/",
  },
  decorators: [withWidth("max-w-xl")],
  // The text lives in state, not in the args: a late `updateArgs` would make
  // the caret jump. The effect still lets the `value` control drive it.
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    useEffect(() => setValue(args.value), [args.value]);
    // Kept in memory, so the page opens on the same past queries every
    // time; StoredHistory keeps them for real.
    const [entries, setEntries] = useState(INITIAL_HISTORY);
    return (
      <QueryBox
        {...args}
        value={value}
        history={{
          entries,
          remove: (query) =>
            setEntries((all) => all.filter((e) => e.q !== query)),
        }}
        onValueChange={(next) => {
          setValue(next);
          args.onValueChange(next);
        }}
        onSubmit={(query, chosen, fromHistory) => {
          setValue(query);
          setEntries((all) => [
            { q: query, t: Date.now() },
            ...all.filter((e) => e.q.toLowerCase() !== query.toLowerCase()),
          ]);
          args.onSubmit(query, chosen, fromHistory);
        }}
      />
    );
  },
} satisfies Meta<typeof QueryBox>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Type `label:` for the label list, Tab to take the first offer, or arrow
 * down and press Enter. `assignee:` asks a slow search provider, so its rows
 * arrive after a short wait. Braces are on: `label:{kind:bug,area:` completes
 * inside the group. A value the schema does not know (`is:opne`,
 * `label:nope`) is underlined in a wave; `assignee:@me`, which stands for
 * whoever is signed in, is underlined in dots.
 *
 * Past queries come from `history`: an empty box lists them all; a typed
 * value offers those it begins above the submit row and those it is only
 * part of below, in whatever room the completions leave. Tab loads one into
 * the box, Enter submits it, and its × or Shift+Delete forgets it. Escape
 * closes the panel.
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

/**
 * A history `useQueryHistory` keeps in localStorage. Search a few times and
 * reload: the queries are still offered. Open this story in a second tab
 * and search there, and this one follows. Each past query is a link to its
 * results (`queryHref`), so a middle click opens them in a new tab.
 */
export const StoredHistory: Story = {
  parameters: {
    docs: { source: { code: storedSource, language: "tsx" } },
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    useEffect(() => setValue(args.value), [args.value]);
    const history = useQueryHistory({
      storageKey: "orz-storybook-query-history",
      scope: "issues",
    });
    return (
      <QueryBox
        {...args}
        value={value}
        history={history}
        queryHref={(query) => `#q=${encodeURIComponent(query)}`}
        onValueChange={(next) => {
          setValue(next);
          args.onValueChange(next);
        }}
        onSubmit={(query, chosen, fromHistory) => {
          history.record(query);
          setValue(query);
          args.onSubmit(query, chosen, fromHistory);
        }}
      />
    );
  },
};

import {
  type CompiledQuerySchema,
  defineQuerySchema,
  diagnoseQuery,
  parseQuery,
  type QuerySchema,
  queryFilters,
  queryTerms,
  type ValueOption,
  type ValueProviders,
} from "@orz/query";
import { QueryBox, type RowSource } from "@orz/ui/components/query-box";
import { highlightQuery } from "@orz/ui/components/query-highlight";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ClockIcon, SearchIcon } from "lucide-react";
import { useState } from "react";

type Escapes = "plain" | "shell";

const qualifiers = {
  is: {
    value: { kind: "enum", values: ["open", "closed"] },
    hint: "open or closed",
  },
  label: { value: { kind: "named", source: "label" }, hint: "a label name" },
  assignee: {
    value: { kind: "named", source: "member", special: ["@me"] },
    hint: "a login, or @me",
  },
} satisfies QuerySchema["qualifiers"];

// Compiled once per mode at module load, as an app would: the schema is a
// static table, and a new object per render would defeat memoised parsing.
const SCHEMAS: Record<Escapes, CompiledQuerySchema> = {
  plain: defineQuerySchema({ qualifiers, braces: true, maxFilters: 8 }),
  shell: defineQuerySchema({
    qualifiers,
    braces: true,
    maxFilters: 8,
    escapes: "shell",
  }),
};

const MEMBERS: readonly ValueOption[] = [
  { value: "alice", hint: "Alice" },
  { value: "bot-one", hint: "a bot" },
  { value: "claude-agent", hint: "an agent" },
  { value: "newcomer", hint: "joined this week" },
];

/** Stands in for a server round trip, slow enough to see the wait. */
const searchMembers = (prefix: string, signal: AbortSignal) =>
  new Promise<readonly ValueOption[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      const lower = prefix.toLowerCase();
      resolve(MEMBERS.filter((m) => m.value.startsWith(lower)));
    }, 400);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });

const PROVIDERS: ValueProviders = {
  label: {
    options: [
      { value: "kind:bug" },
      { value: "kind:feature" },
      { value: "area:web" },
      { value: "area:ui" },
      { value: "In Progress", hint: "has a space" },
    ],
  },
  member: { search: searchMembers },
};

type Past = { q: string };

const INITIAL_HISTORY: readonly Past[] = [
  { q: "is:open label:{kind:bug,area:web}" },
  { q: "assignee:@me -label:area:ui" },
  { q: "flaky test" },
];

function QueryBoxDemo({ escapes }: { escapes: Escapes }) {
  const schema = SCHEMAS[escapes];
  const [value, setValue] = useState("");
  const [past, setPast] = useState<readonly Past[]>(INITIAL_HISTORY);
  const [submitted, setSubmitted] = useState<string | null>(null);

  const record = (q: string) => {
    setSubmitted(q);
    setPast((entries) => [{ q }, ...entries.filter((e) => e.q !== q)]);
  };

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
          {highlightQuery(row.q, parseQuery(schema, row.q), schema, PROVIDERS)}
        </span>
      </div>
    ),
    apply: (row) => ({ value: row.q, caret: row.q.length }),
    remove: (row) => setPast((entries) => entries.filter((e) => e !== row)),
  };

  const parts = parseQuery(schema, value);

  return (
    <div className="grid max-w-xl gap-3">
      <QueryBox<Past>
        schema={schema}
        providers={PROVIDERS}
        value={value}
        onValueChange={setValue}
        onSubmit={(query, chosen) => {
          const q = chosen?.q ?? query;
          setValue(q);
          record(q);
        }}
        sources={[history]}
        renderSubmitRow={(query, option) => (
          <div {...option}>
            <SearchIcon
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="truncate">Search for “{query}”</span>
          </div>
        )}
        listAlign="start"
        leading={
          <SearchIcon className="size-3.5 text-muted-foreground" aria-hidden />
        }
        inputProps={{ "aria-label": "Search", placeholder: "Search…" }}
      />
      <p className="text-muted-foreground text-sm">
        Last submitted: <code>{submitted ?? "nothing yet"}</code>
      </p>
      <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs">
        {JSON.stringify(
          {
            terms: queryTerms(parts),
            filters: queryFilters(parts),
            diagnostics: diagnoseQuery(schema, parts, PROVIDERS),
            parts,
          },
          null,
          2,
        )}
      </pre>
    </div>
  );
}

const meta = {
  title: "ui/QueryBox",
  args: { escapes: "plain" as Escapes },
  argTypes: {
    escapes: {
      control: "inline-radio",
      options: ["plain", "shell"],
      description:
        "How quotes and backslashes read: `plain` is todou's grammar, `shell` reads words as a POSIX shell would.",
    },
  },
  render: ({ escapes }) => <QueryBoxDemo key={escapes} escapes={escapes} />,
} satisfies Meta<{ escapes: Escapes }>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Type `label:` for the label list, Tab to take the first offer, or arrow
 * down and press Enter. `assignee:` asks a slow search provider, so its rows
 * arrive after a short wait. Braces are on: `label:{kind:bug,area:` completes
 * inside the group, and the parse below shows the expansion. A value the
 * schema does not know (`is:opne`, `label:nope`) is underlined and reported
 * under `diagnostics`.
 *
 * Past queries form the history source: they fill whatever room the
 * completions leave, Tab loads one into the box, and Shift+Delete on a
 * highlighted one forgets it. Escape closes the panel.
 *
 * Switch `escapes` to `shell` to quote inside values: `label:'In Progress'`
 * or `label:a\,b` hold one value each.
 */
export const Playground: Story = {};

/** Shell escaping, where quotes and backslashes inside a value are muted. */
export const ShellEscapes: Story = {
  args: { escapes: "shell" },
};

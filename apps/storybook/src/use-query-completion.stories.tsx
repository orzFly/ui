import { PROVIDERS, QUALIFIERS } from "@orz/fixtures/query.ts";
import { defineQuerySchema } from "@orz/query";
import { HighlightedInput } from "@orz/ui/components/highlighted-input";
import { highlightQuery } from "@orz/ui/components/query-highlight";
import { useQueryCompletion } from "@orz/ui/hooks/use-query-completion";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState } from "react";
import { withWidth } from "./decorators.tsx";

const USAGE = `import { defineQuerySchema, type ValueProviders } from "@orz/query";
import { HighlightedInput } from "@orz/ui/components/highlighted-input";
import { highlightQuery } from "@orz/ui/components/query-highlight";
import { useQueryCompletion } from "@orz/ui/hooks/use-query-completion";
import { useState } from "react";

const schema = defineQuerySchema({
  qualifiers: {
    is: { value: { kind: "enum", values: ["open", "closed"] } },
    label: { value: { kind: "named", source: "label" } },
    assignee: { value: { kind: "named", source: "member", special: ["@me"] } },
  },
});
const providers: ValueProviders = {
  label: { options: [{ value: "kind:bug" }, { value: "area:ui" }] },
  member: { search: (prefix, signal) => fetchMembers(prefix, signal) },
};

function Search() {
  const [value, setValue] = useState("");
  const [caret, setCaret] = useState(0);
  const { parts, completions, loading } = useQueryCompletion({ schema, value, caret, providers });
  return (
    <>
      <HighlightedInput
        aria-label="Search"
        value={value}
        onValueChange={setValue}
        onCaretChange={(p) => setCaret(p.caret)}
        render={(text) => highlightQuery(text, parts, schema, providers)}
      />
      {completions.flatMap((source) => source.rows).map((row) => (
        <button key={row.id} type="button" onClick={() => setValue(row.apply.value)}>
          {row.text}
        </button>
      ))}
      {loading && <span>Loading…</span>}
    </>
  );
}`;

const SCHEMA = defineQuerySchema({ qualifiers: QUALIFIERS, braces: true });

const meta = {
  title: "ui/Hooks/useQueryCompletion",
  args: { enabled: true },
  argTypes: {
    enabled: {
      control: "boolean",
      description:
        "With `false` nothing is offered or fetched; `parts` are still parsed.",
    },
  },
  decorators: [withWidth("max-w-xl")],
} satisfies Meta<{ enabled: boolean }>;

export default meta;
type Story = StoryObj<{ enabled: boolean }>;

/**
 * `label:` answers at once from a snapshot provider; `assignee:` asks a search
 * provider after 150 ms of quiet and caches the answer per prefix.
 */
export const Usage: Story = {
  parameters: { docs: { source: { code: USAGE, language: "tsx" } } },
  render: function Render({ enabled }) {
    const [value, setValue] = useState("");
    const [caret, setCaret] = useState(0);
    const input = useRef<HTMLInputElement>(null);
    const { parts, completions, loading } = useQueryCompletion({
      schema: SCHEMA,
      value,
      caret,
      providers: PROVIDERS,
      enabled,
    });
    return (
      <div className="grid gap-3">
        <HighlightedInput
          aria-label="Search"
          placeholder="Try is:, label: or assignee:"
          inputRef={input}
          value={value}
          onValueChange={setValue}
          onCaretChange={(p) => setCaret(p.caret)}
          render={(text) => highlightQuery(text, parts, SCHEMA, PROVIDERS)}
        />
        <ul className="grid gap-1">
          {completions
            .flatMap((s) => s.rows)
            .map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="flex w-full items-baseline gap-2 rounded-md px-2 py-1 text-left hover:bg-muted"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const at = row.apply.caret;
                    setValue(row.apply.value);
                    setCaret(at);
                    requestAnimationFrame(() => {
                      input.current?.setSelectionRange(at, at);
                      input.current?.focus();
                    });
                  }}
                >
                  <code>{row.text}</code>
                  {row.hint && (
                    <span className="text-muted-foreground text-sm">
                      {row.hint}
                    </span>
                  )}
                </button>
              </li>
            ))}
        </ul>
        {loading && (
          <p className="text-muted-foreground text-sm">
            Asking the member search…
          </p>
        )}
        <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs">
          {JSON.stringify(parts, null, 2)}
        </pre>
      </div>
    );
  },
};

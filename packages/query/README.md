# @orz/query

The grammar half of a search box and a slash-command composer, driven by a schema the app supplies:
value specs, a query parser with diagnostics, a command registry and line parser, shell-style words,
brace expansion and completion locators.

It has no runtime dependencies and does not use React or the DOM, so an app's server, CLI and web
client can import the same module and read a query or a command line the same way. The React and
CodeMirror halves live in `@orz/ui` (`QueryBox`, `HighlightedInput`) and `@orz/ui-codemirror`.

## Install

```bash
pnpm add @orz/query
```

## Value specs

A qualifier value and a command argument are both a `ValueSpec`: an `enum` the schema knows, a
`named` value the app resolves through a provider (labels, members), or a `free` value. Providers
are passed at the point of use, so the schema itself stays static and shareable with a server:

```ts
import { valueVerdict } from "@orz/query";

const providers = {
  label: { options: [{ value: "kind:bug" }, { value: "area:web" }] },
  member: { search: (prefix, signal) => fetchMembers(prefix, signal) },
};

valueVerdict({ kind: "named", source: "label" }, "kind:bug", providers.label); // "valid"
```

## Queries

```ts
import { defineQuerySchema, parseQuery, queryFilters } from "@orz/query";

const schema = defineQuerySchema({
  qualifiers: {
    state: { value: { kind: "enum", values: ["open", "closed"] }, hint: "open or closed" },
    label: { value: { kind: "named", source: "label" } },
    assignee: { value: { kind: "named", source: "member", special: ["@me"] } },
  },
  braces: true,
});

const parts = parseQuery(schema, 'label:area:{web,ui} -state:closed "deploy failed"');
queryFilters(parts);
// [{ key: "label", negated: false, values: ["area:web", "area:ui"] },
//  { key: "state", negated: true, values: ["closed"] }]
```

Unknown keys are plain text, so `https://app.example` and `12:30` stay searchable. The parts tile
the input, which is what lets a highlighter paint under an `<input>`. `escapes: "shell"` switches
quoting to shell rules (`label:'a,b'`, `don\'t`); the default keeps backslashes ordinary.

## Slash commands

```ts
import { createCommandRegistry, parseCommandLines } from "@orz/query";

const registry = createCommandRegistry([
  {
    name: "close",
    detail: "→ Closed",
    args: [],
    summarize: () => "close",
    compile: () => ({ type: "close" }),
  },
  {
    name: "label",
    detail: "add labels",
    args: [{ name: "label", value: { kind: "named", source: "label" }, rest: true, multiple: true }],
    summarize: ([labels]) => `label ${[labels].flat().join(", ")}`,
    compile: ([labels]) => ({ type: "label", names: [labels].flat() }),
  },
]);

parseCommandLines("Looks done.\n/label {kind:bug,area:web}\n/close", registry, providers);
// body: "Looks done.", commands: [{ type: "label", … }, { type: "close" }]
```

A command is a whole line starting with `/name`; anything else, including `/close the door`, is
prose. Arguments are shell words, a `rest` argument takes the remainder of the line unquoted, and
brace expansion applies only to arguments declared `multiple`, which `compile` receives as a list.
A value with an `invalid` verdict, an unclosed quote or an expansion past 64 values breaks the line
before `compile` runs; the reason lands in `invalid`.

## Completion

`queryCompletionSlot` and `commandCompletionSlot` say what is being typed at the caret: a key, a
value, a command or an argument, with its extent and value spec. Inside a brace group the slot is
only the current alternative. `slotValues` lists what fits (or answers `"fetch"` for a `search`
provider), `keyRows` and `valueRows` turn a query slot into rows that carry the rewritten query,
and `orderRows` keeps the submit row first unless something is genuinely being completed.

## Building blocks

- `shellWords(text)` splits shell-style words, recording which characters were quoted;
  `quoteShellWord(value)` quotes a value so it reads back as one word.
- `expandBraces(word)` expands bash's comma form (`{a,b}`, nested, at most 64 words);
  quoted and escaped braces stay literal.
- `didYouMean(value, candidates)` suggests the closest candidate within a small edit distance.

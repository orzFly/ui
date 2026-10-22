# @orz/ui-codemirror

CodeMirror 6 editors themed by `@orz/ui`: a prose-first `CodeEditor` shell, a GFM `MarkdownEditor`,
the completion extensions they are assembled from, and the slash-command panel and highlight over
`@orz/query`'s command grammar.

## Install

```bash
pnpm add @orz/ui-codemirror @orz/ui react react-dom \
  @codemirror/state @codemirror/view @codemirror/language @codemirror/autocomplete \
  @codemirror/commands @codemirror/search @lezer/highlight
```

These are peer dependencies, so the app and the editors share one copy of each:

- `@orz/ui`: every editor registers itself with `useDirtySource` from `@orz/ui/lib/unsaved-guard`,
  a module-level registry. A second copy of `@orz/ui` would hold a second registry, and the app's
  navigation guard would never see an edited editor.
- CodeMirror and `@lezer/highlight`: you pass your own extensions into these editors, and
  CodeMirror checks extensions, facets and state fields by identity. A second `@codemirror/state`
  raises "Unrecognized extension value", a second `@codemirror/language` gives your `syntaxTree()`
  a different language facet, and a second `@lezer/highlight` gives your `tags` a different
  identity, so your `HighlightStyle` would silently colour nothing.

The markdown and JSON parsers (`@lezer/markdown`, `@lezer/json`) are ordinary dependencies. The
package does not use `@codemirror/lang-markdown`, which pulls in the HTML, JS and CSS parsers for
about 170 KB gzip.

## CSS

```css
@import "tailwindcss";
@import "@orz/ui/styles.css";
@import "@orz/ui-codemirror/styles.css";
```

Import it after `@orz/ui/styles.css`. The editor's host element is styled with the same Tailwind
utilities as `@orz/ui`'s `Textarea`, and the stylesheet registers `@source "./dist"` so Tailwind
finds them. Everything inside the editor is styled with `EditorView.theme` against `@orz/ui`'s CSS
variables. If you do not import the stylesheet, point Tailwind at the package yourself:

```css
@source "../node_modules/@orz/ui-codemirror/dist";
```

## Usage

### A markdown editor

```tsx
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@orz/ui-codemirror/components/markdown-editor";

const editor = useRef<MarkdownEditorHandle>(null);

<MarkdownEditor
  ref={editor}
  ariaLabel="Comment"
  placeholder="Write a comment…"
  onSubmit={(value) => send(value)}
  onCancel={() => close()}
  className="min-h-24 max-h-96"
/>;
```

The document lives in the EditorView, not in React state: read it through the handle or from
`onSubmit`, and keep `onChange` for cheap derived flags. Mod-Enter submits, Escape cancels, and
Alt-Enter inserts a blank line.

### Completion

```tsx
import type { CompletionSource } from "@codemirror/autocomplete";
import { EditorView } from "@codemirror/view";
import { completionWith } from "@orz/ui-codemirror/extensions/completion";
import { applyWithSpace } from "@orz/ui-codemirror/extensions/completion-space";

const mentions: CompletionSource = (context) => {
  const match = context.matchBefore(/@\w*$/);
  if (match === null) return null;
  return {
    from: match.from,
    options: [{ label: "@alice", type: "mention", apply: applyWithSpace("@alice") }],
  };
};

// Icons for your own completion types.
const icons = EditorView.theme({
  ".cm-completionIcon-mention::after": { content: "'@'", color: "var(--primary)" },
});

// Build this once (module scope or useMemo): a new identity reconfigures the editor and closes
// the open panel.
const extensions = [completionWith([mentions]), icons];

<MarkdownEditor extensions={extensions} />;
```

Pass every source through one `completionWith` call. It installs the only `autocompletion()` for
the editor, binds Tab only while a panel is open, adds the `<details>` tag template, and keeps the
space after an accepted row out of the way of punctuation typed next.

### Slash commands

The command grammar lives in `@orz/query`, a dependency of this package; these extensions are the
panel and the highlight on top of it.

```tsx
import {
  createCommandRegistry,
  parseCommandLines,
  type ValueProviders,
} from "@orz/query";
import {
  commandCompletionSource,
  commandDecoration,
} from "@orz/ui-codemirror/extensions/slash-commands";

type Action =
  | { type: "close" }
  | { type: "label"; name: string }
  | { type: "move"; status: string; assignee?: string };

const registry = createCommandRegistry<Action>([
  {
    name: "close",
    detail: "→ Done",
    args: [],
    summarize: () => "close",
    compile: () => ({ type: "close" }),
  },
  {
    name: "label",
    detail: "add a label",
    args: [{ name: "label", value: { kind: "named", source: "label" }, rest: true }],
    summarize: ([name]) => `label ${name}`,
    compile: ([name]) => ({ type: "label", name: String(name) }),
  },
  {
    name: "move",
    detail: "change status",
    args: [
      { name: "status", value: { kind: "named", source: "status" } },
      { name: "assignee", value: { kind: "named", source: "member" }, optional: true },
    ],
    summarize: ([status]) => `move to ${status}`,
    compile: ([status, assignee]) => ({
      type: "move",
      status: String(status),
      ...(assignee === undefined ? {} : { assignee: String(assignee) }),
    }),
  },
]);

// Snapshot lists, or `{ search: (prefix, signal) => … }` for a list too long to load.
let providers: ValueProviders = {
  label: { options: [{ value: "bug" }, { value: "docs" }] },
  status: { options: [{ value: "Todo" }, { value: "In Progress" }] },
  member: { options: undefined }, // still loading
};

// Getters, so a registry or providers built from data that arrives later need no reconfigure.
const getRegistry = () => registry;
const getProviders = () => providers;
const extensions = [
  completionWith([commandCompletionSource(getRegistry, getProviders)]),
  commandDecoration(getRegistry, getProviders),
];

<MarkdownEditor
  extensions={extensions}
  onSubmit={(value) => {
    const { body, commands, invalid } = parseCommandLines(value, registry, providers);
    // body: the text with every command line removed; commands: Action[].
  }}
/>;
```

A command is a whole line of the document. Lines inside fenced code are never commands, an unknown
`/word` stays prose, and a recognized line whose argument names nothing lands in `invalid` with a
reason. Arguments are shell words (`/move 'In Progress' alice`); see `@orz/query` for rest and
`multiple` arguments.

The panel offers the current argument's values, inserts a space and reopens for the next argument,
and leads with an `↵ end of command` row while every remaining argument is optional. A `search`
provider is asked per keystroke and the request is aborted when the next key arrives. The highlight
tints recognized lines, marks the name (`cm-command-name`) and each argument (`cm-command-arg`,
plus `-special` or `-invalid`), and redraws when the getters return a new registry or providers
object, so replace `providers` rather than mutating it.

### Provenance

`CodeEditorHandle.userChanged()` reports whether the reader changed the document since mount.
Mark your own writes so they do not count. `view` here is the `EditorView` that `CodeEditor`'s
`onView` hands out, or the one a command or `ViewPlugin` of yours receives:

```ts
import { PROGRAMMATIC_USER_EVENT } from "@orz/ui-codemirror/components/code-editor";

view.dispatch({ changes, userEvent: PROGRAMMATIC_USER_EVENT });
```

The handle's `setValue` and `append` are not marked, so they count as the reader's changes.

## Entry points

| Import | Contents |
|---|---|
| `@orz/ui-codemirror/components/code-editor` | `CodeEditor`, `CodeEditorHandle`, `CodeEditorProps`, `PROGRAMMATIC_USER_EVENT` |
| `@orz/ui-codemirror/components/markdown-editor` | `MarkdownEditor`, `MarkdownEditorHandle`, `MarkdownEditorProps`, `FileClipboardEvent`, `FileDragEvent`, `markdownLanguage`, `markdownHighlightStyle` |
| `@orz/ui-codemirror/extensions/<name>` | `code-context`, `completion`, `completion-space`, `json`, `slash-commands`, `tag-completion`, `trim-trailing-space` |
| `@orz/ui-codemirror/styles.css` | `@source "./dist"` |

There is no root entry, so a markdown-only app never reaches `@lezer/json` through an index file.

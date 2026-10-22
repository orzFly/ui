# @orz/ui-codemirror

CodeMirror 6 editors themed by `@orz/ui`: a prose-first `CodeEditor` shell, a GFM `MarkdownEditor`,
the completion extensions they are assembled from, and a slash-command engine.

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

```tsx
import {
  commandCompletionSource,
  commandDecoration,
} from "@orz/ui-codemirror/extensions/slash-commands";
import {
  createCommandRegistry,
  parseCommandLines,
} from "@orz/ui-codemirror/lib/slash-commands";

type Action = { type: "close" } | { type: "label"; name: string };
const labels = ["bug", "docs"];

const registry = createCommandRegistry<Action>([
  {
    name: "close",
    argument: "none",
    detail: "→ Done",
    summarize: () => "close",
    compile: () => ({ type: "close" }),
  },
  {
    name: "label",
    argument: "required",
    detail: "add a label",
    candidates: labels,
    summarize: (name) => `label ${name}`,
    compile: (name) => (labels.includes(name) ? { type: "label", name } : null),
  },
]);

// A getter, so a registry built from data that arrives later needs no reconfigure.
const getRegistry = () => registry;
const extensions = [
  completionWith([commandCompletionSource(getRegistry)]),
  commandDecoration(getRegistry),
];

<MarkdownEditor
  extensions={extensions}
  onSubmit={(value) => {
    const { body, commands, invalid } = parseCommandLines(value, registry);
    // body: the text with every command line removed; commands: Action[].
  }}
/>;
```

A command is a whole line of the document. Lines inside fenced code are never commands, an unknown
`/word` stays prose, and a recognized line whose argument names nothing lands in `invalid` with a
reason. The engine in `lib/slash-commands` imports nothing, so it can run on a server too.

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
| `@orz/ui-codemirror/lib/slash-commands` | the pure slash-command engine |
| `@orz/ui-codemirror/styles.css` | `@source "./dist"` |

There is no root entry, so a markdown-only app never reaches `@lezer/json` through an index file.

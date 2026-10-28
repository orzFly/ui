# @orz/ui-codemirror

CodeMirror 6 editors themed by `@orz/ui`: a prose-first `CodeEditor` shell, a GFM `MarkdownEditor`,
the completion extensions they are assembled from, and the slash-command panel and highlight over
`@orz/query`'s command grammar.

## Install

<!-- Generated from package.json by scripts/install.ts: run `pnpm fmt` after changing a peer. -->
```bash
pnpm add @orz/ui-codemirror @orz/query @orz/themes @orz/ui @codemirror/autocomplete \
  @codemirror/commands @codemirror/language @codemirror/search @codemirror/state @codemirror/view \
  @lezer/highlight lucide-react radix-ui react react-dom sonner
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
about 170 KB gzip. Neither is the HTML-to-Markdown converter a paste uses (`hast-util-from-dom`,
`hast-util-to-mdast`, `mdast-util-to-markdown`, `mdast-util-gfm`): it is a dynamic import, so a
bundler splits it into a chunk of its own, fetched once an editor is idle. `sonner` carries the
one message a paste can raise, through `@orz/ui`'s `Toaster`.

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

### Paste and quote

`MarkdownEditor` turns a formatted paste into Markdown, GitHub style: links, emphasis, lists,
tables and code survive, and a paste that is one line keeps only its inline formatting, so a copied
heading dropped into a sentence stays in it. Code copied out of an editor (VS Code's clipboard
type, or HTML that is all preformatted) goes in as plain text, with a fenced block on offer. After
a multi-line or formatted paste a toolbar under it switches the pasted range between Plain text
and Markdown and toggles Quote, one undo step per switch.

| Key | Does |
|---|---|
| Mod-V | Paste; formatting becomes Markdown |
| Mod-Shift-V | Paste as plain text |
| Mod-Alt-V | Paste as a quote |
| Mod-Alt-Shift-V | Paste plain text as a quote |
| Mod-. | Into the paste toolbar, right after a paste |
| Mod-Shift-. | Quote or unquote the selected lines, under every cursor |

No browser raises a paste event for Mod-Alt-V, so those keys read the clipboard themselves, and
say so in a toast when the browser refuses. A paste that beats the converter's chunk goes in as
plain text. `onPaste` sees every paste first; one it takes as files (`preventDefault`) is left
alone.

`EditorShortcutsHelp` is a keyboard button listing these keys, for a toolbar beside the editor,
with Apple's ⌘ ⌥ ⇧ on Apple platforms. Its list portals into the button's own subtree, so a box
that folds when focus leaves it stays open while the list is.

For an editor of your own, `pasteAs()` from `extensions/paste-as` is the toolbar and keys;
call its `handlePaste(view, event)` from your paste handler, and `prefetchPasteConverter()` once
the editor is up. `toggleQuote` and `blockquote` are in `extensions/quote-toggle`.

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
| `@orz/ui-codemirror/components/editor-shortcuts-help` | `EditorShortcutsHelp` |
| `@orz/ui-codemirror/components/markdown-editor` | `MarkdownEditor`, `MarkdownEditorHandle`, `MarkdownEditorProps`, `FileClipboardEvent`, `FileDragEvent`, `markdownLanguage`, `markdownHighlightStyle` |
| `@orz/ui-codemirror/extensions/<name>` | `code-context`, `completion`, `completion-space`, `json`, `paste-as`, `quote-toggle`, `slash-commands`, `tag-completion`, `trim-trailing-space` |
| `@orz/ui-codemirror/styles.css` | `@source "./dist"` |

There is no root entry, so a markdown-only app never reaches `@lezer/json` through an index file.

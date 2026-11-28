# @orz/ui-codemirror

CodeMirror 6 editors themed by `@orz/ui`: a prose-first `CodeEditor` shell, a GFM `MarkdownEditor`,
the completion extensions they are assembled from, and the slash-command panel and highlight over
`@orz/query`'s command grammar.

## Install

<!-- generated:install by scripts/readme.ts: run `pnpm fmt` after changing a peer -->
```bash
pnpm add @orz/ui-codemirror @orz/query @orz/themes @orz/ui @codemirror/autocomplete \
  @codemirror/commands @codemirror/language @codemirror/search @codemirror/state @codemirror/view \
  @lezer/highlight lucide-react radix-ui react react-dom sonner
```
<!-- /generated -->

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

`plain` mounts `PlainMarkdownEditor` instead, a native `Textarea` with the same handle, keys,
dirty tracking and paste and drop callbacks, and none of the CodeMirror extensions below. It is
read once, at mount, so a reader's choice of editor can be offered as a setting without an open
draft switching under them.

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

Two images with `→` or `->` between them, alone in a paragraph, are an image pair, which a
renderer that knows the convention shows as one comparison; the editor colours the arrow green.
After a paste or a drop that lands one image beside another lone image, a toolbar under it offers
to join them with an arrow (Mod-. reaches it). `imagePairs()` from `extensions/image-pairs` is
that, for an editor of your own; its toolbar wears `extensions/editor-toolbar`, as the paste
toolbar does.

For an editor of your own, `pasteAs()` from `extensions/paste-as` is the toolbar and keys;
call its `handlePaste(view, event)` from your paste handler, and `prefetchPasteConverter()` once
the editor is up. `toggleQuote` and `blockquote` are in `extensions/quote-toggle`.

### Staged files

```tsx
import { MarkdownEditor } from "@orz/ui-codemirror/components/markdown-editor";
import { stagedFileDrag, useStagedFiles } from "@orz/ui-codemirror/hooks/use-staged-files";

const staging = useStagedFiles({
  upload: (file) => uploadFile(file), // resolves to { url, filename? }
  withdraw: (uploaded) => deleteDraft(uploaded), // optional
});

<MarkdownEditor
  staging={staging.editor}
  onSubmit={async (text) => {
    send(await staging.resolve(text));
    staging.clear();
  }}
/>;
// staging.staged lists the files the text places; staging.stage(files) takes a file picker's.
```

A pasted, dropped or picked file goes into the text as `![name](staged:<key>)` (`[name](…)` for
a file that is not an image) where the reader put it, never inside code, a link, HTML, a table's
delimiter row or a line's quote, list or heading marks. The editor draws it as a chip with a space
on each side, which the caret steps over and Backspace takes whole, so an IME never composes into
it. The text is the record: deleting a placeholder unstages its file and undo brings it back, and
`remove(key)` takes every placeholder of a file out. Nothing is uploaded until `resolve`, which
calls your `upload` for each file the text places, once each, and returns the text pointing at the
uploads; a failure names its file, and a retry uploads only what has not gone up. `withdraw` hears
an upload the text no longer links. `stagedFileDrag(key)` makes a thumbnail draggable into the text
again, or into another editor on the page. A pasted screenshot's `image.png` is renamed after the
time it was pasted. With `plain`, the placeholder is plain text.

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

A row can draw more than a label: `completionWith`'s second argument takes CodeMirror's
`optionClass` and `addToOptions`. `reactOption(position, className, draw)` is an `addToOptions`
entry that renders a part with React, an `Avatar` say, and unmounts it once its row is gone. Return
`completionRowClass.drawn` from `optionClass` for a row whose part takes the type icon's place, or
`completionRowClass.face` for one whose part (a pill, a chip) shows the label itself.

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

An argument row is its value and its hint. To draw it as the app draws that value elsewhere, a
status as its pill or a person with their avatar, pass `argumentOption` in the third argument. It
gets each argument row once it is complete, with the option as its provider gave it (so whatever
else the app put on it is there), the command, which argument, and its spec; record the row for
`completionWith`'s `optionClass` and `addToOptions` to read and return it, or return a new row that
keeps its `label` and `apply`:

```tsx
const statuses = new WeakMap<Completion, Status>();

const extensions = [
  completionWith(
    [
      commandCompletionSource(getRegistry, getProviders, {
        argumentOption: (completion, { option, spec }) => {
          // The provider's own object: here, a status the app keeps its tone on.
          if (spec.kind === "named" && spec.source === "status") {
            statuses.set(completion, option as Status);
          }
          return completion;
        },
      }),
    ],
    {
      optionClass: (c) => (statuses.has(c) ? completionRowClass.face : ""),
      addToOptions: [
        reactOption(20, "cm-completionPill", (c) => {
          const status = statuses.get(c);
          return status === undefined ? null : <StatusPill status={status} />;
        }),
      ],
    },
  ),
  commandDecoration(getRegistry, getProviders),
];
```

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
| `@orz/ui-codemirror/components/plain-markdown-editor` | `PlainMarkdownEditor` |
| `@orz/ui-codemirror/components/markdown-editor` | `MarkdownEditor`, `MarkdownEditorHandle`, `MarkdownEditorProps`, `FileClipboardEvent`, `FileDragEvent`, `markdownLanguage`, `markdownHighlightStyle` |
| `@orz/ui-codemirror/extensions/<name>` | `code-context`, `completion`, `completion-space`, `composition-safe-measure`, `editor-toolbar`, `image-pairs`, `json`, `parked-tooltip`, `paste-as`, `quote-toggle`, `slash-commands`, `staged-token-atoms`, `staged-tokens`, `tag-completion`, `tooltip-space`, `trim-trailing-space` |
| `@orz/ui-codemirror/hooks/<name>` | `use-staged-files` |
| `@orz/ui-codemirror/styles.css` | `@source "./dist"` |

There is no root entry, so a markdown-only app never reaches `@lezer/json` through an index file.

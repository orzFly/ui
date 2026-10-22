# @orz/ui-hex

A virtualised hex view over any byte source, in memory or paged; an editor over the same sources
that keeps its edits in memory and exports the result; and a data inspector that interprets the
bytes at the selection. Colours come from `@orz/ui`'s theme tokens, so every theme gets a matching
selection.

## Install

```bash
pnpm add @orz/ui-hex @orz/ui react react-dom radix-ui lucide-react sonner
```

`@orz/ui`, `radix-ui` and React are peer dependencies; `lucide-react` and `sonner` are there because
`@orz/ui` declares them as its own peers. The encoding picker in the view's and the editor's header
is `@orz/ui`'s `Select`, and the inspector's endianness switch its `Switch`; both have to share the
app's radix copy.

## CSS

```css
@import "tailwindcss";
@import "@orz/ui/styles.css";
@import "@orz/ui-hex/styles.css";
```

Import it after `@orz/ui/styles.css`. The stylesheet is plain CSS, scoped under `.orz-hex` and
`.orz-hex-inspector`, and every colour in it is derived from the theme tokens through these
variables:

| Variable | Default |
|---|---|
| `--hex-font` | `var(--font-mono)`, then the system monospace fonts |
| `--hex-row-height` | `1.375rem` |
| `--hex-fill` | `color-mix(in oklch, var(--primary) 32%, var(--card))` |
| `--hex-edge` | `var(--primary)` |
| `--hex-twin-fill` | `color-mix(in oklch, var(--foreground) 6%, var(--card))` |
| `--hex-twin-edge` | `var(--muted-foreground)` |
| `--hex-hover` | `var(--accent)` |
| `--hex-label` | `var(--muted-foreground)` |
| `--hex-faded` | `color-mix(in oklch, var(--muted-foreground) 70%, transparent)` |
| `--hex-modified` | `var(--destructive)` |

The defaults are declared on `.orz-hex` and `.orz-hex-inspector` themselves, so they resolve
against whichever theme is active above them. To override one, target those elements:

```css
.my-dump :is(.orz-hex, .orz-hex-inspector) {
  --hex-row-height: 1.5rem;
  --hex-hover: var(--secondary);
}
```

The strong pair (`--hex-fill`, `--hex-edge`) marks the selection in the pane it was made in while
the view has focus; the twin pair marks it in the other pane, and in both once focus leaves.
`--hex-modified` colours the glyphs of bytes that came from editing, in `HexEditor` only; selection
and hover draw over it as usual.

### Font

The stylesheet loads no font. Any monospace font works. Control codes are drawn as two small
stacked letters (`NU`, `LF`, `CR`, …) rather than the U+2400 control pictures, so the grid stays
aligned in fonts that lack them, which is every webfont subset on fontsource. To use JetBrains Mono:

```ts
import "@fontsource-variable/jetbrains-mono";
```

```css
/* after the @orz/ui-hex/styles.css import */
.orz-hex,
.orz-hex-inspector {
  --hex-font: "JetBrains Mono Variable", monospace;
}
```

## Byte sources

Every component reads through a `ByteSource`, the editor through a document that is one itself:

```ts
interface ByteSource {
  /** Total length in bytes; read again after every change notification. */
  readonly size: number;
  /** Exactly min(length, size - offset) bytes, sync or as a promise. */
  read(offset: number, length: number, signal?: AbortSignal): Uint8Array | Promise<Uint8Array>;
  /** The bytes when they are at hand with no I/O, else undefined; never starts a read. */
  peek?(offset: number, length: number): Uint8Array | undefined;
  /** Content or size changed: the view drops its cache and re-reads what is visible. */
  subscribe?(onChange: () => void): () => void;
}
```

The size must be known up front, because it sets the scroll extent. A source that holds bytes in
memory can answer `peek`, and a view then redraws from it at once after a change instead of showing
placeholders while it re-reads. `createHexDocument` reads zero bytes at offset 0 when it is created,
to tell a sync source from an async one, so a zero-length read has to return at once without I/O.

In memory, reads are subarrays and nothing is copied or cached:

```ts
import { bytesSource } from "@orz/ui-hex";

const source = bytesSource(new Uint8Array(await file.arrayBuffer()));
```

A `File` or any other `Blob` is read on demand, in 64 KiB pages:

```ts
import { blobSource } from "@orz/ui-hex";

const source = blobSource(file);
```

Anything else is a source of your own. Over HTTP range requests:

```ts
import type { ByteSource } from "@orz/ui-hex";

async function httpSource(url: string): Promise<ByteSource> {
  const head = await fetch(url, { method: "HEAD" });
  const size = Number(head.headers.get("content-length"));
  return {
    size,
    async read(offset, length, signal) {
      if (length <= 0 || offset >= size) return new Uint8Array(0);
      const end = Math.min(size, offset + length) - 1;
      const response = await fetch(url, {
        headers: { Range: `bytes=${offset}-${end}` },
        signal,
      });
      if (response.status !== 206) throw new Error(`HTTP ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    },
  };
}

const source = await httpSource("https://app.example/dumps/core.bin");
```

The view asks for whole pages, shares one request between the rows that need a page, keeps up to
256 pages (16 MiB), and aborts the `signal` of a page that has scrolled more than a page out of
view. A failed page renders `??`, is not cached, and is asked for again when it next comes into
view; `onReadError(error, offset)` reports each failure. A `HexDocument` over an async source keeps
a page cache of the same size of its own, which survives edits, so an editor over a paged source
can hold up to twice that.

## `HexView` and `HexInspector`

```tsx
import { bytesSource, HexInspector, type HexSelection, HexView } from "@orz/ui-hex";

function Dump({ bytes }: { bytes: Uint8Array }) {
  const source = useMemo(() => bytesSource(bytes), [bytes]);
  const [selection, setSelection] = useState<HexSelection | null>(null);
  return (
    <div style={{ display: "flex", gap: "1.5rem", height: 480 }}>
      <HexView source={source} selection={selection} onSelectionChange={setSelection} />
      <HexInspector source={source} selection={selection} />
    </div>
  );
}
```

Keep the source's identity stable: a new source object drops the view's cache.

A selection is `{ anchor, focus, pane }`, inclusive at both ends, so `anchor === focus` is one
selected byte; `null` is nothing. `pane` is `"hex"` or `"text"`, the pane the selection was made
in.

### `HexView` props

| Prop | Default | |
|---|---|---|
| `source` | | The bytes |
| `selection`, `onSelectionChange` | | Controlled selection |
| `defaultSelection` | `null` | Uncontrolled selection |
| `columns` | `16` | Bytes per row |
| `groupSize` | `8` | Bytes between group gaps; `0` for none |
| `baseAddress` | `0` | Added to displayed addresses, never to offsets |
| `rows` | | A fixed viewport height in rows; omitted, the view fills its parent's height |
| `showAddresses`, `showColumnLabels`, `showText`, `showStatusBar` | `true` | |
| `uppercase` | `true` | Hex digit case |
| `fadeZeroBytes` | `true` | Fades `00` |
| `controlCodes` | `"abbreviations"` | Or `"dots"` |
| `encoding`, `onEncodingChange` | | Controlled text-pane encoding (below) |
| `defaultEncoding` | `"ascii"` | Uncontrolled text-pane encoding |
| `showEncodingPicker` | `true` | The encoding picker in the text pane's header |
| `onCopy` | | Reports each copy (below) |
| `onReadError` | | `(error, offset)` per failed page |
| `ref` | | `{ scrollToOffset(offset, align?), focus() }`; `align` is `"nearest"`, `"start"` or `"center"` |
| `className`, `aria-label` | `"Hex view"` | |

Without `rows`, give the parent a definite height. Above roughly 13 MiB at 16 columns the content
is taller than browsers let an element be; the view then maps the scrollbar onto rows and moves a
few rows per wheel notch, so dragging the scrollbar becomes coarse but the wheel and keyboard stay
precise.

### `HexInspector` props

| Prop | Default | |
|---|---|---|
| `source`, `selection` | | Usually the view's |
| `littleEndian`, `onLittleEndianChange` | | Controlled endianness |
| `defaultLittleEndian` | `true` | Uncontrolled endianness |
| `className` | | |

It reads up to 8 bytes at the selection start and shows them as binary, Int8 to Int64, Uint8 to
Uint64, Float16, Float32 and Float64. A row wider than the selection is dimmed but still shows the
value read from the bytes after it; `—` marks a value that would run past the end of the source.

## Keyboard and copy

| Key | Moves the caret |
|---|---|
| ← / → | one byte |
| ↑ / ↓ | one row |
| PageUp / PageDown | one viewport |
| Home / End | start / end of the row |
| Ctrl/⌘ + Home / End | start / end of the source |
| Ctrl/⌘ + A | selects everything |
| Escape | clears the selection |

Shift extends the selection from its anchor. Tab leaves the view; clicking in the other pane
switches panes, and a drag may cross from one pane into the other.

Copy (Ctrl/⌘ + C, or the browser menu) writes the selection as space-separated hex pairs from the
hex pane, or as the text pane shows it from the text pane, up to 1 MiB. When
the bytes are not all loaded, the view reads them and writes through `navigator.clipboard`.
`onCopy` receives `{ ok: true, bytes }`, or `{ ok: false, reason }` with `"too-large"`,
`"read-failed"` or `"clipboard-unavailable"`; the view shows no toast itself. `copyText`,
`hexByte`, `formatSize` and the other formatters are exported for copy actions of your own;
`copyText` writes the text pane's form in ASCII only, whatever the view's encoding.

## Encodings

The text pane decodes its bytes in one of these encodings, ASCII by default:

| Group | Encodings |
|---|---|
| Western | ASCII, ISO-8859-1, Windows-1252 |
| Unicode | UTF-8, UTF-16LE, UTF-16BE |
| East Asian | Shift_JIS, EUC-JP, GB18030 (which covers GBK), Big5, EUC-KR |
| Other | Windows-1250, 1251, 1253–1258; ISO-8859-2 to -8, -10, -13 to -16; KOI8-R, KOI8-U; IBM866; Macintosh |

The ids are the [Encoding Standard](https://encoding.spec.whatwg.org/) names (`"utf-8"`,
`"shift_jis"`, `"windows-1251"`, …), typed as `HexEncoding`. Which of them a runtime supports depends
on its `TextDecoder`: `HEX_ENCODINGS` lists the supported ones, each with its `id`, picker `label` and
`group`, in picker order. Node, for one, lacks ISO-8859-16. An id the runtime lacks renders as ASCII
and logs one warning.

The picker sits in the text pane's header. Hide it with `showEncodingPicker={false}`, and the header
shows the encoding's name instead; with no header (`showColumnLabels={false}`) or no text pane, the
prop alone sets the encoding. A controlled `encoding` without `onEncodingChange` makes the picker
change nothing. To pass a detected charset through:

```tsx
import { HEX_ENCODINGS, type HexEncoding, HexView } from "@orz/ui-hex";

function encodingFor(charset: string | undefined): HexEncoding {
  const id = charset?.toLowerCase();
  return HEX_ENCODINGS.find((info) => info.id === id)?.id ?? "utf-8";
}

<HexView source={source} defaultEncoding={encodingFor(detectedCharset)} />;
```

A multi-byte character is drawn once, centred over its bytes; one that crosses the end of a row is
drawn on its starting row, squeezed into the cells left there. Bytes that do not decode, control
codes and characters with no glyph of their own (format characters, combining marks, private use)
show as faded dots, as in ASCII.

- **Selection** stays per byte in both panes, so a selection may end inside a character.
- **Hover** lights up every byte of the character under the pointer, in both panes.
- **Copy** from the text pane writes what is shown: a character whose first byte is selected is
  copied whole, one whose first byte lies before the selection is left out, and every dot is `.`.

Wide characters fall back to the platform's CJK fonts when `--hex-font` lacks them; how well they
look depends on the fonts the reader has installed.

## Editing

`HexEditor` edits a `HexDocument`: a piece table over a `ByteSource` that never writes to the
source. Edits stay in the document until the app saves them.

```tsx
import {
  blobSource,
  createHexDocument,
  type HexDocument,
  HexEditor,
  useHexDocumentState,
} from "@orz/ui-hex";
import { useMemo } from "react";

function Editor({ file }: { file: File }) {
  const doc = useMemo(() => createHexDocument(blobSource(file)), [file]);
  const { dirty, canUndo, canRedo } = useHexDocumentState(doc);
  return (
    <>
      <button type="button" disabled={!canUndo} onClick={() => doc.undo()}>Undo</button>
      <button type="button" disabled={!canRedo} onClick={() => doc.redo()}>Redo</button>
      <button type="button" disabled={!dirty} onClick={() => download(doc, file.name)}>Save</button>
      <HexEditor document={doc} rows={24} />
    </>
  );
}

async function download(doc: HexDocument, name: string) {
  const url = URL.createObjectURL(await doc.toBlob("application/octet-stream"));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
  doc.markSaved();
}
```

Keep the document's identity stable, as with a source: a new document starts with no edits and no
history. A document is itself a `ByteSource`, so a `HexInspector` given the same document and
selection follows the edits, and a `HexView` can show it read-only, without the modified colour.

### `HexDocument`

`createHexDocument(source, { resizable })` takes `resizable: false` to lock the size: then there is
no insert mode, Delete, Backspace and cut do nothing, and typing and pasting stop at the last byte.

| Member | |
|---|---|
| `size`, `read`, `peek`, `subscribe` | The edited bytes, as a `ByteSource` |
| `source`, `resizable` | What it was created with |
| `replace(offset, length, bytes)` | Replaces `length` bytes at `offset` |
| `insert(offset, bytes)`, `delete(offset, length)` | `replace` with length 0, or with no bytes |
| `overwrite(offset, bytes)` | Writes from `offset`; past the end it extends the document, or stops at the end when the size is locked |
| `undo()`, `redo()`, `canUndo`, `canRedo` | |
| `dirty`, `markSaved()` | |
| `modifiedRanges(offset, length)` | The bytes in the range that came from editing, as `[start, end)` pairs |
| `pieces()`, `toBlob(type?)`, `stream()` | Export (below) |

- **Bounds:** offsets and lengths are clamped to the document. A call left with nothing to remove
  and nothing to write records no undo step; one that writes the bytes already there is still an
  edit, with a step, the dirty state and the modified colour. With the size locked, a `replace`,
  `insert` or `delete` that would change the size throws a `RangeError`; `HexEditor` never makes one.
- **Undo:** each call is one step, and so is each editor keystroke, except that a run of typing is
  one step until the caret moves, the mode or pane changes, or the user pastes, deletes or saves.
  Depth is unlimited. A step stores no source bytes, so undoing an overwrite far into a paged source
  reads nothing. An edit after an undo drops the redo steps.
- **Memory:** every byte written is kept for the document's lifetime, undone and dropped edits
  included, so it grows with the total amount edited. A new document over the saved bytes starts
  empty.
- **Selection:** a step made in the editor records the selection before and after it, and the
  editor restores it on undo and redo, including when the app calls `doc.undo()` from a toolbar.
  After the app's own calls the editor only clamps its selection to the new size.
- **Dirty:** `markSaved()` records the current undo position; the document is dirty while its
  position differs, so undoing back to the save point makes it clean again. A save point lost to a
  dropped redo branch keeps the document dirty until the next `markSaved()`.
- **Modified colour:** it marks bytes that were written, so a deletion leaves no mark, and a
  document whose only edits are deletions is dirty with nothing coloured. `markSaved()` keeps it; a
  byte loses it only when its edit is undone. For a clean slate after saving, create a new document
  over the saved bytes.
- **Source changes:** the source must not change while a document is open over it. A change it
  notifies is passed on, so views re-read, but the document's pieces still point at the old
  offsets. Create a new document over the changed source instead.

Export takes a snapshot of the document when called, so edits made while it runs do not reach it:

- **`toBlob(type?)`** slices the source's `blob` when it has one, as a `blobSource` does, and takes
  subarrays of its `bytes`, as a `bytesSource`'s, reading nothing; so a multi-gigabyte `File` with a
  few edits exports at once. A source of your own gets the same path by exposing a `blob` or `bytes`
  property holding exactly its content. Any other source is read in 1 MiB chunks, all held in
  memory until the `Blob` is built, and a failed read rejects; for a large one, use `stream()`.
- **`stream()`** is a pull-based `ReadableStream`, for a `FileSystemWritableFileStream` or an
  upload. Each pull yields one run of edited bytes or the next 1 MiB of the source, so a slow
  consumer never holds more than a chunk. Cancelling it aborts the read in flight.
- **`pieces()`** lists the document in order, as `{ kind: "source", offset, length }` ranges of the
  source and `{ kind: "bytes", bytes }` runs of edited bytes. To write back only what changed, check
  that every `source` piece's `offset` equals the document offset where it starts, which always
  holds with the size locked; an insert and a delete elsewhere keep the size but move the bytes
  between them, and then the whole document has to be written. The `bytes` are views onto the
  document's own buffer, so do not write to them.

`useHexDocumentState(doc)` returns `{ size, dirty, canUndo, canRedo }` for a toolbar or a title, as
a new object only after the document changes.

### `HexEditor` props

Every `HexView` prop except `source`, and:

| Prop | Default | |
|---|---|---|
| `document` | | From `createHexDocument`; anything else throws a `TypeError` |
| `mode`, `onModeChange` | | Controlled mode, `"overwrite"` or `"insert"` |
| `defaultMode` | `"overwrite"` | Uncontrolled mode |
| `readOnly` | `false` | Refuses every edit from the keyboard, paste, cut and the mode button; navigation and copy still work, and edits the app makes to the document still show |
| `onPaste` | | Reports each paste (below) |
| `aria-label` | `"Hex editor"` | |

The `ref` is the same handle as `HexView`'s. On a document with a locked size the mode is always
overwrite.

The status bar shows an `OVR`/`INS` button before the size. It toggles the mode, as the Insert key
does, and is disabled when the size is locked or the editor is `readOnly`. Mac laptops have no
Insert key, so an app that hides the status bar puts its own toggle on `mode`.

While the editor has focus, the caret in the hex pane underlines the digit the next keystroke
writes. In insert mode it is a bar before the byte, where the next byte goes, except after a new
byte's first digit, when it underlines the second. In the text pane it underlines the whole cell,
or is a bar in insert mode.

A resizable document gets one empty cell after its last byte, `readOnly` or not. The caret reaches
it like any other cell, by click or by key, and typing there appends; copy, cut, Delete and
Ctrl/⌘ + A leave it out. So in a resizable document a selection's `focus` can equal `size`: clamp
to `size - 1` before counting bytes. An empty document shows only that cell, and an empty one with
a locked size shows nothing.

A hex-pane selection in the editor also carries `nibble`, `0` or `1`, the digit the next keystroke
writes. A controlled selection has to pass it back unchanged, or the caret jumps back to the high
digit in the middle of a byte.

### Editing keys

Navigation, selection and copy work as in [Keyboard and copy](#keyboard-and-copy). On top of them:

| Key | Overwrite mode | Insert mode |
|---|---|---|
| Hex digit, hex pane | Sets the digit under the caret, keeping the other; the caret moves to the next digit | The first digit inserts a byte before the caret, its low digit 0; the second sets that digit |
| Character, text pane | Writes its bytes from the caret | Inserts its bytes before the caret |
| Delete | Deletes the selection, or the byte under the caret | Same |
| Backspace | Deletes a selection of several bytes; at a byte's second hex digit, moves back to its first; else deletes the byte before the caret | Same |
| Insert | Toggles the mode | Same |
| Ctrl/⌘ + Z | Undo | Same |
| Ctrl/⌘ + Shift + Z, Ctrl/⌘ + Y | Redo | Same |
| Ctrl/⌘ + X | Cut (below) | Same |
| Ctrl/⌘ + V | Paste (below) | Same |

- **The mode governs typing and paste only.** Delete, Backspace and cut remove bytes in both modes,
  so overwrite mode still has a way to remove a byte from the keyboard.
- **Delete and Backspace work on bytes**, in the text pane too: one Backspace after a multi-byte
  character removes only its last byte, while undo takes back whole keystrokes.
- **Typing over a selection of several bytes** replaces it in insert mode, as one undo step; in
  overwrite mode it writes from the selection's start. With the size locked, a character typed too
  near the end is cut off there, so only part of a multi-byte character may be written.
- **A byte still loading or failed to read** counts as 0 when a typed digit keeps its other digit.
  Nothing waits for the read.
- **Cut** copies the selection as a copy does and deletes it only once the copy succeeds, so a
  selection over 1 MiB, or a copy that fails, deletes nothing and reports through `onCopy`. From
  the text pane it copies what the pane shows, dots included, which pastes back as `2E` bytes; cut
  from the hex pane to move bytes. With the size locked or `readOnly`, cut neither copies nor
  reports.
- **Keys that do nothing:** typing, Delete, Backspace and cut while nothing is selected (undo, redo
  and Insert still work); a character that is not a hex digit, in the hex pane; any editing key
  when `readOnly`.
- **Modifiers:** keys held with Ctrl, ⌘ or Alt never type, though AltGr does. Browsers report a
  Mac's Option as Alt, so characters a Mac layout types with Option do not type either.
- **Input methods:** typing comes from `keydown`, so IME composition, for CJK text say, is not
  supported. Paste such text instead.

### Typed and pasted text

The text pane's `encoding` (see [Encodings](#encodings)) also chooses what typed and pasted text is
written as. The default is ASCII, so until the encoding changes, a non-ASCII character typed into
the text pane does nothing and a paste containing one is refused as `"unencodable"`. The same holds
for any character the encoding cannot represent, and for a lone surrogate in every encoding. A paste
is all or nothing: one unencodable character refuses the whole text.

The East Asian encoders build their tables in idle time whenever an editor becomes editable (on
mount without `readOnly`, or when `readOnly` turns off) or its encoding changes, so the first
keystroke does not wait for them.

### Paste

Paste runs on the native `paste` event while the editor has focus, so Ctrl/⌘ + V, Shift + Insert
and a menu bar's Paste reach it; a right-click menu usually offers no Paste over the grid. It reads
the clipboard's plain text. With nothing selected it does nothing and does not call `onPaste`, and
a paste into the encoding picker stays native.

- **Hex pane:** the text is read as a hex dump. Whitespace, commas, semicolons, brackets, braces,
  parentheses and every `0x` / `\x` are dropped, so `89 50 4E 47`, `0x89, 0x50`, `{ 0x89, 0x50 }`,
  `\x89\x50` and `89504e47` all paste. The remaining digits are joined and read two at a time, so
  each byte needs both its digits: `0x5, 0x1` pastes the one byte `51`. `parseHexText` is the same
  parser, for a paste command of your own.
- **Text pane:** the text is encoded, as above.
- **Insert mode:** the bytes replace a selection of several bytes, or go in before the caret.
- **Overwrite mode:** the bytes overwrite from the selection's start. Past the end they extend the
  document; with the size locked they are cut off at the end.

The caret lands after the last pasted byte, or on the last byte when the size is locked and the
paste reaches the end, and the paste is one undo step. `onPaste` receives
`{ ok: true, bytes, truncated }`, where `bytes` counts what was written and `truncated` says the end
was cut off, or `{ ok: false, reason }`; the editor shows no toast itself.

| Reason | |
|---|---|
| `"not-hex"` | The hex pane's text has something besides hex digits and separators, or an odd number of digits |
| `"unencodable"` | The text pane's encoding cannot represent a character in it |
| `"empty"` | The clipboard has no plain text, or only separators |
| `"read-only"` | The editor is `readOnly` |

An app that wants separate paste-insert and paste-overwrite commands calls the document's `insert`
or `overwrite` itself, because the `paste` event carries no modifier keys.

## Entry points

| Import | Contents |
|---|---|
| `@orz/ui-hex` | `HexView`, `HexEditor`, `HexInspector`, `createHexDocument`, `useHexDocumentState`, `HEX_ENCODINGS`, `bytesSource`, `blobSource`, `parseHexText`, `copyText`, `hexByte`, `formatAddress`, `formatOffset`, `formatSize`, `addressDigits`, `MAX_COPY_BYTES`, types |
| `@orz/ui-hex/styles.css` | the view, editor and inspector styles |

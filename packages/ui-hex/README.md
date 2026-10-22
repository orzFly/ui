# @orz/ui-hex

A virtualised hex view over any byte source, in memory or paged, and a data inspector that
interprets the bytes at the selection. Colours come from `@orz/ui`'s theme tokens, so every theme
gets a matching selection.

## Install

```bash
pnpm add @orz/ui-hex @orz/ui react react-dom radix-ui lucide-react sonner
```

`@orz/ui`, `radix-ui` and React are peer dependencies; `lucide-react` and `sonner` are there because
`@orz/ui` declares them as its own peers. The inspector's endianness switch is `@orz/ui`'s
`Switch`, which has to share the app's radix copy.

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

Both components read through a `ByteSource`:

```ts
interface ByteSource {
  /** Total length in bytes; read again after every change notification. */
  readonly size: number;
  /** Exactly min(length, size - offset) bytes, sync or as a promise. */
  read(offset: number, length: number, signal?: AbortSignal): Uint8Array | Promise<Uint8Array>;
  /** Content or size changed: the view drops its cache and re-reads what is visible. */
  subscribe?(onChange: () => void): () => void;
}
```

The size must be known up front, because it sets the scroll extent.

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
view; `onReadError(error, offset)` reports each failure.

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
hex pane, or as printable ASCII with `.` for every other byte from the text pane, up to 1 MiB. When
the bytes are not all loaded, the view reads them and writes through `navigator.clipboard`.
`onCopy` receives `{ ok: true, bytes }`, or `{ ok: false, reason }` with `"too-large"`,
`"read-failed"` or `"clipboard-unavailable"`; the view shows no toast itself. `copyText`,
`hexByte`, `formatSize` and the other formatters are exported for copy actions of your own.

## Entry points

| Import | Contents |
|---|---|
| `@orz/ui-hex` | `HexView`, `HexInspector`, `bytesSource`, `blobSource`, `copyText`, `hexByte`, `formatAddress`, `formatOffset`, `formatSize`, `addressDigits`, `MAX_COPY_BYTES`, types |
| `@orz/ui-hex/styles.css` | the view and inspector styles |

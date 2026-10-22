import { createPageCache } from "./page-cache.ts";
import type { ByteSource } from "./source.ts";
import type { HexSelection } from "./types.ts";

export interface HexDocumentOptions {
  /** false locks the size: no insert mode, no delete or cut, no typing or pasting past the end. Default true. */
  resizable?: boolean;
}

export type HexPiece =
  /** A range of the original source. */
  | { kind: "source"; offset: number; length: number }
  /** Bytes that came from editing; a view onto the document's own buffer. */
  | { kind: "bytes"; bytes: Uint8Array };

export interface HexDocument extends ByteSource {
  readonly source: ByteSource;
  readonly resizable: boolean;
  /** The undo position differs from the one `markSaved()` recorded. */
  readonly dirty: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;

  peek(offset: number, length: number): Uint8Array | undefined;
  subscribe(onChange: () => void): () => void;

  /** Replace `length` bytes at `offset` with `bytes`; insert is length 0, delete is empty bytes. */
  replace(offset: number, length: number, bytes: Uint8Array): void;
  insert(offset: number, bytes: Uint8Array): void;
  /** Writes over the bytes from `offset`; past the end it extends the document, or stops there when the size is locked. */
  overwrite(offset: number, bytes: Uint8Array): void;
  delete(offset: number, length: number): void;
  undo(): void;
  redo(): void;
  markSaved(): void;

  /** Ranges in [offset, offset + length) whose bytes came from editing, as [start, end) pairs. */
  modifiedRanges(offset: number, length: number): Array<[number, number]>;

  pieces(): HexPiece[];
  toBlob(type?: string): Promise<Blob>;
  stream(): ReadableStream<Uint8Array>;
}

interface Piece {
  buffer: "source" | "add";
  start: number;
  length: number;
}

/** Undone by putting `removed` back at `index` in place of `inserted`. */
interface SpliceRecord {
  index: number;
  removed: Piece[];
  inserted: Piece[];
}

type EditKey = "type-hex" | "type-text";

interface Step {
  id: number;
  records: SpliceRecord[];
  before?: HexSelection | null;
  after?: HexSelection | null;
  /** Edits with the same key that continue at `end` join this step. */
  key?: EditKey;
  end: number;
}

export type HexDocumentChange =
  | { kind: "edit" }
  /** Saved, or the source changed underneath: nothing to restore. */
  | { kind: "other" }
  | { kind: "undo" | "redo"; selection: HexSelection | null | undefined };

export interface DocumentEdit {
  offset: number;
  length: number;
  bytes: Uint8Array;
  key?: EditKey;
  before?: HexSelection | null;
  after?: HexSelection | null;
}

interface Internals {
  edit(edit: DocumentEdit): void;
  group(fn: () => void): void;
  breakRun(): void;
  lastChange: HexDocumentChange;
  version: number;
}

// Also the brand: a document is whatever createHexDocument registered here.
const internals = new WeakMap<object, Internals>();

const ADD_CHUNK = 64 * 1024;
const EXPORT_CHUNK = 1 << 20;

function abortError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("Aborted", "AbortError");
}

/** The buffer edits append to. Bytes once written are never rewritten, so pieces, undo steps and exports share it. */
function createAddBuffer() {
  const chunks: Uint8Array[] = [];
  const starts: number[] = [];
  let fill = 0;
  let end = 0;

  const chunkAt = (at: number) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((starts[mid] as number) <= at) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  return {
    /** Where `bytes` now live; always inside one chunk. */
    append(bytes: Uint8Array): number {
      let chunk = chunks.at(-1);
      if (!chunk || chunk.length - fill < bytes.length) {
        const start = chunk ? (starts.at(-1) as number) + chunk.length : 0;
        chunk = new Uint8Array(Math.max(ADD_CHUNK, bytes.length));
        chunks.push(chunk);
        starts.push(start);
        fill = 0;
      }
      chunk.set(bytes, fill);
      const at = (starts.at(-1) as number) + fill;
      fill += bytes.length;
      end = at + bytes.length;
      return at;
    },

    /** A view when the range sits in one chunk, else a copy. */
    read(start: number, length: number): Uint8Array {
      const i = chunkAt(start);
      const chunk = chunks[i] as Uint8Array;
      const at = start - (starts[i] as number);
      if (at + length <= chunk.length) return chunk.subarray(at, at + length);
      const out = new Uint8Array(length);
      let done = 0;
      for (let c = i; done < length; c++) {
        const from = c === i ? at : 0;
        const part = (chunks[c] as Uint8Array).subarray(
          from,
          from + length - done,
        );
        out.set(part, done);
        done += part.length;
      }
      return out;
    },

    get end() {
      return end;
    },
  };
}

function prefixEnds(pieces: readonly Piece[]): number[] {
  const ends = new Array<number>(pieces.length);
  let at = 0;
  for (let i = 0; i < pieces.length; i++) {
    at += (pieces[i] as Piece).length;
    ends[i] = at;
  }
  return ends;
}

/** The index of the piece holding byte `offset`; `pieces.length` at the end. */
function pieceAt(ends: readonly number[], offset: number): number {
  let lo = 0;
  let hi = ends.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((ends[mid] as number) > offset) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

function applySplice(
  pieces: readonly Piece[],
  index: number,
  remove: number,
  insert: readonly Piece[],
): Piece[] {
  return [
    ...pieces.slice(0, index),
    ...insert,
    ...pieces.slice(index + remove),
  ];
}

/** The record replacing [offset, offset + length) with `piece`, or nothing. */
function spliceRecord(
  pieces: readonly Piece[],
  ends: readonly number[],
  offset: number,
  length: number,
  piece: Piece | undefined,
): SpliceRecord {
  let index = pieceAt(ends, offset);
  const pieceStart = (i: number) => (i === 0 ? 0 : (ends[i - 1] as number));
  const end = offset + length;
  const startsInside = index < pieces.length && pieceStart(index) < offset;
  const last =
    length > 0 ? pieceAt(ends, end - 1) + 1 : startsInside ? index + 1 : index;
  const removed = pieces.slice(index, last);
  const inserted: Piece[] = [];

  if (startsInside) {
    const first = pieces[index] as Piece;
    inserted.push({ ...first, length: offset - pieceStart(index) });
  }
  if (piece) {
    const prev = inserted.at(-1) ?? (index > 0 ? pieces[index - 1] : undefined);
    if (
      prev &&
      prev.buffer === "add" &&
      piece.buffer === "add" &&
      prev.start + prev.length === piece.start
    ) {
      const merged = { ...prev, length: prev.length + piece.length };
      if (inserted.length) inserted[inserted.length - 1] = merged;
      else {
        // The piece before the edit grows, so it moves into the record.
        index--;
        removed.unshift(prev);
        inserted.push(merged);
      }
    } else {
      inserted.push(piece);
    }
  }
  if (last > 0 && last - 1 >= index && removed.length) {
    const tail = pieces[last - 1] as Piece;
    const tailEnd = ends[last - 1] as number;
    if (tailEnd > end) {
      inserted.push({
        ...tail,
        start: tail.start + tail.length - (tailEnd - end),
        length: tailEnd - end,
      });
    }
  }
  return { index, removed, inserted };
}

export function createHexDocument(
  source: ByteSource,
  { resizable = true }: HexDocumentOptions = {},
): HexDocument {
  const add = createAddBuffer();
  let pieces: Piece[] =
    source.size > 0
      ? [{ buffer: "source", start: 0, length: source.size }]
      : [];
  let ends = prefixEnds(pieces);

  const undoStack: Step[] = [];
  const redoStack: Step[] = [];
  let nextId = 1;
  let savedId = 0;
  let group: { step: Step | undefined } | undefined;
  let changedInGroup = false;

  // Source reads go through a cache keyed by source offsets, which no edit
  // moves, so it stays valid across edits. It reads a sync source in place,
  // and learns which kind it has from the first real read: probing at
  // creation would be a request of its own, and a zero-length one at that.
  const cache = createPageCache(source);

  const listeners = new Set<() => void>();
  let unsubscribeSource: (() => void) | undefined;

  const state: Internals = {
    edit: (edit) => editDocument(edit),
    group(fn) {
      if (group) {
        fn();
        return;
      }
      group = { step: undefined };
      changedInGroup = false;
      try {
        fn();
      } finally {
        group = undefined;
        if (changedInGroup) notify();
      }
    },
    breakRun() {
      const top = undoStack.at(-1);
      if (top) top.key = undefined;
    },
    lastChange: { kind: "edit" },
    version: 0,
  };

  const notify = () => {
    state.version++;
    if (group) {
      changedInGroup = true;
      return;
    }
    for (const listener of [...listeners]) listener();
  };

  const size = () => (ends.at(-1) as number | undefined) ?? 0;

  /** The pieces' parts covering [offset, end), in order. */
  const segments = (offset: number, end: number) => {
    const out: Array<{ piece: Piece; from: number; length: number }> = [];
    let i = pieceAt(ends, offset);
    let at = offset;
    while (at < end && i < pieces.length) {
      const piece = pieces[i] as Piece;
      const pieceStart = (ends[i] as number) - piece.length;
      const from = at - pieceStart;
      const length = Math.min(piece.length - from, end - at);
      out.push({ piece, from: piece.start + from, length });
      at += length;
      i++;
    }
    return out;
  };

  const join = (parts: Uint8Array[], length: number) => {
    if (parts.length === 1) return parts[0] as Uint8Array;
    const out = new Uint8Array(length);
    let at = 0;
    for (const part of parts) {
      out.set(part, at);
      at += part.length;
    }
    return out;
  };

  const clamp = (offset: number, length: number) => {
    const start = Math.min(Math.max(0, offset), size());
    return [start, Math.min(size(), start + Math.max(0, length))] as const;
  };

  function read(
    offset: number,
    length: number,
    signal?: AbortSignal,
  ): Uint8Array | Promise<Uint8Array> {
    const [start, end] = clamp(offset, length);
    const parts = segments(start, end);
    if (cache.sync() === false && signal?.aborted) {
      return Promise.reject(abortError(signal));
    }
    const read = parts.map(({ piece, from, length }) =>
      piece.buffer === "add"
        ? add.read(from, length)
        : cache.read(from, length, signal),
    );
    // A document answers in place only once its source has: a view that saw
    // edited bytes come back at once would take an async document for a
    // sync one. With no source byte in this read to learn from, the source's
    // first page decides; it is cached, and undo may well need it. An empty
    // source has no bytes to read, so it never decides.
    if (
      cache.sync() === undefined &&
      source.size > 0 &&
      parts.length > 0 &&
      parts.every(({ piece }) => piece.buffer === "add")
    ) {
      const first = cache.read(0, 1);
      if (first instanceof Promise) first.catch(() => {});
    }
    const sync = cache.sync() ?? source.size === 0;
    if (sync && read.every((r) => r instanceof Uint8Array)) {
      return join(read as Uint8Array[], end - start);
    }
    return Promise.all(read).then((bytes) => join(bytes, end - start));
  }

  const readInPlace = (offset: number, length: number) => {
    const bytes = source.read(offset, length);
    if (bytes instanceof Uint8Array) return bytes;
    bytes.catch(() => {});
    return undefined;
  };

  function peek(offset: number, length: number): Uint8Array | undefined {
    const [start, end] = clamp(offset, length);
    const parts: Uint8Array[] = [];
    for (const { piece, from, length } of segments(start, end)) {
      let bytes: Uint8Array | undefined;
      if (piece.buffer === "add") bytes = add.read(from, length);
      else if (cache.sync() === false) bytes = cache.get(from, length);
      else if (cache.sync()) bytes = readInPlace(from, length);
      // Unknown until the first read, and finding out would be one.
      else bytes = source.peek?.(from, length);
      if (!bytes) return undefined;
      parts.push(bytes);
    }
    return parts.length ? join(parts, end - start) : new Uint8Array(0);
  }

  const apply = (record: SpliceRecord, forward: boolean) => {
    const [remove, insert] = forward
      ? [record.removed, record.inserted]
      : [record.inserted, record.removed];
    pieces = applySplice(pieces, record.index, remove.length, insert);
    ends = prefixEnds(pieces);
  };

  function editDocument({
    offset,
    length,
    bytes,
    key,
    before,
    after,
  }: DocumentEdit) {
    const [start, end] = clamp(offset, length);
    if (end === start && bytes.length === 0) return;
    if (!resizable && bytes.length !== end - start) {
      throw new RangeError("This document's size is locked");
    }
    const piece: Piece | undefined = bytes.length
      ? { buffer: "add", start: add.append(bytes), length: bytes.length }
      : undefined;
    const record = spliceRecord(pieces, ends, start, end - start, piece);
    apply(record, true);

    const top = undoStack.at(-1);
    const joinsGroup = group?.step !== undefined && group.step === top;
    const continuesRun =
      key !== undefined &&
      top?.key === key &&
      redoStack.length === 0 &&
      (start === top.end || (end > start && end === top.end));
    if (top && (joinsGroup || continuesRun)) {
      top.records.push(record);
      top.end = start + bytes.length;
      if (after !== undefined) top.after = after;
      top.key = key;
    } else {
      const step: Step = {
        id: nextId++,
        records: [record],
        before,
        after,
        key,
        end: start + bytes.length,
      };
      undoStack.push(step);
      redoStack.length = 0;
      if (group) group.step = step;
    }
    state.lastChange = { kind: "edit" };
    notify();
  }

  const currentId = () => undoStack.at(-1)?.id ?? 0;

  const doc: HexDocument = {
    source,
    resizable,
    get size() {
      return size();
    },
    get dirty() {
      return currentId() !== savedId;
    },
    get canUndo() {
      return undoStack.length > 0;
    },
    get canRedo() {
      return redoStack.length > 0;
    },
    read,
    peek,

    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) {
        unsubscribeSource = source.subscribe?.(() => {
          cache.invalidate();
          state.lastChange = { kind: "other" };
          notify();
        });
      }
      return () => {
        if (!listeners.delete(listener) || listeners.size > 0) return;
        unsubscribeSource?.();
        unsubscribeSource = undefined;
      };
    },

    replace(offset, length, bytes) {
      editDocument({ offset, length, bytes });
    },
    insert(offset, bytes) {
      editDocument({ offset, length: 0, bytes });
    },
    overwrite(offset, bytes) {
      const [start] = clamp(offset, 0);
      const room = size() - start;
      const written = resizable ? bytes : bytes.subarray(0, room);
      editDocument({
        offset: start,
        length: Math.min(written.length, room),
        bytes: written,
      });
    },
    delete(offset, length) {
      editDocument({ offset, length, bytes: new Uint8Array(0) });
    },

    undo() {
      const step = undoStack.pop();
      if (!step) return;
      for (let i = step.records.length - 1; i >= 0; i--) {
        apply(step.records[i] as SpliceRecord, false);
      }
      step.key = undefined;
      redoStack.push(step);
      state.lastChange = { kind: "undo", selection: step.before };
      notify();
    },
    redo() {
      const step = redoStack.pop();
      if (!step) return;
      for (const record of step.records) apply(record, true);
      undoStack.push(step);
      state.lastChange = { kind: "redo", selection: step.after };
      notify();
    },
    markSaved() {
      state.breakRun();
      if (savedId === currentId()) return;
      savedId = currentId();
      state.lastChange = { kind: "other" };
      notify();
    },

    modifiedRanges(offset, length) {
      const [start, end] = clamp(offset, length);
      const out: Array<[number, number]> = [];
      let at = start;
      for (const { piece, length } of segments(start, end)) {
        if (piece.buffer === "add") {
          const last = out.at(-1);
          if (last && last[1] === at) last[1] = at + length;
          else out.push([at, at + length]);
        }
        at += length;
      }
      return out;
    },

    pieces() {
      return pieces.map(
        (piece): HexPiece =>
          piece.buffer === "add"
            ? { kind: "bytes", bytes: add.read(piece.start, piece.length) }
            : { kind: "source", offset: piece.start, length: piece.length },
      );
    },

    async toBlob(type) {
      const snapshot = doc.pieces();
      const wrapped = source as { blob?: unknown; bytes?: unknown };
      const parts: BlobPart[] = [];
      for (const piece of snapshot) {
        if (piece.kind === "bytes") {
          parts.push(piece.bytes as Uint8Array<ArrayBuffer>);
        } else if (wrapped.blob instanceof Blob) {
          parts.push(
            wrapped.blob.slice(piece.offset, piece.offset + piece.length),
          );
        } else if (wrapped.bytes instanceof Uint8Array) {
          parts.push(
            wrapped.bytes.subarray(
              piece.offset,
              piece.offset + piece.length,
            ) as Uint8Array<ArrayBuffer>,
          );
        } else {
          for (let at = 0; at < piece.length; at += EXPORT_CHUNK) {
            const bytes = await source.read(
              piece.offset + at,
              Math.min(EXPORT_CHUNK, piece.length - at),
            );
            // A sync source may hand out a view it later changes.
            parts.push(bytes.slice() as Uint8Array<ArrayBuffer>);
          }
        }
      }
      return new Blob(parts, { type });
    },

    stream() {
      const snapshot = doc.pieces();
      const controller = new AbortController();
      let index = 0;
      let at = 0;
      return new ReadableStream<Uint8Array>(
        {
          async pull(stream) {
            const piece = snapshot[index];
            if (!piece) {
              stream.close();
              return;
            }
            if (piece.kind === "bytes") {
              index++;
              stream.enqueue(piece.bytes.slice());
              return;
            }
            const length = Math.min(EXPORT_CHUNK, piece.length - at);
            const bytes = await source.read(
              piece.offset + at,
              length,
              controller.signal,
            );
            at += length;
            if (at >= piece.length) {
              index++;
              at = 0;
            }
            stream.enqueue(bytes.slice());
          },
          cancel(reason) {
            controller.abort(reason);
          },
        },
        { highWaterMark: 1 },
      );
    },
  };

  internals.set(doc, state);
  return doc;
}

function internalsOf(doc: HexDocument): Internals {
  const state = internals.get(doc);
  if (!state) throw new TypeError("Not a HexDocument from createHexDocument");
  return state;
}

export function isHexDocument(value: unknown): value is HexDocument {
  return typeof value === "object" && value !== null && internals.has(value);
}

/** An edit carrying the editor's selections and a coalescing key; `replace` without them. */
export function editDocument(doc: HexDocument, edit: DocumentEdit): void {
  internalsOf(doc).edit(edit);
}

/** Runs several edits as one undo step, with one notification. */
export function editGroup(doc: HexDocument, fn: () => void): void {
  internalsOf(doc).group(fn);
}

/** The next edit starts a new undo step even when it would continue the run. */
export function breakRun(doc: HexDocument): void {
  internalsOf(doc).breakRun();
}

/** What the most recent notification was for; undo and redo carry the selection to restore. */
export function lastChange(doc: HexDocument): HexDocumentChange {
  return internalsOf(doc).lastChange;
}

/** Bumped by every change the document notifies. */
export function documentVersion(doc: HexDocument): number {
  return internalsOf(doc).version;
}

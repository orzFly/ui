import { describe, expect, it, vi } from "vitest";

import {
  breakRun,
  createHexDocument,
  editDocument,
  editGroup,
  type HexDocument,
  lastChange,
} from "../src/document.ts";
import { createPageCache } from "../src/page-cache.ts";
import { type ByteSource, blobSource, bytesSource } from "../src/source.ts";

function xorshift(seed: number) {
  let x = seed >>> 0 || 1;
  return (n: number) => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x % n;
  };
}

/** Resolves on a microtask, like a source that is never in memory. */
function asyncSource(bytes: Uint8Array, pageReads?: number[]): ByteSource {
  return {
    size: bytes.length,
    read(offset, length, signal) {
      pageReads?.push(offset);
      return Promise.resolve().then(() => {
        if (signal?.aborted) throw signal.reason;
        return bytes.slice(offset, offset + length);
      });
    },
  };
}

const range = (n: number, f = (i: number) => i & 0xff) =>
  Uint8Array.from({ length: n }, (_, i) => f(i));

async function readAll(doc: HexDocument, offset = 0, length = doc.size) {
  return [...(await doc.read(offset, length))];
}

/** The model the document must match: bytes, and which came from editing. */
interface Model {
  bytes: number[];
  edited: boolean[];
}

function modelRanges(model: Model) {
  const out: Array<[number, number]> = [];
  model.edited.forEach((on, i) => {
    if (!on) return;
    const last = out.at(-1);
    if (last && last[1] === i) last[1] = i + 1;
    else out.push([i, i + 1]);
  });
  return out;
}

describe.each([
  ["a sync source", (b: Uint8Array) => bytesSource(b)],
  ["an async source", (b: Uint8Array) => asyncSource(b)],
])("HexDocument over %s", (_name, makeSource) => {
  it("matches a naive model through random edits, undo and redo", async () => {
    const rand = xorshift(0xc0ffee);
    const initial = range(300, (i) => (i * 31) & 0xff);
    const doc = createHexDocument(makeSource(initial));
    let model: Model = {
      bytes: [...initial],
      edited: initial.length ? [...initial].map(() => false) : [],
    };
    const undo: Model[] = [];
    let redo: Model[] = [];
    const randomBytes = (n: number) => range(n, () => rand(256));

    for (let step = 0; step < 2000; step++) {
      const op = rand(10);
      const size = model.bytes.length;
      if (op === 8) {
        doc.undo();
        const prev = undo.pop();
        if (prev) {
          redo.push(model);
          model = prev;
        }
      } else if (op === 9) {
        doc.redo();
        const next = redo.pop();
        if (next) {
          undo.push(model);
          model = next;
        }
      } else {
        const offset = rand(size + 1);
        let length = 0;
        let bytes = new Uint8Array(0);
        if (op < 3) {
          bytes = randomBytes(1 + rand(8));
          doc.insert(offset, bytes);
        } else if (op < 5) {
          length = rand(Math.min(20, size - offset) + 1);
          doc.delete(offset, length);
        } else if (op < 7) {
          bytes = randomBytes(1 + rand(8));
          length = Math.min(bytes.length, size - offset);
          doc.overwrite(offset, bytes);
        } else {
          length = rand(Math.min(10, size - offset) + 1);
          bytes = randomBytes(rand(6));
          doc.replace(offset, length, bytes);
        }
        if (length > 0 || bytes.length > 0) {
          undo.push(model);
          redo = [];
          const next = {
            bytes: [...model.bytes],
            edited: [...model.edited],
          };
          next.bytes.splice(offset, length, ...bytes);
          next.edited.splice(offset, length, ...[...bytes].map(() => true));
          model = next;
        }
      }

      expect(doc.size).toBe(model.bytes.length);
      for (let r = 0; r < 3; r++) {
        const offset = rand(doc.size + 1);
        const length = rand(doc.size - offset + 1);
        expect(await readAll(doc, offset, length)).toEqual(
          model.bytes.slice(offset, offset + length),
        );
      }
      expect(doc.modifiedRanges(0, doc.size)).toEqual(modelRanges(model));
      expect(doc.canUndo).toBe(undo.length > 0);
      expect(doc.canRedo).toBe(redo.length > 0);
    }
  });

  it("edits at offset 0, at the end and across three pieces", async () => {
    const doc = createHexDocument(makeSource(range(10)));
    doc.insert(0, Uint8Array.of(0xa0));
    doc.insert(doc.size, Uint8Array.of(0xb0));
    doc.insert(5, Uint8Array.of(0xc0));
    expect(await readAll(doc)).toEqual([
      0xa0, 0, 1, 2, 3, 0xc0, 4, 5, 6, 7, 8, 9, 0xb0,
    ]);
    doc.replace(3, 5, Uint8Array.of(0xee));
    expect(await readAll(doc)).toEqual([0xa0, 0, 1, 0xee, 6, 7, 8, 9, 0xb0]);
    doc.overwrite(8, Uint8Array.of(1, 2, 3));
    expect(await readAll(doc)).toEqual([0xa0, 0, 1, 0xee, 6, 7, 8, 9, 1, 2, 3]);
  });

  it("starts from a zero-length source", async () => {
    const doc = createHexDocument(makeSource(new Uint8Array(0)));
    expect(doc.size).toBe(0);
    expect(await readAll(doc)).toEqual([]);
    doc.insert(0, Uint8Array.of(1, 2));
    expect(await readAll(doc)).toEqual([1, 2]);
    doc.undo();
    expect(doc.size).toBe(0);
  });

  it("notifies once per change and not for no-ops", () => {
    const doc = createHexDocument(makeSource(range(10)));
    const listener = vi.fn();
    doc.subscribe(listener);
    doc.insert(3, Uint8Array.of(1));
    doc.delete(2, 0);
    doc.replace(4, 0, new Uint8Array(0));
    doc.undo();
    doc.undo();
    doc.redo();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("exports what it holds, unaffected by later edits", async () => {
    const doc = createHexDocument(makeSource(range(100)));
    doc.overwrite(10, Uint8Array.of(0xff, 0xfe));
    doc.insert(50, Uint8Array.of(7));
    const expected = await readAll(doc);
    const blob = doc.toBlob("application/octet-stream");
    const stream = doc.stream();
    const pieces = doc.pieces();
    doc.delete(0, 60);
    expect([...new Uint8Array(await (await blob).arrayBuffer())]).toEqual(
      expected,
    );
    expect((await blob).type).toBe("application/octet-stream");
    const chunks: number[] = [];
    for await (const chunk of stream) chunks.push(...chunk);
    expect(chunks).toEqual(expected);
    expect(pieces.map((p) => p.kind)).toEqual([
      "source",
      "bytes",
      "source",
      "bytes",
      "source",
    ]);
    expect(pieces[0]).toEqual({ kind: "source", offset: 0, length: 10 });
    expect([...(pieces[1] as { bytes: Uint8Array }).bytes]).toEqual([
      0xff, 0xfe,
    ]);
    expect(pieces[2]).toEqual({ kind: "source", offset: 12, length: 38 });
  });
});

describe("HexDocument", () => {
  it("merges a typing run into one piece", () => {
    const doc = createHexDocument(bytesSource(range(10)));
    for (let i = 0; i < 5; i++) {
      editDocument(doc, {
        offset: 4 + i,
        length: 0,
        bytes: Uint8Array.of(0x61 + i),
        key: "type-text",
      });
    }
    const pieces = doc.pieces();
    expect(pieces.map((p) => p.kind)).toEqual(["source", "bytes", "source"]);
    expect([...(pieces[1] as { bytes: Uint8Array }).bytes]).toEqual([
      0x61, 0x62, 0x63, 0x64, 0x65,
    ]);
    doc.undo();
    expect(doc.size).toBe(10);
    expect(doc.canUndo).toBe(false);
  });

  it("peeks at edited bytes and cached source pages, never at uncached ones", async () => {
    const reads: number[] = [];
    const doc = createHexDocument(asyncSource(range(200_000), reads));
    expect(doc.peek(0, 4)).toBeUndefined();
    const before = reads.length;
    doc.peek(70_000, 4);
    expect(reads.length).toBe(before);
    await doc.read(0, 4);
    expect([...(doc.peek(0, 4) ?? [])]).toEqual([0, 1, 2, 3]);
    doc.insert(2, Uint8Array.of(0xaa));
    expect([...(doc.peek(0, 4) ?? [])]).toEqual([0, 1, 0xaa, 2]);
    expect(doc.peek(150_000, 4)).toBeUndefined();
    expect(reads.length).toBe(before + 1);
    // Inserted at the end of an uncached document: no source byte involved.
    const empty = createHexDocument(asyncSource(new Uint8Array(0)));
    empty.insert(0, Uint8Array.of(5));
    expect([...(empty.peek(0, 1) ?? [])]).toEqual([5]);
  });

  it("reads nothing until asked, and never zero bytes", async () => {
    const calls: Array<[number, number]> = [];
    const recording = (bytes: Uint8Array): ByteSource => {
      const base = asyncSource(bytes);
      return {
        size: bytes.length,
        read(offset, length, signal) {
          calls.push([offset, length]);
          return base.read(offset, length, signal);
        },
      };
    };
    const empty = createHexDocument(recording(new Uint8Array(0)));
    empty.insert(0, Uint8Array.of(1, 2));
    expect(await readAll(empty)).toEqual([1, 2]);
    empty.peek(0, 2);
    const doc = createHexDocument(recording(range(10)));
    expect(calls).toEqual([]);
    doc.insert(0, Uint8Array.of(0xaa));
    doc.delete(5, 6);
    expect(await readAll(doc)).toEqual([0xaa, 0, 1, 2, 3]);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every(([, length]) => length > 0)).toBe(true);
  });

  it("makes no read for a first read already aborted", async () => {
    const reads: number[] = [];
    const doc = createHexDocument(asyncSource(range(10), reads));
    const aborted = AbortSignal.abort();
    await expect(doc.read(0, 4, aborted)).rejects.toBe(aborted.reason);
    expect(reads).toEqual([]);
    expect(await readAll(doc, 0, 4)).toEqual([0, 1, 2, 3]);
  });

  it("reads a sync source in place from its first read", () => {
    const bytes = range(10);
    const doc = createHexDocument(bytesSource(bytes));
    const read = doc.read(2, 4);
    expect(read).toBeInstanceOf(Uint8Array);
    expect((read as Uint8Array).buffer).toBe(bytes.buffer);
    expect([...(doc.peek(2, 2) ?? [])]).toEqual([2, 3]);
  });

  it("peeks a sync source in place before its first read", () => {
    const doc = createHexDocument(bytesSource(range(10)));
    expect([...(doc.peek(0, 4) ?? [])]).toEqual([0, 1, 2, 3]);
  });

  it("answers edited bytes in place only once the source has", async () => {
    const doc = createHexDocument(asyncSource(range(200_000)));
    doc.insert(0, new Uint8Array(70_000));
    // A view over it must not take it for a sync document.
    const view = createPageCache(doc);
    view.request(0, 0);
    expect(view.sync()).toBe(false);
    expect(view.status(1)).toBe("idle");
    expect(doc.read(0, 4)).toBeInstanceOf(Promise);
    const empty = createHexDocument(asyncSource(new Uint8Array(0)));
    empty.insert(0, Uint8Array.of(1));
    expect(empty.read(0, 1)).toBeInstanceOf(Uint8Array);
  });

  it("learns a sync source even when every source byte was edited away first", () => {
    const replaced = createHexDocument(bytesSource(range(4)));
    replaced.replace(0, 4, Uint8Array.of(9, 9, 9, 9));
    expect(replaced.read(0, 4)).toBeInstanceOf(Uint8Array);
    const deleted = createHexDocument(bytesSource(range(4)));
    deleted.delete(0, 4);
    deleted.insert(0, Uint8Array.of(7));
    expect([...(deleted.read(0, 1) as Uint8Array)]).toEqual([7]);
  });

  it("reads good bytes of a sync source whose first page holds a bad one", () => {
    const bytes = range(70_000);
    const doc = createHexDocument({
      size: bytes.length,
      read(offset, length) {
        if (offset <= 60_000 && 60_000 < offset + length) {
          throw new Error("bad sector");
        }
        return bytes.subarray(offset, offset + length);
      },
    });
    expect([...(doc.read(10, 4) as Uint8Array)]).toEqual([10, 11, 12, 13]);
    expect([...(doc.peek(10, 4) ?? [])]).toEqual([10, 11, 12, 13]);
    expect(() => doc.read(59_999, 2)).toThrow("bad sector");
  });

  it("rejects, not throws, when an async source throws on its first read", async () => {
    const doc = createHexDocument({
      size: 10,
      read() {
        throw new Error("boom");
      },
    });
    const read = doc.read(0, 4);
    expect(read).toBeInstanceOf(Promise);
    await expect(read).rejects.toThrow("boom");
  });

  it("stays async over an async source, even for edited bytes", async () => {
    const doc = createHexDocument(asyncSource(range(10)));
    await doc.read(0, 4);
    doc.insert(0, Uint8Array.of(0xaa));
    const read = doc.read(0, 1);
    expect(read).toBeInstanceOf(Promise);
    expect([...(await read)]).toEqual([0xaa]);
  });

  it("forwards source notifications and re-reads after them", async () => {
    const bytes = range(10);
    let onChange: (() => void) | undefined;
    const reads: number[] = [];
    const base = asyncSource(bytes, reads);
    const doc = createHexDocument({
      ...base,
      subscribe(listener) {
        onChange = listener;
        return () => {
          onChange = undefined;
        };
      },
    });
    const listener = vi.fn();
    const unsubscribe = doc.subscribe(listener);
    expect(await readAll(doc)).toEqual([...bytes]);
    bytes[0] = 0x99;
    onChange?.();
    expect(listener).toHaveBeenCalledTimes(1);
    expect((await readAll(doc))[0]).toBe(0x99);
    unsubscribe();
    expect(onChange).toBeUndefined();
  });

  it("refuses size changes when the size is locked", () => {
    const doc = createHexDocument(bytesSource(range(10)), {
      resizable: false,
    });
    expect(() => doc.insert(1, Uint8Array.of(1))).toThrow(RangeError);
    expect(() => doc.delete(1, 1)).toThrow(RangeError);
    expect(() => doc.replace(1, 2, Uint8Array.of(1))).toThrow(RangeError);
    doc.replace(1, 1, Uint8Array.of(0xaa));
    doc.overwrite(8, Uint8Array.of(1, 2, 3, 4));
    expect(doc.size).toBe(10);
    expect([...(doc.read(0, 10) as Uint8Array)]).toEqual([
      0, 0xaa, 2, 3, 4, 5, 6, 7, 1, 2,
    ]);
  });

  it("clamps offsets and lengths", () => {
    const doc = createHexDocument(bytesSource(range(4)));
    doc.delete(2, 100);
    doc.insert(99, Uint8Array.of(9));
    doc.delete(-5, 1);
    expect([...(doc.read(0, 10) as Uint8Array)]).toEqual([1, 9]);
  });
});

describe("HexDocument undo", () => {
  const typed = (
    doc: HexDocument,
    offset: number,
    key = "type-text" as const,
  ) =>
    editDocument(doc, {
      offset,
      length: 0,
      bytes: Uint8Array.of(0x41),
      key,
    });

  it("coalesces a typing run into one step", () => {
    const doc = createHexDocument(bytesSource(range(10)));
    typed(doc, 2);
    typed(doc, 3);
    typed(doc, 4);
    doc.undo();
    expect(doc.canUndo).toBe(false);
    expect(doc.size).toBe(10);
  });

  it("coalesces rewriting the byte just typed, as the second nibble does", () => {
    const doc = createHexDocument(bytesSource(range(10)));
    const nibble = (offset: number, value: number) =>
      editDocument(doc, {
        offset,
        length: 1,
        bytes: Uint8Array.of(value),
        key: "type-hex",
      });
    nibble(2, 0x40);
    nibble(2, 0x41);
    nibble(3, 0x50);
    nibble(3, 0x52);
    doc.undo();
    expect(doc.canUndo).toBe(false);
    expect([...(doc.read(0, 4) as Uint8Array)]).toEqual([0, 1, 2, 3]);
  });

  it.each([
    ["a key change", (doc: HexDocument) => typed(doc, 3, "type-hex" as never)],
    [
      "breakRun",
      (doc: HexDocument) => {
        breakRun(doc);
        typed(doc, 3);
      },
    ],
    ["an offset jump", (doc: HexDocument) => typed(doc, 7)],
    [
      "an undo",
      (doc: HexDocument) => {
        doc.undo();
        doc.redo();
        typed(doc, 3);
      },
    ],
    [
      "markSaved",
      (doc: HexDocument) => {
        doc.markSaved();
        typed(doc, 3);
      },
    ],
  ])("starts a new step after %s", (_name, then) => {
    const doc = createHexDocument(bytesSource(range(10)));
    typed(doc, 2);
    then(doc);
    doc.undo();
    expect(doc.canUndo).toBe(true);
  });

  it("undoes an edit group as one step", () => {
    const doc = createHexDocument(bytesSource(range(10)));
    const listener = vi.fn();
    doc.subscribe(listener);
    editGroup(doc, () => {
      doc.delete(2, 3);
      doc.insert(2, Uint8Array.of(0xaa));
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect([...(doc.read(0, 4) as Uint8Array)]).toEqual([0, 1, 0xaa, 5]);
    doc.undo();
    expect([...(doc.read(0, 10) as Uint8Array)]).toEqual([...range(10)]);
    expect(doc.canUndo).toBe(false);
  });

  it("tracks dirty state against the save point", () => {
    const doc = createHexDocument(bytesSource(range(10)));
    expect(doc.dirty).toBe(false);
    doc.insert(0, Uint8Array.of(1));
    expect(doc.dirty).toBe(true);
    doc.undo();
    expect(doc.dirty).toBe(false);
    doc.redo();
    doc.markSaved();
    expect(doc.dirty).toBe(false);
    doc.insert(0, Uint8Array.of(2));
    expect(doc.dirty).toBe(true);
    doc.undo();
    expect(doc.dirty).toBe(false);
    doc.undo();
    expect(doc.dirty).toBe(true);
    doc.redo();
    expect(doc.dirty).toBe(false);
    // The save point was in the redo branch this edit discards.
    doc.undo();
    doc.insert(0, Uint8Array.of(3));
    expect(doc.dirty).toBe(true);
    doc.undo();
    expect(doc.dirty).toBe(true);
    doc.markSaved();
    expect(doc.dirty).toBe(false);
  });

  it("reports the selection to restore after undo and redo", () => {
    const doc = createHexDocument(bytesSource(range(10)));
    const before = { anchor: 2, focus: 2, pane: "hex" as const };
    const after = { anchor: 3, focus: 3, pane: "hex" as const };
    editDocument(doc, {
      offset: 2,
      length: 1,
      bytes: Uint8Array.of(9),
      before,
      after,
    });
    expect(lastChange(doc)).toEqual({ kind: "edit" });
    doc.undo();
    expect(lastChange(doc)).toEqual({ kind: "undo", selection: before });
    doc.redo();
    expect(lastChange(doc)).toEqual({ kind: "redo", selection: after });
  });

  it("clears modified ranges once everything is undone", () => {
    const doc = createHexDocument(bytesSource(range(10)));
    doc.overwrite(1, Uint8Array.of(9, 9));
    doc.insert(6, Uint8Array.of(9));
    expect(doc.modifiedRanges(0, doc.size)).toEqual([
      [1, 3],
      [6, 7],
    ]);
    expect(doc.modifiedRanges(2, 3)).toEqual([[2, 3]]);
    doc.markSaved();
    expect(doc.modifiedRanges(0, doc.size)).toHaveLength(2);
    doc.undo();
    doc.undo();
    expect(doc.modifiedRanges(0, doc.size)).toEqual([]);
  });
});

describe("HexDocument export", () => {
  it("slices a blob source without reading it", async () => {
    const bytes = range(5000);
    const source = blobSource(new Blob([bytes]));
    const read = vi.spyOn(source, "read");
    const doc = createHexDocument(source);
    read.mockClear();
    doc.overwrite(100, Uint8Array.of(1, 2, 3));
    doc.delete(4000, 10);
    const blob = await doc.toBlob();
    expect(read).not.toHaveBeenCalled();
    const expected = [...bytes];
    expected.splice(100, 3, 1, 2, 3);
    expected.splice(4000, 10);
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual(expected);
  });

  it("streams in chunks of at most 1 MiB", async () => {
    const size = 3 * (1 << 20) + 5;
    const doc = createHexDocument(asyncSource(range(size)));
    doc.insert(10, Uint8Array.of(0xaa));
    const lengths: number[] = [];
    let total = 0;
    let tenth = -1;
    for await (const chunk of doc.stream()) {
      if (total <= 10 && total + chunk.length > 10)
        tenth = chunk[10 - total] as number;
      lengths.push(chunk.length);
      total += chunk.length;
    }
    expect(total).toBe(size + 1);
    expect(Math.max(...lengths)).toBeLessThanOrEqual(1 << 20);
    expect(tenth).toBe(0xaa);
  });

  it("aborts the read in flight when the stream is cancelled", async () => {
    let signal: AbortSignal | undefined;
    const doc = createHexDocument({
      size: 100,
      read(_offset, length, s) {
        if (length === 0) return Promise.resolve(new Uint8Array(0));
        signal = s;
        return new Promise(() => {});
      },
    });
    const reader = doc.stream().getReader();
    const pending = reader.read();
    await Promise.resolve();
    await Promise.resolve();
    expect(signal?.aborted).toBe(false);
    await reader.cancel();
    expect(signal?.aborted).toBe(true);
    void pending;
  });

  it("errors the stream when a read fails", async () => {
    const doc = createHexDocument({
      size: 100,
      read: (_offset, length) =>
        length === 0
          ? Promise.resolve(new Uint8Array(0))
          : Promise.reject(new Error("gone")),
    });
    await expect(doc.stream().getReader().read()).rejects.toThrow("gone");
    await expect(doc.toBlob()).rejects.toThrow("gone");
  });
});

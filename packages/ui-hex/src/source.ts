export interface ByteSource {
  /** Total length in bytes; at most Number.MAX_SAFE_INTEGER. Read again after every change notification. */
  readonly size: number;
  /** Exactly min(length, size - offset) bytes. Sync for in-memory sources, a promise otherwise. */
  read(
    offset: number,
    length: number,
    signal?: AbortSignal,
  ): Uint8Array | Promise<Uint8Array>;
  /**
   * The bytes when they are at hand with no I/O, else `undefined`; never
   * starts a read. A view redraws from it after an edit instead of
   * flashing placeholders while it re-reads pages the source already has.
   */
  peek?(offset: number, length: number): Uint8Array | undefined;
  /** Content or size changed: the view drops its cache and re-reads what is visible. */
  subscribe?(onChange: () => void): () => void;
}

function clampRange(offset: number, length: number, size: number) {
  const start = Math.min(Math.max(0, offset), size);
  return [start, Math.min(size, start + Math.max(0, length))] as const;
}

/** A sync source over `bytes`; reads are subarrays, never copies. */
export function bytesSource(
  bytes: Uint8Array,
): ByteSource & { readonly bytes: Uint8Array } {
  const read = (offset: number, length: number) => {
    const [start, end] = clampRange(offset, length, bytes.length);
    return bytes.subarray(start, end);
  };
  return { bytes, size: bytes.length, read, peek: read };
}

function abortError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("Aborted", "AbortError");
}

export function blobSource(blob: Blob): ByteSource & { readonly blob: Blob } {
  return {
    blob,
    size: blob.size,
    async read(offset, length, signal) {
      if (signal?.aborted) throw abortError(signal);
      const [start, end] = clampRange(offset, length, blob.size);
      const buffer = await blob.slice(start, end).arrayBuffer();
      if (signal?.aborted) throw abortError(signal);
      return new Uint8Array(buffer);
    },
  };
}

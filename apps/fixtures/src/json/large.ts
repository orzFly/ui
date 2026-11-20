/**
 * Payloads too large to keep as files, made on demand for the JSON view's edge stories: more rows
 * than its budget, nesting deeper than a recursive walk survives, and one very long string.
 */

/** `count` small records, as an event log's rows. */
export function largeArray(count = 50000): unknown[] {
  const kinds = ["start", "step", "retry", "done"];
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    kind: kinds[i % kinds.length],
    ok: i % 7 !== 0,
    at: 1700000000 + i * 13,
  }));
}

/** An object nested `depth` levels down, `{ "level": 1, "next": { … } }`. */
export function deepNesting(depth = 5000): unknown {
  let node: Record<string, unknown> = { level: depth, next: null };
  for (let level = depth - 1; level >= 1; level--) {
    node = { level, next: node };
  }
  return node;
}

/** A record holding one string of about `bytes` characters, in lines. */
export function hugeString(bytes = 5 * 1024 * 1024): { log: string } {
  const line =
    "2026-01-01T00:00:00Z step ok: compiled one module, nothing to report\n";
  return { log: line.repeat(Math.ceil(bytes / line.length)) };
}

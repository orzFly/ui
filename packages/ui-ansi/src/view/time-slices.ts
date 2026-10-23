/** How long one slice may run before it yields to the browser. */
export const SLICE_BUDGET_MS = 8;

/**
 * Calls `step` once per macrotask, each time with a deadline
 * {@link SLICE_BUDGET_MS} away, until it returns true or the returned stop is
 * called. `onSlice` runs after every step, including the last.
 */
export function runSlices(
  step: (deadline: number) => boolean,
  onSlice: () => void,
): () => void {
  // MessageChannel rather than setTimeout: nested timeouts are clamped to 4 ms,
  // which would idle half of every slice.
  const channel = new MessageChannel();
  const port = channel.port2;
  let stopped = false;
  const stop = () => {
    stopped = true;
    channel.port1.close();
    port.close();
  };
  channel.port1.onmessage = () => {
    // A tick queued before stop can still be delivered.
    if (stopped) return;
    const done = step(performance.now() + SLICE_BUDGET_MS);
    onSlice();
    if (stopped) return;
    if (done) stop();
    else port.postMessage(null);
  };
  port.postMessage(null);
  return stop;
}

export type PlayerModule = typeof import("asciinema-player");

// The player needs canvas, requestAnimationFrame and ResizeObserver at import
// time and weighs ~90 KB gzip; it is only ever reached through this dynamic
// import, from an effect, so neither SSR nor a page without a cast loads it.
let loaded: Promise<PlayerModule> | undefined;

export function loadPlayer(): Promise<PlayerModule> {
  loaded ??= import("asciinema-player").catch((error: unknown) => {
    // A chunk that failed once (a dropped connection) would stay rejected in
    // the memo, and Retry would get the same rejection back.
    loaded = undefined;
    throw error;
  });
  return loaded;
}

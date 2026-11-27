export type PostalMimeModule = typeof import("postal-mime");

// postal-mime is only reached through this import, so a bundler splits it into
// a chunk of its own, fetched the first time a message is read: an app that
// registers `emlContent` carries none of it until then.
let loaded: Promise<PostalMimeModule> | undefined;

export function loadPostalMime(): Promise<PostalMimeModule> {
  loaded ??= import("postal-mime").catch((error: unknown) => {
    // A chunk that failed once (a dropped connection) would stay rejected in
    // the memo, and Retry would get the same rejection back.
    loaded = undefined;
    throw error;
  });
  return loaded;
}

/**
 * `load` run by the first call, its promise shared by every call after. A rejection is dropped:
 * a chunk that failed once (a dropped connection) would otherwise stay rejected for the life of
 * the page, and Retry would get the same rejection back.
 */
export function importOnce<T>(load: () => Promise<T>): () => Promise<T> {
  let loaded: Promise<T> | undefined;
  return () => {
    loaded ??= load().catch((error: unknown) => {
      loaded = undefined;
      throw error;
    });
    return loaded;
  };
}

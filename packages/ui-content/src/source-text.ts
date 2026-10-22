import { useCallback, useEffect, useRef, useState } from "react";
import type { ContentSource } from "./types.ts";

export type SourceText = (
  | { status: "loading"; text?: undefined; error?: undefined }
  | { status: "ready"; text: string; error?: undefined }
  | { status: "error"; text?: undefined; error: Error }
) & {
  /** Runs the load again; what a renderer's Retry button calls. */
  retry: () => void;
};

type Settled =
  | { status: "ready"; text: string }
  | { status: "error"; error: Error };

/** What identifies one load: when any of it changes, the previous load is aborted. */
type Key = {
  name: string;
  url: string | undefined;
  load: ((signal: AbortSignal) => Promise<string>) | undefined;
  attempt: number;
};

function sameKey(a: Key, b: Key): boolean {
  return (
    a.name === b.name &&
    a.url === b.url &&
    a.load === b.load &&
    a.attempt === b.attempt
  );
}

async function fetchText(url: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`.trim());
  }
  return response.text();
}

/**
 * The text of a source. Inline text is ready at once. A file calls `load` when it has one and
 * fetches `url` otherwise, and the load is aborted on unmount and when the source changes.
 *
 * A file counts as changed when its `name` or `url` does, or, for a file with no `url`, when its
 * `load` function does. A `load` beside a `url` is read from the latest render instead, so a
 * resolver that builds a fresh closure on every render does not restart the load each time.
 *
 * Size caps are the caller's.
 */
export function useSourceText(source: ContentSource): SourceText {
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const file = source.kind === "file" ? source : undefined;
  const latestLoad = useRef(file?.load);
  latestLoad.current = file?.load;

  const key: Key | undefined =
    file === undefined
      ? undefined
      : {
          name: file.name,
          url: file.url,
          load: file.url === undefined ? file.load : undefined,
          attempt,
        };
  const [settled, setSettled] = useState<{ key: Key; result: Settled }>();

  const name = key?.name;
  const url = key?.url;
  const keyLoad = key?.load;
  useEffect(() => {
    if (name === undefined) return;
    const forKey: Key = { name, url, load: keyLoad, attempt };
    const load =
      latestLoad.current ??
      (url === undefined
        ? undefined
        : (signal: AbortSignal) => fetchText(url, signal));
    if (load === undefined) {
      setSettled({
        key: forKey,
        result: {
          status: "error",
          error: new Error(`${name}: nothing to load`),
        },
      });
      return;
    }
    const controller = new AbortController();
    load(controller.signal).then(
      (text) => {
        if (controller.signal.aborted) return;
        setSettled({ key: forKey, result: { status: "ready", text } });
      },
      (error: unknown) => {
        // An abort is this hook letting go of the load, not the load failing.
        if (controller.signal.aborted) return;
        setSettled({
          key: forKey,
          result: {
            status: "error",
            error: error instanceof Error ? error : new Error(String(error)),
          },
        });
      },
    );
    return () => controller.abort();
  }, [name, url, keyLoad, attempt]);

  if (source.kind === "inline") {
    return { status: "ready", text: source.text, retry };
  }
  // A result settled for an earlier key is stale: report loading until this key's load settles,
  // rather than the previous file's text for one render.
  if (
    settled === undefined ||
    key === undefined ||
    !sameKey(settled.key, key)
  ) {
    return { status: "loading", retry };
  }
  return { ...settled.result, retry };
}

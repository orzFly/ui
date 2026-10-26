import { createContext, type ReactNode, useContext } from "react";

/** Starts one of pierre's highlighting workers: `@pierre/diffs/worker/worker.js`, bundled. */
export type CodeWorkerFactory = () => Worker;

const CodeWorkerContext = createContext<CodeWorkerFactory | null>(null);

/**
 * Lends pierre's highlighting worker to the code views below it that tokenize off the main
 * thread: `codeContent`'s files, in the viewer and in cards. pierre tokenizes a whole file even
 * when it draws a screenful, so 1 MiB of log held the tab for 9.3 s on the main thread and 0.2 s
 * with the worker; the lines show at once and their colours follow. Without a provider those
 * views tokenize on the main thread.
 *
 * The worker script has to come from the app's bundler, which is why the package cannot start it
 * itself. With Vite:
 *
 * ```ts
 * import PierreWorker from "@pierre/diffs/worker/worker.js?worker";
 * <CodeWorkerProvider workerFactory={() => new PierreWorker()}>
 * ```
 *
 * The pool is a page-wide singleton, created from the first factory and terminated when the
 * last view using it unmounts, so it only exists while such a view is on screen.
 */
export function CodeWorkerProvider({
  workerFactory,
  children,
}: {
  workerFactory: CodeWorkerFactory;
  children?: ReactNode;
}) {
  return (
    <CodeWorkerContext.Provider value={workerFactory}>
      {children}
    </CodeWorkerContext.Provider>
  );
}

/** The nearest provider's factory, or null outside one. */
export function useCodeWorkerFactory(): CodeWorkerFactory | null {
  return useContext(CodeWorkerContext);
}

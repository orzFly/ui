import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeBlock } from "../src/code-block.tsx";
import { CodeWorkerProvider } from "../src/code-worker.tsx";

const seen = vi.hoisted(() => ({
  pools: [] as Array<{ workerFactory: () => Worker; poolSize?: number }>,
  items: [] as Array<{ file: { name: string; lang?: string } }>,
}));

/** Records what CodeBlock hands pierre: the pool it opens, and each file item. */
vi.mock("@pierre/diffs/react", () => ({
  CodeView: ({
    items,
  }: {
    items: Array<{ file: { name: string; lang?: string } }>;
  }) => {
    seen.items.push(...items);
    return <div data-testid="code-view" />;
  },
  WorkerPoolContextProvider: ({
    poolOptions,
    children,
  }: {
    poolOptions: { workerFactory: () => Worker; poolSize?: number };
    children: ReactNode;
  }) => {
    seen.pools.push(poolOptions);
    return <div data-testid="worker-pool">{children}</div>;
  },
  useWorkerPool: () => undefined,
}));

afterEach(() => {
  seen.pools.length = 0;
  seen.items.length = 0;
});

const factory = () => ({}) as Worker;

describe("CodeBlock off the main thread", () => {
  it("tokenizes in the worker pool a provider lends", async () => {
    render(
      <CodeWorkerProvider workerFactory={factory}>
        <CodeBlock filename="a.ts" contents="let a = 1;" offThread />
      </CodeWorkerProvider>,
    );
    await screen.findByTestId("code-view");
    expect(screen.getByTestId("worker-pool")).toBeTruthy();
    expect(seen.pools[0]?.workerFactory).toBe(factory);
  });

  it("stays on the main thread with no provider", async () => {
    render(<CodeBlock filename="a.ts" contents="let a = 1;" offThread />);
    await screen.findByTestId("code-view");
    expect(screen.queryByTestId("worker-pool")).toBeNull();
  });

  it("stays on the main thread unless asked", async () => {
    render(
      <CodeWorkerProvider workerFactory={factory}>
        <CodeBlock filename="a.ts" contents="let a = 1;" />
      </CodeWorkerProvider>,
    );
    await screen.findByTestId("code-view");
    expect(screen.queryByTestId("worker-pool")).toBeNull();
  });

  it("starts no worker for plain text, which it draws as text", async () => {
    render(
      <CodeWorkerProvider workerFactory={factory}>
        <CodeBlock filename="a.ts" contents="let a = 1;" offThread plain />
      </CodeWorkerProvider>,
    );
    await screen.findByTestId("code-view");
    expect(screen.queryByTestId("worker-pool")).toBeNull();
    expect(seen.items.at(-1)?.file).toMatchObject({
      name: "a.ts",
      lang: "text",
    });
  });
});

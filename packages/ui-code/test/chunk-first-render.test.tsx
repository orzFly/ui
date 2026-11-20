import { act, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { expect, it, vi } from "vitest";
import { LazyMultiFileDiff } from "../src/code-block.tsx";

// pierre's chunk, held until the test lets it arrive.
const chunk = vi.hoisted(() => {
  let open!: () => void;
  const gate = new Promise<void>((done) => {
    open = done;
  });
  return { gate, open };
});

vi.mock("@pierre/diffs", () => ({ registerCustomTheme: () => {} }));
vi.mock("@pierre/diffs/react", async () => {
  await chunk.gate;
  return {
    MultiFileDiff: () => <div data-testid="multi-file-diff" />,
  };
});

// Suspending is what cost: on a page's first load React does not commit a
// retry of the app shell's boundary that suspends again within 300 ms of its
// fallback, so a block suspending for pierre's chunk had the whole page
// rendered again from scratch once the chunk arrived. So no code surface
// suspends; each draws its own fallback until the chunk is there. One
// surface per file: vitest hands a second import that arrives while an async
// mock factory is pending the real module.
it("draws a fallback rather than suspend while pierre's chunk loads", async () => {
  render(
    <Suspense fallback={<p>suspended</p>}>
      <LazyMultiFileDiff
        fallback={<p>loading diff</p>}
        oldFile={{ name: "a.ts", contents: "a" }}
        newFile={{ name: "a.ts", contents: "b" }}
      />
    </Suspense>,
  );
  expect(screen.queryByText("suspended")).toBeNull();
  expect(screen.getByText("loading diff")).not.toBeNull();

  await act(async () => {
    chunk.open();
    await chunk.gate;
  });
  expect(await screen.findByTestId("multi-file-diff")).not.toBeNull();
  expect(screen.queryByText("loading diff")).toBeNull();
});

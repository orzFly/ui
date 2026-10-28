import { act, render, waitFor } from "@testing-library/react";
import { lazy, Suspense, useState } from "react";
import { expect, it } from "vitest";
import { CodeDiffBlock } from "../src/code-block.tsx";

// Real pierre, unlike code-block-degrade: the failure lives in how its
// instances hand a container over, and only while its shared highlighter is
// still loading. Vitest gives each file fresh modules, so the case has to be
// the first in its file to use pierre.

function drawnLines(root: Element): number {
  let count = 0;
  for (const host of root.querySelectorAll("diffs-container")) {
    count += host.shadowRoot?.querySelectorAll("[data-line]").length ?? 0;
  }
  return count;
}

it("draws a fence diff after a Suspense boundary above it re-suspends", async () => {
  let resolve!: () => void;
  const gate = new Promise<void>((done) => {
    resolve = done;
  });
  const Pending = lazy(() => gate.then(() => ({ default: () => null })));
  let suspend!: () => void;
  function Page() {
    const [pending, setPending] = useState(false);
    suspend = () => setPending(true);
    return (
      <Suspense fallback={<p>loading</p>}>
        <CodeDiffBlock filename="config.yaml" before="a: 1" after="a: 2" />
        {pending && <Pending />}
      </Suspense>
    );
  }
  const { container } = render(<Page />);
  await waitFor(() => {
    expect(container.querySelector("diffs-container")).not.toBeNull();
  });
  // The case under test: the highlighter has not drawn anything yet.
  expect(drawnLines(container)).toBe(0);

  act(() => suspend());
  expect(container.textContent).toContain("loading");
  resolve();
  await waitFor(
    () => {
      expect(drawnLines(container)).toBeGreaterThan(0);
    },
    { timeout: 8000 },
  );
}, 15_000);

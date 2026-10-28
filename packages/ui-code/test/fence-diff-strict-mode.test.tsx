import { render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
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

it("draws a fence diff under StrictMode on pierre's first load", async () => {
  const { container } = render(
    <StrictMode>
      <CodeDiffBlock
        filename="config.json"
        before={'{ "retries": 1 }'}
        after={'{ "retries": 3 }'}
      />
    </StrictMode>,
  );
  await waitFor(
    () => {
      expect(drawnLines(container)).toBeGreaterThan(0);
    },
    { timeout: 8000 },
  );
}, 15_000);

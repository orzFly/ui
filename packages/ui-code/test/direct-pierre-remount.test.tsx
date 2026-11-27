import { MultiFileDiff } from "@pierre/diffs/react";
import { render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { expect, it } from "vitest";
import {
  PIERRE_HIGHLIGHTER,
  PIERRE_THEME,
  PIERRE_THEME_TYPE,
  redrawOnRemount,
} from "../src/code-block.tsx";

// Real pierre, as in fence-diff-strict-mode: the failure lives in how its
// instances hand a container over, and only while its shared highlighter is
// still loading, so the case has to be the first in its file to use pierre.
// Without a file header the first instance leaves nothing but an empty
// `<pre>`, which is what the second takes for its own drawing.

const OPTIONS = {
  theme: PIERRE_THEME,
  themeType: PIERRE_THEME_TYPE,
  preferredHighlighter: PIERRE_HIGHLIGHTER,
  disableFileHeader: true,
  onPostRender: redrawOnRemount,
};

function drawnLines(root: Element): number {
  let count = 0;
  for (const host of root.querySelectorAll("diffs-container")) {
    count += host.shadowRoot?.querySelectorAll("[data-line]").length ?? 0;
  }
  return count;
}

it("draws an app's own pierre diff under StrictMode on pierre's first load", async () => {
  const { container } = render(
    <StrictMode>
      <MultiFileDiff
        oldFile={{ name: "config.json", contents: '{ "retries": 1 }\n' }}
        newFile={{ name: "config.json", contents: '{ "retries": 3 }\n' }}
        options={OPTIONS}
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

import { builtinThemes } from "@orz/themes";
import { createThemeStore, ThemeProvider } from "@orz/ui/theme";
import { MultiFileDiff } from "@pierre/diffs/react";
import { render, renderHook, waitFor } from "@testing-library/react";
import { useMemo } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  PIERRE_HIGHLIGHTER,
  PIERRE_THEME_TYPE,
  usePierreSyntaxTheme,
} from "../src/code-block.tsx";

// Real pierre: what fails is pierre being handed the name of a theme nobody
// has registered with it yet. Nothing in this file loads pierre through the
// package's blocks, which would register it on their way.

const store = createThemeStore({
  storageKey: "app-theme",
  themes: builtinThemes,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function Diff() {
  const theme = usePierreSyntaxTheme();
  const options = useMemo(
    () =>
      theme && {
        theme,
        themeType: PIERRE_THEME_TYPE,
        preferredHighlighter: PIERRE_HIGHLIGHTER,
      },
    [theme],
  );
  return options === null ? null : (
    <MultiFileDiff
      oldFile={{ name: "retry.ts", contents: "const attempts = 1;\n" }}
      newFile={{ name: "retry.ts", contents: "const attempts = 3;\n" }}
      options={options}
    />
  );
}

function drawnLines(root: Element): number {
  let count = 0;
  for (const host of root.querySelectorAll("diffs-container")) {
    count += host.shadowRoot?.querySelectorAll("[data-line]").length ?? 0;
  }
  return count;
}

it("draws an app's own pierre diff under a palette's own syntax theme", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  store.setPref({ ui: { theme: "pro-sakura", mode: "light" } });
  const { container } = render(
    <ThemeProvider store={store}>
      <Diff />
    </ThemeProvider>,
  );
  await waitFor(
    () => {
      expect(drawnLines(container)).toBeGreaterThan(0);
    },
    { timeout: 8000 },
  );
}, 15_000);

it("has the theme from the first render once pierre has loaded", () => {
  const seen: unknown[] = [];
  renderHook(
    () => {
      const theme = usePierreSyntaxTheme();
      seen.push(theme);
      return theme;
    },
    {
      wrapper: ({ children }) => (
        <ThemeProvider store={store}>{children}</ThemeProvider>
      ),
    },
  );
  expect(seen[0]).toEqual({
    light: "orz-pro-sakura-light",
    dark: "orz-pro-sakura-light",
  });
});

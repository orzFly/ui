import { EditorView } from "@codemirror/view";
import { builtinThemes } from "@orz/themes";
import {
  createThemeStore,
  ThemeProvider,
  type ThemeStore,
} from "@orz/ui/theme";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CodeEditor } from "../src/components/code-editor.tsx";
import { MarkdownEditor } from "../src/components/markdown-editor.tsx";
import { cmView } from "./cm.ts";

let store: ThemeStore;

beforeEach(() => {
  store = createThemeStore({
    storageKey: "editor-theme",
    themes: builtinThemes,
  });
});

afterEach(() => {
  store.dispose();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.variant;
  document.documentElement.classList.remove("dark");
  for (const style of document.head.querySelectorAll("style")) style.remove();
});

describe("editor light/dark", () => {
  it("follows the theme's colour scheme, also when it changes while mounted", () => {
    store.setPref({ ui: { theme: "default", mode: "dark" } });
    const { container } = render(
      <ThemeProvider store={store}>
        <MarkdownEditor />
      </ThemeProvider>,
    );
    const view = cmView(container);
    expect(view.state.facet(EditorView.darkTheme)).toBe(true);

    act(() => store.setPref({ ui: { theme: "default", mode: "light" } }));
    expect(view.state.facet(EditorView.darkTheme)).toBe(false);
  });

  it("reads light outside a ThemeProvider", () => {
    const { container } = render(<CodeEditor />);
    expect(cmView(container).state.facet(EditorView.darkTheme)).toBe(false);
  });
});

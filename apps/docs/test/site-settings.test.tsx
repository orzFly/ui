// @vitest-environment happy-dom
import { builtinThemes, defaultStyle, type Theme } from "@orz/themes";
import { createThemeStore, ThemeProvider } from "@orz/ui/theme";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { StyleSetting } from "../src/site-settings.tsx";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// A second style, which no shipped stylesheet draws yet.
const bevel = { id: "bevel", label: "Bevel" };
const bevelDay: Theme = {
  ...(builtinThemes[1] as Theme),
  id: "bevel-day",
  label: "Bevel Day",
  styles: ["bevel"],
};

let unmount = () => {};
afterEach(() => {
  unmount();
  localStorage.clear();
});

function draw(styles = [defaultStyle, bevel]) {
  const store = createThemeStore({
    storageKey: "settings-test",
    themes: [...builtinThemes, bevelDay],
    styles,
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <ThemeProvider store={store}>
        <StyleSetting />
      </ThemeProvider>,
    ),
  );
  unmount = () => {
    act(() => root.unmount());
    container.remove();
    store.dispose();
  };
  return { store, container };
}

describe("StyleSetting", () => {
  it("draws nothing while the site offers one style", () => {
    expect(draw([defaultStyle]).container.innerHTML).toBe("");
  });

  it("offers each style, checking the committed one, and switches on a pick", () => {
    const { store, container } = draw();
    const radios = [...container.querySelectorAll("[role=radio]")];
    expect(radios.map((r) => r.nextElementSibling?.textContent)).toEqual([
      "Default",
      "Bevel",
    ]);
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual([
      "true",
      "false",
    ]);
    act(() => (radios[1] as HTMLElement).click());
    expect(store.getStyle()).toBe("bevel");
    expect(store.getPref().ui?.theme).toBe("bevel-day");
    expect(radios[1]?.getAttribute("aria-checked")).toBe("true");
  });
});

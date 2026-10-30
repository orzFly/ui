// @vitest-environment happy-dom
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  builtinThemes,
  defaultStyle,
  type Theme,
  themesForStyle,
} from "@orz/themes";
import { createThemeStore, ThemeProvider } from "@orz/ui/theme";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { loadCsf } from "storybook/internal/csf-tools";
import { afterEach, describe, expect, it } from "vitest";
import Home from "../src/content/index.mdx";
import { YourTheme } from "../src/home/your-theme.tsx";
import { installOf, mdxComponents } from "../src/mdx.tsx";
import { pages } from "../src/pages.ts";
import { storybookHref } from "../src/routes.ts";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// A path, not a URL: happy-dom's URL will not read a file: one.
const STORIES = join(import.meta.dirname, "../../storybook/src");
const storyTitles = readdirSync(STORIES)
  .filter((file) => file.endsWith(".stories.tsx"))
  .map((file) => {
    const text = readFileSync(join(STORIES, file), "utf8");
    const csf = loadCsf(text, { fileName: file, makeTitle: (title) => title });
    return csf.parse().meta?.title ?? "";
  });

/** The page as the prerender draws it: no theme store, nothing hydrated. */
function prerendered() {
  const html = renderToString(<Home components={mdxComponents} />);
  const host = document.createElement("div");
  host.innerHTML = html;
  return host;
}

const descriptionOf = (route: string) =>
  pages.find((page) => page.route === route)?.meta.description;

describe("the home page, prerendered", () => {
  const page = prerendered();

  it("has one h1, and an h2 per module", () => {
    expect(page.querySelectorAll("h1")).toHaveLength(1);
    expect(
      [...page.querySelectorAll("h2")].map((h2) => h2.textContent),
    ).toEqual([
      "Your theme",
      "For agents",
      "Tasks",
      "CI #1284 · Test",
      "feat: retry a failed fetch once before giving up",
      "Install and test",
      "By AI, for AI",
      "Packages",
    ]);
  });

  it("carries @orz/ui's generated install line", () => {
    const { command } = installOf("@orz/ui");
    expect(page.querySelector(`[aria-label="Copy ${command}"]`)).not.toBeNull();
    expect(page.textContent).toContain(command);
  });

  it("lists the route for agents in order, each with its page's description", () => {
    const rows = [...page.querySelectorAll("ol > li > a")].map((a) => ({
      href: a.getAttribute("href"),
      text: a.textContent,
    }));
    expect(rows.map((row) => row.href)).toEqual([
      "/start/",
      "/guidelines/principles/",
      "/guidelines/",
      storybookHref("/"),
      "/demos/",
    ]);
    for (const [index, route] of [
      "/start/",
      "/guidelines/principles/",
      "/guidelines/",
    ].entries()) {
      expect(rows[index]?.text).toContain(descriptionOf(route));
    }
    expect(rows[4]?.text).toContain(descriptionOf("/demos/"));
  });

  it("links each module's components to a Storybook page that exists", () => {
    const linked = [...page.querySelectorAll("[data-slot=card-header] a")]
      .map((a) => a.getAttribute("href") ?? "")
      .filter((href) => href.includes("?path=/docs/"));
    expect(linked.length).toBeGreaterThan(0);
    const known = new Set(
      storyTitles.map((title) => storybookHref("/", title)),
    );
    for (const href of linked) expect(known, href).toContain(href);
  });

  it("shows the default style's themes with nothing picked", () => {
    const rows = [
      ...page.querySelectorAll<HTMLButtonElement>(
        "fieldset[aria-label=Theme] button",
      ),
    ];
    expect(rows.map(labelOf)).toEqual(
      themesForStyle(builtinThemes, defaultStyle.id).map(
        (theme) => theme.label,
      ),
    );
    expect(page.querySelector("[aria-pressed=true]")).toBeNull();
  });
});

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

function draw() {
  const store = createThemeStore({
    storageKey: "home-test",
    themes: [...builtinThemes, bevelDay],
    styles: [defaultStyle, bevel],
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <ThemeProvider store={store}>
        <YourTheme />
      </ThemeProvider>,
    ),
  );
  unmount = () => {
    act(() => root.unmount());
    container.remove();
    store.dispose();
  };
  const buttons = (label: string) => [
    ...container.querySelectorAll<HTMLButtonElement>(
      `[aria-label=${label}] button`,
    ),
  ];
  const named = (label: string, text: string) => {
    const button = buttons(label).find((b) => labelOf(b) === text);
    if (!button) throw new Error(`${label}: no ${text}`);
    return button;
  };
  return { store, container, buttons, named };
}

/** A button's name; a theme row's without the "dark only" beside it. */
const labelOf = (button: HTMLButtonElement) =>
  (button.querySelector(".truncate") ?? button).textContent;

const pressed = (buttons: HTMLButtonElement[]) =>
  buttons.filter((b) => b.getAttribute("aria-pressed") === "true").map(labelOf);

describe("YourTheme", () => {
  it("presses the store's style, theme and mode", () => {
    const { buttons } = draw();
    expect(pressed(buttons("Style"))).toEqual(["Default"]);
    expect(pressed(buttons("Theme"))).toEqual(["Default"]);
    expect(pressed(buttons("Mode"))).toEqual(["Auto"]);
  });

  it("commits a theme row, keeping the mode", () => {
    const { store, buttons, named } = draw();
    act(() => named("Mode", "Dark").click());
    act(() => named("Theme", "Solarized").click());
    expect(store.getPref().ui).toEqual({ theme: "solarized", mode: "dark" });
    expect(pressed(buttons("Theme"))).toEqual(["Solarized"]);
  });

  it("switches style through the store, listing that style's themes", () => {
    const { store, buttons, named } = draw();
    act(() => named("Style", "Bevel").click());
    expect(store.getStyle()).toBe("bevel");
    expect(buttons("Theme").map(labelOf)).toEqual(["Bevel Day"]);
    expect(pressed(buttons("Theme"))).toEqual(["Bevel Day"]);
  });

  it("previews a hovered row and a hovered style, and clears on leaving", () => {
    const { store, container, named } = draw();
    const group = container.querySelector(
      "fieldset[aria-label=Theme]",
    ) as HTMLElement;
    act(() => {
      named("Theme", "Nord").dispatchEvent(
        new PointerEvent("pointerover", { bubbles: true }),
      );
    });
    expect(store.getPreview()).toEqual({
      ui: { theme: "nord", mode: "system" },
    });
    act(() => {
      group.dispatchEvent(new PointerEvent("pointerout", { bubbles: true }));
    });
    expect(store.getPreview()).toBeNull();
    act(() => {
      named("Style", "Bevel").dispatchEvent(
        new PointerEvent("pointerover", { bubbles: true }),
      );
    });
    expect(store.getPreview()).toEqual({ style: "bevel" });
    expect(store.getPref().ui?.theme).toBe("default");
  });

  it("previews a focused row and clears when focus leaves the list", () => {
    const { store, named } = draw();
    act(() => named("Theme", "Nord").focus());
    expect(store.getPreview()).toEqual({
      ui: { theme: "nord", mode: "system" },
    });
    act(() => named("Mode", "Light").focus());
    expect(store.getPreview()).toBeNull();
  });

  it("lets the keyboard reach every control", () => {
    const { container } = draw();
    const controls = [...container.querySelectorAll("button")];
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      expect(control.tabIndex, control.textContent ?? "").toBe(0);
    }
  });
});

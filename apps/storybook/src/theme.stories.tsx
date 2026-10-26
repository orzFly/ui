import {
  builtinThemes,
  type ColorScheme,
  schemesOf,
  TOKEN_NAMES,
  variantsOf,
} from "@orz/themes";
import { ThemeMenu } from "@orz/ui/components/theme-menu";
import {
  createThemeStore,
  ThemeProvider as ThemeProviderView,
  type ThemeStore,
  useTerminalTheme,
  useTheme,
  useThemeSlots,
} from "@orz/ui/theme";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Header, PageSample } from "./fixtures/themes.tsx";

const USE_THEME = `import { useTheme } from "@orz/ui/theme";

const { theme, colorScheme, variant, pref, themes, setPref, preview } = useTheme();
// theme.label, colorScheme ("light" | "dark"), variant: what is shown, a preview included; pref is the committed pick
setPref({ ...pref, ui: { theme: "dracula", mode: "dark" } });`;

const THEME_PROVIDER = `import { builtinThemes } from "@orz/themes";
import { ThemeMenu } from "@orz/ui/components/theme-menu";
import { createThemeStore, ThemeProvider } from "@orz/ui/theme";

// Once, at module load: the store paints <html> (or \`root\`) as soon as it exists.
const store = createThemeStore({ storageKey: "app-theme", themes: builtinThemes, terminalThemes: builtinThemes });

export function App() {
  return <ThemeProvider store={store}><ThemeMenu />…</ThemeProvider>;
}`;

const USE_THEME_SLOTS = `import { useThemeSlots } from "@orz/ui/theme";

const { ui, terminal } = useThemeSlots();
// createThemeStore({ themes }) → { ui: true, terminal: false }
// createThemeStore({ terminalThemes }) → { ui: false, terminal: true }
// outside any ThemeProvider → { ui: true, terminal: false }`;

/** Pick a theme from the toolbar, or click a swatch below; this page follows it. */
const meta = {
  title: "ui/Foundations/Theme",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Swatch({ surface, accent }: { surface: string; accent: string }) {
  return (
    <span
      aria-hidden
      className="inline-flex size-6 shrink-0 overflow-hidden rounded-full border"
    >
      <span className="w-1/2" style={{ background: surface }} />
      <span className="w-1/2" style={{ background: accent }} />
    </span>
  );
}

export const Usage: Story = {
  parameters: { docs: { source: { code: USE_THEME, language: "tsx" } } },
  render: function Render() {
    const { pref, themes, theme, colorScheme, variant, setPref } = useTheme();
    const terminal = useTerminalTheme();
    const ui = pref.ui;
    return (
      <div className="grid gap-8">
        <section className="grid gap-3">
          <h2 className="font-heading text-base font-medium">
            Active: {theme.label} ({colorScheme}
            {variant !== "default" ? `, ${variant}` : ""}
            {ui?.mode === "system" ? ", following the system" : ""}) · terminal:{" "}
            {terminal.following
              ? "following"
              : `${terminal.theme.label} (${terminal.colorScheme})`}
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2">
            {TOKEN_NAMES.map((token) => (
              <div
                key={token}
                className="flex items-center gap-2 rounded-md border p-1.5"
              >
                <span
                  aria-hidden
                  className="size-8 shrink-0 rounded-sm border"
                  style={{ background: `var(--${token})` }}
                />
                <code className="text-xs">--{token}</code>
              </div>
            ))}
          </div>
        </section>
        <section className="grid gap-3">
          <h2 className="font-heading text-base font-medium">All themes</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-2">
            {themes.map((t) => (
              <div
                key={t.id}
                className="grid content-start gap-2 rounded-md border p-2"
              >
                <span className="grid">
                  <span className="text-sm">{t.label}</span>
                  <code className="text-xs text-muted-foreground">{t.id}</code>
                </span>
                <div className="flex flex-wrap gap-1">
                  {schemesOf(t).flatMap((scheme: ColorScheme) =>
                    variantsOf(t)
                      .filter(
                        (v) =>
                          v.id === "default" ||
                          t[scheme]?.variants?.[v.id] !== undefined,
                      )
                      .map((v) => {
                        const palette = t[scheme];
                        const tokens = {
                          ...palette?.tokens,
                          ...(v.id === "default"
                            ? {}
                            : palette?.variants?.[v.id]?.tokens),
                        };
                        const active =
                          ui?.theme === t.id &&
                          colorScheme === scheme &&
                          variant === v.id;
                        const name = `${palette?.label ?? scheme}${v.id === "default" ? "" : ` ${v.label}`}`;
                        return (
                          <button
                            key={`${scheme}:${v.id}`}
                            type="button"
                            title={`${t.label} ${name}`}
                            data-active={active || undefined}
                            onClick={() =>
                              setPref({
                                ...pref,
                                ui: {
                                  theme: t.id,
                                  mode: scheme,
                                  ...(v.id === "default"
                                    ? {}
                                    : { variant: v.id }),
                                },
                              })
                            }
                            className="flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-xs data-active:ring-2 data-active:ring-ring"
                          >
                            <Swatch
                              surface={tokens.background ?? ""}
                              accent={tokens.primary ?? ""}
                            />
                            {name}
                          </button>
                        );
                      }),
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  },
};

/**
 * Every story here already sits under the toolbar's `ThemeProvider`
 * (`preview.tsx`); this one nests a provider over a store of its own, and the
 * nearest provider wins. `root` scopes the store's painting to this box.
 */
export const ThemeProvider: Story = {
  parameters: { docs: { source: { code: THEME_PROVIDER, language: "tsx" } } },
  render: function Render() {
    const ref = useRef<HTMLDivElement>(null);
    const [store, setStore] = useState<ThemeStore | null>(null);
    // A layout effect, so the box's first paint is already in its theme.
    useLayoutEffect(() => {
      // Storybook's jsxDecorator also calls this render as a plain function
      // and discards what it returns, so that copy's ref never attaches; a
      // store with no root would paint the whole page.
      const root = ref.current;
      if (!root) return;
      const own = createThemeStore({
        storageKey: "orz-storybook-theme-provider",
        persistPref: false,
        persistCustomThemes: false,
        root,
        themes: builtinThemes,
      });
      own.setPref({ ui: { theme: "dracula", mode: "dark" } });
      setStore(own);
      return () => own.dispose();
    }, []);
    return (
      <div
        ref={ref}
        className="grid gap-4 rounded-lg border bg-background p-4 text-foreground"
      >
        {store && (
          <ThemeProviderView store={store}>
            <Header>
              <ThemeMenu />
            </Header>
            <PageSample />
          </ThemeProviderView>
        )}
      </div>
    );
  },
};

/** Reads `useThemeSlots()` where it is rendered, as a definition-list row. */
function Slots({ label }: { label: string }) {
  const s = useThemeSlots();
  return (
    <>
      <dt>{label}</dt>
      <dd>
        <code>{JSON.stringify(s)}</code>
      </dd>
    </>
  );
}

/** Which slots the nearest store has, so a component can hide what it lacks. */
export const UseThemeSlots: Story = {
  name: "useThemeSlots",
  parameters: {
    docs: { source: { code: USE_THEME_SLOTS, language: "tsx" } },
  },
  render: function Render() {
    // Detached roots: neither store paints anything visible.
    const [stores] = useState(() => ({
      ui: createThemeStore({
        storageKey: "orz-storybook-slots-ui",
        persistPref: false,
        persistCustomThemes: false,
        root: document.createElement("div"),
        themes: builtinThemes,
      }),
      terminal: createThemeStore({
        storageKey: "orz-storybook-slots-terminal",
        persistPref: false,
        persistCustomThemes: false,
        root: document.createElement("div"),
        terminalThemes: builtinThemes,
      }),
    }));
    useEffect(
      () => () => {
        stores.ui.dispose();
        stores.terminal.dispose();
      },
      [stores],
    );
    return (
      <dl className="grid w-fit grid-cols-[auto_auto] gap-x-6 gap-y-1 text-sm">
        <Slots label="The toolbar's store" />
        <ThemeProviderView store={stores.ui}>
          <Slots label="createThemeStore({ themes })" />
        </ThemeProviderView>
        <ThemeProviderView store={stores.terminal}>
          <Slots label="createThemeStore({ terminalThemes })" />
        </ThemeProviderView>
      </dl>
    );
  },
};

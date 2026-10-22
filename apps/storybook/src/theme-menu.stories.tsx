import {
  builtinThemes,
  type CustomTheme,
  type TerminalTheme,
  type TerminalTokens,
} from "@orz/themes";
import { ThemeMenu } from "@orz/ui/components/theme-menu";
import {
  createThemeStore,
  ThemeProvider,
  type ThemeStoreOptions,
  useTerminalTheme,
  useTheme,
} from "@orz/ui/theme";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { fn } from "storybook/test";

/**
 * Picks a theme for one slot of the store: filter, Auto / Light / Dark, and
 * each theme's variants in a submenu. Hovering a row previews it on the page.
 */
const meta = {
  title: "Patterns/ThemeMenu",
  component: ThemeMenu,
  parameters: {
    // Each story but Default paints the page from a store of its own; in one
    // docs page they would repaint each other.
    docs: { story: { inline: false, iframeHeight: 520 } },
  },
} satisfies Meta<typeof ThemeMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Drives the toolbar's store, so a pick here changes the whole preview. */
export const Default: Story = {};

/**
 * A store of the story's own, under its own storage key, so playing here
 * leaves the toolbar's pick alone. On the way out it hands the page back to
 * the toolbar's store.
 */
function OwnStore({
  options,
  setup,
  children,
}: {
  options: ThemeStoreOptions;
  setup?: (store: ReturnType<typeof createThemeStore>) => void;
  children: ReactNode;
}) {
  const toolbar = useTheme();
  const toolbarRef = useRef(toolbar);
  toolbarRef.current = toolbar;
  const [store] = useState(() => {
    const created = createThemeStore(options);
    setup?.(created);
    return created;
  });
  useEffect(
    () => () => {
      store.dispose();
      // Both stores paint <html>; the toolbar's repaints its own pick.
      const { pref, setPref } = toolbarRef.current;
      setPref(pref);
    },
    [store],
  );
  return <ThemeProvider store={store}>{children}</ThemeProvider>;
}

function terminalTokens(
  background: string,
  foreground: string,
  ansi: string[],
): TerminalTokens {
  const names = [
    "black",
    "red",
    "green",
    "yellow",
    "blue",
    "magenta",
    "cyan",
    "white",
  ] as const;
  const tokens: Record<string, string> = {
    "terminal-background": background,
    "terminal-foreground": foreground,
    "terminal-cursor": foreground,
    "terminal-selection": `color-mix(in oklab, ${foreground} 25%, transparent)`,
  };
  names.forEach((name, i) => {
    tokens[`ansi-${name}`] = ansi[i] as string;
    tokens[`ansi-bright-${name}`] = ansi[i + 8] as string;
  });
  return tokens as TerminalTokens;
}

/** Terminal-only themes: terminal colours and nothing else. */
const ember: TerminalTheme = {
  id: "ember",
  label: "Ember",
  dark: {
    terminal: terminalTokens("#1b1410", "#eadccf", [
      "#2a201a",
      "#e0603c",
      "#9fbf5a",
      "#e8b04a",
      "#6f97c6",
      "#c47aa8",
      "#5fb3a6",
      "#d6c8ba",
      "#5a4a3e",
      "#ff8a63",
      "#bedb7a",
      "#ffcf6e",
      "#94b8e3",
      "#e29cc5",
      "#83d1c4",
      "#fff3e6",
    ]),
  },
};
const glacier: TerminalTheme = {
  id: "glacier",
  label: "Glacier",
  light: {
    terminal: terminalTokens("#f4f8fb", "#1f2d3a", [
      "#1f2d3a",
      "#c0392b",
      "#2e8b57",
      "#b7791f",
      "#2b6cb0",
      "#8e44ad",
      "#138d90",
      "#cbd5e0",
      "#4a5568",
      "#e53e3e",
      "#38a169",
      "#d69e2e",
      "#3182ce",
      "#9f7aea",
      "#0bc5ea",
      "#ffffff",
    ]),
  },
};

function TerminalPane() {
  const { tokens, theme, following } = useTerminalTheme();
  const c = (name: keyof TerminalTokens) => ({ color: tokens[name] });
  const prompt = (
    <>
      <span style={c("ansi-green")}>user@app</span>:
      <span style={c("ansi-blue")}>~/project</span>${" "}
    </>
  );
  return (
    <section className="grid gap-2 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-medium">
          Terminal{" "}
          <span className="text-muted-foreground">
            {following ? `(same as UI: ${theme.label})` : `(${theme.label})`}
          </span>
        </h2>
        <ThemeMenu slot="terminal" />
      </div>
      <pre
        className="overflow-x-auto rounded-md p-3 font-mono text-sm leading-relaxed"
        style={{
          backgroundColor: tokens["terminal-background"],
          color: tokens["terminal-foreground"],
        }}
      >
        {prompt}git status --short{"\n"}
        <span style={c("ansi-green")}>A</span>
        {"  "}packages/themes/src/index.ts{"\n"}{" "}
        <span style={c("ansi-red")}>D</span> src/theme/themes.ts{"\n"}{" "}
        <span style={c("ansi-yellow")}>M</span> styles.css{"\n"}
        {prompt}pnpm test{"\n"} <span style={c("ansi-green")}>✓</span>{" "}
        store.test.ts <span style={c("ansi-bright-black")}>(42)</span>{" "}
        <span style={c("ansi-magenta")}>picker</span>{" "}
        <span style={c("ansi-cyan")}>filter</span>{" "}
        <span style={c("ansi-red")}>✗ 0 failed</span>
        {"\n"}
        {prompt}
        <span
          style={{
            backgroundColor: tokens["terminal-cursor"],
            color: tokens["terminal-background"],
          }}
        >
          {" "}
        </span>
      </pre>
    </section>
  );
}

function PageSample() {
  return (
    <section className="grid gap-3 rounded-lg border bg-card p-4 text-card-foreground">
      <h2 className="font-heading text-sm font-medium">Sample surface</h2>
      <p className="text-muted-foreground text-sm">
        Everything here reads the tokens the picker writes, so a preview shows
        at a glance.
      </p>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-md bg-primary px-3 py-1 text-primary-foreground text-sm">
          Primary
        </span>
        <span className="rounded-md bg-secondary px-3 py-1 text-secondary-foreground text-sm">
          Secondary
        </span>
        <span className="rounded-md bg-accent px-3 py-1 text-accent-foreground text-sm">
          Accent
        </span>
      </div>
    </section>
  );
}

function Header({ children }: { children?: ReactNode }) {
  return (
    <header className="flex items-center justify-between border-b pb-2">
      <span className="font-medium text-sm">app.example</span>
      <div className="flex items-center gap-1">{children}</div>
    </header>
  );
}

/**
 * Both slots: the UI picker in the header, and a terminal pane with a picker
 * of its own. "Same as UI" follows the page, previews included.
 */
export const UiAndTerminal: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <OwnStore
      options={{
        storageKey: "orz-storybook-theme-menu-slots",
        themes: builtinThemes,
        terminalThemes: [...builtinThemes, ember, glacier],
      }}
    >
      <div className="grid max-w-2xl gap-4">
        <Header>
          <ThemeMenu />
        </Header>
        <PageSample />
        <TerminalPane />
      </div>
    </OwnStore>
  ),
};

const customThemes: CustomTheme[] = [
  {
    id: "custom-paper-ink",
    label: "Paper & Ink",
    light: {
      base: { theme: "solarized" },
      tokens: { primary: "oklch(0.55 0.18 40)" },
    },
    dark: {
      base: { theme: "dracula", variant: "amoled" },
      terminal: { base: { theme: "nord" } },
    },
  },
  {
    id: "custom-forest",
    label: "Forest",
    dark: {
      base: { theme: "gruvbox" },
      tokens: {
        primary: "oklch(0.72 0.15 145)",
        ring: "oklch(0.72 0.15 145)",
      },
    },
  },
];

/** Two custom themes lead the list; "Custom themes…" and the edit buttons call `onCustomize`. */
export const CustomThemes: Story = {
  parameters: { layout: "padded" },
  args: { onCustomize: fn() },
  render: (args) => (
    <OwnStore
      options={{
        storageKey: "orz-storybook-theme-menu-custom",
        themes: builtinThemes,
        persistCustomThemes: false,
      }}
      setup={(store) => store.setCustomThemes(customThemes)}
    >
      <div className="grid max-w-2xl gap-4">
        <Header>
          <ThemeMenu onCustomize={args.onCustomize} />
        </Header>
        <PageSample />
      </div>
    </OwnStore>
  ),
};

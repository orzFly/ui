import type {
  CustomTerminalTheme,
  CustomTheme,
  TerminalTheme,
  TerminalTokens,
} from "@orz/themes";
import { ThemeMenu } from "@orz/ui/components/theme-menu";
import {
  createThemeStore,
  ThemeProvider,
  type ThemeStoreOptions,
  useTerminalTheme,
  useTheme,
} from "@orz/ui/theme";
import { type ReactNode, useEffect, useRef, useState } from "react";

/**
 * A store of the story's own, under its own storage key, so playing here
 * leaves the toolbar's pick alone. On the way out it hands the page back to
 * the toolbar's store.
 */
export function OwnStore({
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

/**
 * One custom theme of each shape the editor handles: based with overrides,
 * fully custom on a based terminal, and one whose base this app lacks.
 */
export const sampleCustomThemes: CustomTheme[] = [
  {
    id: "custom-paper-ink",
    label: "Paper & Ink",
    light: {
      base: { theme: "solarized" },
      tokens: { primary: "oklch(0.55 0.18 40)" },
    },
    dark: {
      base: { theme: "dracula", variant: "amoled" },
      tokens: {
        primary: "oklch(0.78 0.14 60)",
        ring: "oklch(0.78 0.14 60)",
      },
      terminal: { base: { theme: "nord" } },
    },
  },
  {
    id: "custom-harbor",
    label: "Harbor",
    dark: {
      tokens: {
        "diff-addition": "#4fb38a",
        "diff-deletion": "#e0645c",
        background: "oklch(0.2 0.03 235)",
        foreground: "oklch(0.93 0.02 220)",
        card: "oklch(0.24 0.035 235)",
        "card-foreground": "oklch(0.93 0.02 220)",
        popover: "oklch(0.24 0.035 235)",
        "popover-foreground": "oklch(0.93 0.02 220)",
        primary: "oklch(0.76 0.12 200)",
        "primary-foreground": "oklch(0.2 0.03 235)",
        secondary: "oklch(0.3 0.04 235)",
        "secondary-foreground": "oklch(0.93 0.02 220)",
        muted: "oklch(0.3 0.04 235)",
        "muted-foreground": "oklch(0.7 0.03 225)",
        accent: "oklch(0.34 0.05 220)",
        "accent-foreground": "oklch(0.95 0.02 220)",
        destructive: "oklch(0.66 0.19 25)",
        success: "oklch(0.74 0.14 160)",
        warning: "oklch(0.8 0.13 85)",
        border: "oklch(0.34 0.04 235)",
        input: "oklch(0.38 0.04 235)",
        ring: "oklch(0.76 0.12 200)",
        marker: "oklch(0.36 0.05 222.19)",
        "chart-1": "oklch(0.76 0.12 200)",
        "chart-2": "oklch(0.74 0.14 160)",
        "chart-3": "oklch(0.8 0.13 85)",
        "chart-4": "oklch(0.7 0.15 300)",
        "chart-5": "oklch(0.68 0.17 25)",
        sidebar: "oklch(0.17 0.03 235)",
        "sidebar-foreground": "oklch(0.93 0.02 220)",
        "sidebar-primary": "oklch(0.76 0.12 200)",
        "sidebar-primary-foreground": "oklch(0.2 0.03 235)",
        "sidebar-accent": "oklch(0.3 0.04 235)",
        "sidebar-accent-foreground": "oklch(0.93 0.02 220)",
        "sidebar-border": "oklch(0.3 0.04 235)",
        "sidebar-ring": "oklch(0.76 0.12 200)",
      },
      terminal: {
        base: { theme: "tokyo-night", scheme: "dark" },
        tokens: { "terminal-background": "#0f1d2b" },
      },
    },
  },
  {
    id: "custom-driftwood",
    label: "Driftwood",
    light: {
      base: { theme: "seashell" },
      tokens: { primary: "oklch(0.5 0.08 60)" },
    },
  },
];

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
    "terminal-selection": `${foreground}40`,
  };
  names.forEach((name, i) => {
    tokens[`ansi-${name}`] = ansi[i] as string;
    tokens[`ansi-bright-${name}`] = ansi[i + 8] as string;
  });
  return tokens as TerminalTokens;
}

/** Terminal-only themes: terminal colours and nothing else. */
export const ember: TerminalTheme = {
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
export const glacier: TerminalTheme = {
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

/**
 * Terminal custom themes: one based on Ember with two colours changed, and
 * one fully custom.
 */
export const sampleTerminalThemes: CustomTerminalTheme[] = [
  {
    id: "custom-ember-dusk",
    kind: "terminal",
    label: "Ember dusk",
    dark: {
      base: { theme: "ember" },
      tokens: { "ansi-red": "#f0503a", "terminal-background": "#140e0b" },
    },
  },
  {
    id: "custom-moss",
    kind: "terminal",
    label: "Moss",
    light: {
      tokens: terminalTokens("#f3f5ee", "#2c3324", [
        "#2c3324",
        "#b8442f",
        "#4f7a2e",
        "#a77b1c",
        "#3c6a8c",
        "#8a4f7d",
        "#2f7f72",
        "#d5dacb",
        "#5d6651",
        "#d65a42",
        "#69983f",
        "#c79a2e",
        "#5287ab",
        "#a86a9a",
        "#45a08f",
        "#ffffff",
      ]),
    },
  },
];

export function PageSample() {
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

export function Header({ children }: { children?: ReactNode }) {
  return (
    <header className="flex items-center justify-between border-b pb-2">
      <span className="font-medium text-sm">app.example</span>
      <div className="flex items-center gap-1">{children}</div>
    </header>
  );
}

export function TerminalPane({
  onCustomize,
}: {
  onCustomize?: (id: string | undefined, slot: "ui" | "terminal") => void;
} = {}) {
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
        <ThemeMenu slot="terminal" onCustomize={onCustomize} />
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

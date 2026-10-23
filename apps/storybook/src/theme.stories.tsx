import {
  type ColorScheme,
  schemesOf,
  TOKEN_NAMES,
  variantsOf,
} from "@orz/themes";
import { useTerminalTheme, useTheme } from "@orz/ui/theme";
import type { Meta, StoryObj } from "@storybook/react-vite";

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

export const Overview: Story = {
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

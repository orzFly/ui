import { THEMES, useTheme } from "@orz/ui/theme";
import type { Meta, StoryObj } from "@storybook/react-vite";

const TOKENS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
  "diff-addition",
  "diff-deletion",
];

/** Pick a theme from the toolbar; this page follows it. */
const meta = {
  title: "Theme",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: function Render() {
    const { pref, theme, kind } = useTheme();
    return (
      <div className="grid gap-8">
        <section className="grid gap-3">
          <h2 className="font-heading text-base font-medium">
            Active: {theme} ({kind}
            {pref === "system" ? ", following the system" : ""})
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2">
            {TOKENS.map((token) => (
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-2">
            {THEMES.map((t) => (
              <div
                key={t.value}
                data-active={t.value === theme || undefined}
                className="flex items-center gap-2 rounded-md border p-2 data-active:ring-2 data-active:ring-ring"
              >
                <span
                  aria-hidden
                  className="inline-flex size-8 shrink-0 overflow-hidden rounded-full border"
                >
                  <span className="w-1/2" style={{ background: t.surface }} />
                  <span className="w-1/2" style={{ background: t.accent }} />
                </span>
                <span className="grid">
                  <span className="text-sm">{t.label}</span>
                  <code className="text-xs text-muted-foreground">
                    {t.value} · {t.kind}
                  </code>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  },
};

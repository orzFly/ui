import { TERMINAL_TOKEN_NAMES } from "@orz/themes";
import { useTerminalTheme } from "@orz/ui/theme";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * The terminal tokens: the 16 ANSI colours and the terminal's own surface,
 * cursor and selection. Pick a Terminal theme from the toolbar, or leave it
 * following the page's theme.
 */
const meta = {
  title: "ui/Foundations/Terminal",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const ANSI = TERMINAL_TOKEN_NAMES.filter((name) => name.startsWith("ansi-"));

const USE_TERMINAL_THEME = `import { xtermTheme } from "@orz/themes";
import { useTerminalTheme } from "@orz/ui/theme";

const { theme, colorScheme, variant, following, tokens } = useTerminalTheme();
// following: the terminal shows the UI's theme; tokens["ansi-red"], tokens["terminal-background"], …
const xterm = xtermTheme(tokens);`;

export const Usage: Story = {
  parameters: {
    docs: { source: { code: USE_TERMINAL_THEME, language: "tsx" } },
  },
  render: function Render() {
    const terminal = useTerminalTheme();
    return (
      <div className="grid gap-8">
        <section className="grid gap-3">
          <h2 className="font-heading text-base font-medium">
            {terminal.theme.label} ({terminal.colorScheme}
            {terminal.variant !== "default" ? `, ${terminal.variant}` : ""}
            {terminal.following ? ", following the theme" : ""})
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2">
            {ANSI.map((name) => (
              <div
                key={name}
                className="flex items-center gap-2 rounded-md border p-1.5"
              >
                <span
                  aria-hidden
                  className="size-8 shrink-0 rounded-sm border"
                  style={{ background: `var(--${name})` }}
                />
                <span className="grid">
                  <code className="text-xs">--{name}</code>
                  <code className="text-xs text-muted-foreground">
                    {terminal.tokens[name]}
                  </code>
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="grid gap-3">
          <h2 className="font-heading text-base font-medium">Sample</h2>
          <pre className="overflow-x-auto rounded-md bg-terminal-background p-4 font-mono text-sm leading-relaxed text-terminal-foreground">
            <span className="text-ansi-green">user@host</span>:
            <span className="text-ansi-blue">~/project</span>$ ls --color{"\n"}
            <span className="text-ansi-bright-blue">src</span>
            {"  "}
            <span className="text-ansi-bright-blue">test</span>
            {"  "}
            <span className="text-ansi-bright-green">build.sh</span>
            {"  "}README.md{"  "}
            <span className="text-ansi-bright-red">dist.tar.gz</span>
            {"  "}
            <span className="text-ansi-cyan">latest</span>
            {"\n"}
            <span className="text-ansi-green">user@host</span>:
            <span className="text-ansi-blue">~/project</span>$ git diff{"\n"}
            <span className="font-bold">diff --git a/app.ts b/app.ts</span>
            {"\n"}
            <span className="text-ansi-cyan">@@ -1,3 +1,3 @@</span>
            {"\n"}
            <span className="text-ansi-red">-const greeting = "hello";</span>
            {"\n"}
            <span className="text-ansi-green">+const greeting = "hi";</span>
            {"\n"}
            <span className="text-ansi-yellow">warning:</span> 1 file changed
            {"\n"}
            <span className="text-ansi-magenta">note:</span>{" "}
            <span className="text-ansi-bright-black">
              dimmed text in bright black
            </span>
            {"\n"}
            <span className="bg-ansi-black text-ansi-white"> black/white </span>{" "}
            <span className="bg-ansi-bright-black text-ansi-bright-white">
              {" "}
              bright black/white{" "}
            </span>
            {"\n"}
            <span className="text-ansi-green">user@host</span>:
            <span className="text-ansi-blue">~/project</span>${" "}
            <span className="bg-terminal-selection">a selected span</span>{" "}
            <span className="bg-terminal-cursor text-terminal-background">
              {" "}
            </span>
          </pre>
        </section>
      </div>
    );
  },
};

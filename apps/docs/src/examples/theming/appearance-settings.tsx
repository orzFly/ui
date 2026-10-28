import { Button } from "@orz/ui/components/button";
import { Label } from "@orz/ui/components/label";
import { ThemeEditor } from "@orz/ui/components/theme-editor";
import { ThemeMenu } from "@orz/ui/components/theme-menu";
import { useTerminalTheme, useTheme } from "@orz/ui/theme";
import { PaletteIcon } from "lucide-react";
import { useState } from "react";

const TEST_LOG: [string, string?][][] = [
  [["✓", "text-ansi-green"], [" test/retry.test.ts (4 tests)"]],
  [["✓", "text-ansi-green"], [" test/fetch-task.test.ts (9 tests)"]],
  [
    ["×", "text-ansi-red"],
    [" test/flaky.test.ts (1 test | "],
    ["1 failed", "text-ansi-red"],
    [")"],
  ],
  [
    ["Tests ", "text-ansi-bright-black"],
    ["1 failed", "text-ansi-red"],
    [" | "],
    ["16 passed", "text-ansi-green"],
    [" (17)"],
  ],
];

type Editing = { id: string | undefined; slot: "ui" | "terminal" } | null;

export function AppearanceSettings() {
  const { theme, colorScheme, variant } = useTheme();
  const terminal = useTerminalTheme();
  const [editing, setEditing] = useState<Editing>(null);
  const customize = (id: string | undefined, slot: "ui" | "terminal") =>
    setEditing({ id, slot });
  return (
    <div className="grid divide-y">
      <div className="flex items-center justify-between gap-4 py-3">
        <div className="grid gap-1">
          <Label htmlFor="appearance-theme">Theme</Label>
          <p className="text-muted-foreground text-sm">
            A pick repaints the whole page, this text included.
          </p>
        </div>
        <ThemeMenu
          onCustomize={customize}
          trigger={({ Icon, label }) => (
            <Button
              id="appearance-theme"
              variant="outline"
              aria-label={`${label}: ${theme.label}`}
              className="max-w-48"
            >
              <Icon />
              <span className="truncate">
                {theme.label}
                {variant !== "default" && `, ${variant}`}
              </span>
              <span className="sr-only">, {colorScheme}</span>
            </Button>
          )}
        />
      </div>
      <div className="grid gap-3 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="grid gap-1">
            <Label htmlFor="appearance-terminal-theme">Terminal theme</Label>
            <p className="text-muted-foreground text-sm">
              For logs and recordings. It can follow the theme or keep its own.
            </p>
          </div>
          <ThemeMenu
            slot="terminal"
            onCustomize={customize}
            trigger={({ Icon, label }) => (
              <Button
                id="appearance-terminal-theme"
                variant="outline"
                aria-label={`${label}: ${terminal.following ? "follows the theme" : terminal.theme.label}`}
                className="max-w-48"
              >
                <Icon />
                <span className="truncate">
                  {terminal.following
                    ? "Follows the theme"
                    : terminal.theme.label}
                </span>
              </Button>
            )}
          />
        </div>
        <pre className="overflow-x-auto rounded-lg bg-terminal-background p-3 font-mono text-terminal-foreground text-xs leading-5">
          {TEST_LOG.map((line) => (
            <div key={line.map(([text]) => text).join("")}>
              {line.map(([text, color]) => (
                <span key={text} className={color}>
                  {text}
                </span>
              ))}
            </div>
          ))}
        </pre>
      </div>
      <div className="flex items-center justify-between gap-4 py-3">
        <div className="grid gap-1">
          <Label htmlFor="appearance-custom-themes">Custom themes</Label>
          <p className="text-muted-foreground text-sm">
            Start from a theme and change its colours, or import one.
          </p>
        </div>
        <Button
          id="appearance-custom-themes"
          variant="outline"
          onClick={() => customize(undefined, "ui")}
        >
          <PaletteIcon />
          Edit…
        </Button>
      </div>
      <ThemeEditor
        open={editing !== null}
        themeId={editing?.id}
        kind={editing?.slot}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
    </div>
  );
}

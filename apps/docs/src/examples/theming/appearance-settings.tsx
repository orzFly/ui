import { Button } from "@orz/ui/components/button";
import { InfoPopover } from "@orz/ui/components/info-popover";
import { Label } from "@orz/ui/components/label";
import { Separator } from "@orz/ui/components/separator";
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
    <div className="grid">
      <div className="flex items-center justify-between gap-4 py-3">
        <div className="flex items-center gap-1">
          <Label htmlFor="appearance-theme">Theme</Label>
          <InfoPopover label="About theme">
            Shared with the menu in this site's top bar: a pick repaints the
            whole page.
          </InfoPopover>
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
      <Separator purpose="row" />
      <div className="grid gap-3 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <Label htmlFor="appearance-terminal-theme">Terminal theme</Label>
            <InfoPopover label="About terminal theme">
              For logs and recordings, such as a pull request's test output.
            </InfoPopover>
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
        <pre className="overflow-x-auto rounded-lg bg-terminal-background p-3 font-mono text-terminal-foreground text-ui-sm leading-5">
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
      <Separator purpose="row" />
      <div className="flex items-center justify-between gap-4 py-3">
        <Label htmlFor="appearance-custom-themes">Custom themes</Label>
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

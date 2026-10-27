import { ThemeEditor } from "@orz/ui/components/theme-editor";
import { ThemeMenu } from "@orz/ui/components/theme-menu";
import { useTerminalTheme, useTheme } from "@orz/ui/theme";
import { useState } from "react";

type Editing = { id: string | undefined; slot: "ui" | "terminal" } | null;

export function ThemeControls() {
  const { theme, colorScheme, variant } = useTheme();
  const terminal = useTerminalTheme();
  const [editing, setEditing] = useState<Editing>(null);
  const customize = (id: string | undefined, slot: "ui" | "terminal") =>
    setEditing({ id, slot });
  return (
    <div className="grid gap-3 text-sm">
      <div className="flex items-center gap-2">
        <ThemeMenu onCustomize={customize} />
        <span>
          {theme.label}, {colorScheme}
          {variant !== "default" && `, ${variant}`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <ThemeMenu slot="terminal" onCustomize={customize} />
        <span>
          Terminal:{" "}
          {terminal.following ? "follows the theme" : terminal.theme.label}
        </span>
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

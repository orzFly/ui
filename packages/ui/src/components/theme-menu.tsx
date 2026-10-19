import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { THEMES, themeKind, useTheme } from "../theme/index.ts";
import { Button } from "./button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu.tsx";

function Swatch({ surface, accent }: { surface: string; accent: string }) {
  return (
    <span
      aria-hidden
      className="inline-flex size-4 shrink-0 overflow-hidden rounded-full border"
    >
      <span className="w-1/2" style={{ backgroundColor: surface }} />
      <span className="w-1/2" style={{ backgroundColor: accent }} />
    </span>
  );
}

/** Theme picker (T-36): system + every named theme, from the provider's store. */
export function ThemeMenu() {
  const { pref, setPref } = useTheme();
  const TriggerIcon =
    pref === "system"
      ? MonitorIcon
      : themeKind(pref) === "dark"
        ? MoonIcon
        : SunIcon;

  const group = (kind: "light" | "dark") =>
    THEMES.filter((t) => t.kind === kind).map((t) => (
      <DropdownMenuItem key={t.value} onSelect={() => setPref(t.value)}>
        <Swatch surface={t.surface} accent={t.accent} />
        <span className="flex-1">{t.label}</span>
        {pref === t.value && <CheckIcon className="size-4" />}
      </DropdownMenuItem>
    ));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Theme">
          <TriggerIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[min(70vh,32rem)] w-52 overflow-y-auto"
      >
        <DropdownMenuItem onSelect={() => setPref("system")}>
          <MonitorIcon className="size-4 text-muted-foreground" />
          <span className="flex-1">System</span>
          {pref === "system" && <CheckIcon className="size-4" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Light
        </DropdownMenuLabel>
        {group("light")}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Dark
        </DropdownMenuLabel>
        {group("dark")}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

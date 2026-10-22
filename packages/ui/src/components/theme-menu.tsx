import type { ColorScheme, Palette } from "@orz/themes";
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "../theme/index.ts";
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

const SCHEME_LABEL: Record<ColorScheme, string> = {
  light: "Light",
  dark: "Dark",
};

/**
 * Theme picker (T-36): system, then every theme's light and dark palette,
 * from the provider's store. Sets the UI pick only, with default variants.
 */
export function ThemeMenu() {
  const { pref, themes, setPref } = useTheme();
  const ui = pref.ui;
  const TriggerIcon =
    ui?.mode === "dark"
      ? MoonIcon
      : ui?.mode === "light"
        ? SunIcon
        : MonitorIcon;
  const system = { theme: themes[0].id, mode: "system" } as const;
  const isSystem =
    ui?.theme === system.theme && ui.mode === "system" && !ui.variant;

  const group = (scheme: ColorScheme) =>
    themes.flatMap((theme) => {
      const palette: Palette | undefined = theme[scheme];
      if (palette === undefined) return [];
      const checked =
        ui?.theme === theme.id && ui.mode === scheme && !ui.variant;
      return (
        <DropdownMenuItem
          key={theme.id}
          onSelect={() =>
            setPref({ ...pref, ui: { theme: theme.id, mode: scheme } })
          }
        >
          <Swatch
            surface={palette.tokens.background}
            accent={palette.tokens.primary}
          />
          <span className="flex-1">
            {theme.label} {palette.label ?? SCHEME_LABEL[scheme]}
          </span>
          {checked && <CheckIcon className="size-4" />}
        </DropdownMenuItem>
      );
    });

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
        <DropdownMenuItem onSelect={() => setPref({ ...pref, ui: system })}>
          <MonitorIcon className="size-4 text-muted-foreground" />
          <span className="flex-1">System</span>
          {isSystem && <CheckIcon className="size-4" />}
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

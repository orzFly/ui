import {
  builtinThemes,
  defaultStyle,
  resolvePalette,
  schemesOf,
  type Theme,
  themesForStyle,
} from "@orz/themes";
import { Button } from "@orz/ui/components/button";
import { cn } from "@orz/ui/lib/utils";
import {
  type ThemeMode,
  type ThemePreview,
  useStyle,
  useTheme,
} from "@orz/ui/theme";
import { MonitorIcon, MoonIcon, PaletteIcon, SunIcon } from "lucide-react";
import { type FocusEvent, useEffect, useRef } from "react";
import { PRESSED } from "../example.tsx";
import { SITE_STYLES } from "../head.ts";
import { useHydrated } from "../hydrated.tsx";
import { HomeModule } from "./module.tsx";

// ThemeMenu's labels for the same three modes.
const MODES: { mode: ThemeMode; label: string; Icon: typeof SunIcon }[] = [
  { mode: "system", label: "Auto", Icon: MonitorIcon },
  { mode: "light", label: "Light", Icon: SunIcon },
  { mode: "dark", label: "Dark", Icon: MoonIcon },
];

/** A style's own themes, or every theme for a style that has none, as the store treats it. */
function themesShown(themes: readonly Theme[], style: string) {
  const own = themesForStyle(themes, style);
  return own.length > 0 ? own : themes;
}

/** ThemeMenu's swatch: each side's background, with its primary as a dot. */
function Swatch({ theme }: { theme: Theme }) {
  return (
    <span
      aria-hidden
      className="flex size-4 shrink-0 -rotate-45 overflow-hidden rounded-full border"
    >
      {schemesOf(theme).map((scheme) => {
        const palette = resolvePalette(theme, scheme);
        return (
          <span
            key={scheme}
            className="flex flex-1 items-end justify-center"
            style={{ backgroundColor: palette?.tokens.background }}
          >
            <span
              className="mb-0.5 size-1 rounded-full"
              style={{ backgroundColor: palette?.tokens.primary }}
            />
          </span>
        );
      })}
    </span>
  );
}

const TRACK = "grid gap-0.5 bg-muted p-0.5";
const SEGMENT = cn(
  "font-normal text-muted-foreground disabled:cursor-not-allowed",
  PRESSED,
);

/** Leaving `event`'s group, rather than moving inside it. */
const leaves = (event: FocusEvent<HTMLElement>) =>
  !event.currentTarget.contains(event.relatedTarget as Node | null);

/**
 * The site's style, theme and mode, in the open: the same store as the top
 * bar's Theme menu. The prerendered page knows no pick, so it shows the
 * default style's themes with nothing pressed.
 */
export function YourTheme({ className }: { className?: string }) {
  const hydrated = useHydrated();
  const style = useStyle();
  const { pref, themes, preview, setPref } = useTheme();
  const styles = hydrated ? style.styles : SITE_STYLES;
  const committedStyle = hydrated ? style.committed : undefined;
  const rows = hydrated
    ? themesShown(themes, style.committed)
    : themesShown(builtinThemes, defaultStyle.id);
  const pick = hydrated ? pref.ui : undefined;
  const mode = pick?.mode ?? "system";
  const current = rows.find((theme) => theme.id === pick?.theme);

  // Whether this module has a preview showing, so it never clears the menu's.
  const previewing = useRef(false);
  const show = (next: ThemePreview | null) => {
    if (next === null && !previewing.current) return;
    previewing.current = next !== null;
    preview(next);
  };
  const showRef = useRef(show);
  showRef.current = show;
  useEffect(() => () => showRef.current(null), []);

  const commitTheme = (id: string) => {
    previewing.current = false;
    setPref({ ...pref, ui: { theme: id, mode } });
  };
  const commitStyle = (id: string) => {
    previewing.current = false;
    style.setStyle(id);
  };
  const commitMode = (next: ThemeMode) => {
    if (pick === undefined) return;
    previewing.current = false;
    setPref({ ...pref, ui: { ...pick, mode: next } });
  };

  return (
    <HomeModule
      icon={<PaletteIcon />}
      title="Your theme"
      meta="whole site"
      api={["ui/Foundations/Theme"]}
      className={className}
    >
      <div className="grid gap-2 p-2" data-pagefind-ignore>
        {styles.length > 1 && (
          <fieldset
            aria-label="Style"
            className={cn(TRACK, "auto-cols-fr grid-flow-col")}
            onPointerLeave={() => show(null)}
            onBlur={(event) => leaves(event) && show(null)}
          >
            {styles.map(({ id, label }) => (
              <Button
                key={id}
                type="button"
                variant="ghost"
                size="sm"
                className={SEGMENT}
                aria-pressed={committedStyle === id}
                onClick={() => commitStyle(id)}
                onPointerEnter={() => show({ style: id })}
                onFocus={() => show({ style: id })}
              >
                {label}
              </Button>
            ))}
          </fieldset>
        )}
        <fieldset
          aria-label="Theme"
          className="h-[calc(var(--spacing-row)*4)] overflow-y-auto border"
          onPointerLeave={() => show(null)}
          onBlur={(event) => leaves(event) && show(null)}
        >
          {rows.map((theme) => {
            const schemes = schemesOf(theme);
            return (
              <button
                key={theme.id}
                type="button"
                aria-pressed={theme.id === current?.id}
                className="flex min-h-row w-full items-center gap-2 px-2 text-left text-ui outline-none transition-colors hover:bg-accent focus-visible:focus-ring-inset aria-pressed:bg-accent aria-pressed:font-medium aria-pressed:state-cue touch:min-h-11"
                onClick={() => commitTheme(theme.id)}
                onPointerEnter={() => show({ ui: { theme: theme.id, mode } })}
                onFocus={() => show({ ui: { theme: theme.id, mode } })}
              >
                <Swatch theme={theme} />
                <span className="min-w-0 flex-1 truncate">{theme.label}</span>
                {schemes.length === 1 && (
                  <span className="text-muted-foreground text-ui-sm">
                    {schemes[0]} only
                  </span>
                )}
              </button>
            );
          })}
        </fieldset>
        <fieldset aria-label="Mode" className={cn(TRACK, "grid-cols-3")}>
          {MODES.map(({ mode: value, label, Icon }) => {
            const schemes = current ? schemesOf(current) : [];
            const usable =
              current === undefined ||
              (value === "system"
                ? schemes.length === 2
                : schemes.includes(value));
            return (
              <Button
                key={value}
                type="button"
                variant="ghost"
                size="sm"
                className={SEGMENT}
                aria-pressed={pick?.mode === value}
                disabled={hydrated && !usable}
                onClick={() => commitMode(value)}
              >
                <Icon aria-hidden />
                {label}
              </Button>
            );
          })}
        </fieldset>
        <p className="text-muted-foreground text-ui-sm">
          Variants, custom themes and a terminal theme of its own are in the top
          bar&rsquo;s Theme menu.
        </p>
      </div>
    </HomeModule>
  );
}

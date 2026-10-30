import {
  type ColorScheme,
  isUiTheme,
  resolvePalette,
  resolveTerminal,
  schemesOf,
  type TerminalTheme,
  type Theme,
  variantsOf,
} from "@orz/themes";
import {
  type LucideIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  PencilIcon,
  SquareTerminalIcon,
  SunIcon,
} from "lucide-react";
import {
  type ReactElement,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMediaQuery } from "../hooks/use-media-query.ts";
import { cn } from "../lib/utils.ts";
import {
  type ThemeMode,
  type ThemePick,
  type ThemePreview,
  useStyle,
  useTerminalTheme,
  useTheme,
  useThemeSlots,
} from "../theme/index.ts";
import {
  pickForTheme,
  pickForVariant,
  previewForVariant,
  schemesDefining,
} from "../theme/picks.ts";
import { themesShownFor } from "../theme/pref.ts";
import { Button } from "./button.tsx";
import {
  FilterMenu,
  type FilterMenuHandle,
  type FilterMenuSection,
  MatchedText,
  matchText,
} from "./filter-menu.tsx";

export interface ThemeMenuProps {
  /**
   * Replaces the trigger button. Gets the icon the default trigger would show (it follows the mode
   * for the UI slot) and the menu's accessible name ("Theme" or "Terminal theme"). The element goes
   * through Radix's `PopoverTrigger asChild`, so it must accept a ref and spread the props it is
   * given onto a DOM element.
   */
  trigger?: (info: { Icon: LucideIcon; label: string }) => ReactElement;
  /** Which pick the menu edits. Default "ui". Renders nothing when the store lacks the slot. */
  slot?: "ui" | "terminal";
  /**
   * Present: a "Custom themes…" row (id undefined) and an edit button on custom rows (their id).
   * `slot` is this menu's slot, so a new theme opened from the terminal menu is a terminal theme.
   */
  onCustomize?: (id: string | undefined, slot: "ui" | "terminal") => void;
}

interface Variant {
  id: string;
  label: string;
}

interface Row {
  id: string;
  kind: "follow" | "theme" | "variant" | "customize";
  theme?: TerminalTheme;
  variant?: Variant;
  /** A variant row outside a submenu, labelled with its theme. */
  flat?: boolean;
}

// A highlight rests this long before the page repaints, so sweeping across
// rows, or crossing to a submenu, repaints once.
const SETTLE_MS = 80;
const DARK_QUERY = "(prefers-color-scheme: dark)";
const MODES: { mode: ThemeMode; label: string; Icon: typeof SunIcon }[] = [
  { mode: "system", label: "Auto", Icon: MonitorIcon },
  { mode: "light", label: "Light", Icon: SunIcon },
  { mode: "dark", label: "Dark", Icon: MoonIcon },
];
// The Style and Mode rows: segmented buttons on a muted track.
const SEGMENTS =
  "mx-2 grid gap-0.5 rounded-[min(var(--radius-control),8px)] bg-muted p-0.5";
const SEGMENT =
  "flex items-center justify-center gap-1.5 rounded-[min(var(--radius-control),6px)] py-1 text-muted-foreground text-xs aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-raised disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-3.5";
const FOLLOW_LABEL = "Same as UI";
const CUSTOMIZE_LABEL = "Custom themes…";

/** True when `query` starts `keyword`, so `dar` finds the dark palettes. */
const keyword = (word: string, query: string) =>
  // Three letters at least, or `d` and `l` would turn into palette filters.
  query.length >= 3 && matchText(word, query)?.start === 0;

/** The palette label a query hit when the theme's own label did not. */
function paletteHit(theme: TerminalTheme, query: string): string | undefined {
  if (query === "" || matchText(theme.label, query)) return undefined;
  return schemesOf(theme)
    .map((scheme) => theme[scheme]?.label)
    .find((label) => label !== undefined && matchText(label, query));
}

function UiSwatch({ theme, variant }: { theme: Theme; variant?: string }) {
  return (
    <span
      aria-hidden
      className="flex size-4 shrink-0 -rotate-45 overflow-hidden rounded-full border"
    >
      {schemesOf(theme).map((scheme) => {
        const palette = resolvePalette(theme, scheme, variant);
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

const ANSI = ["red", "green", "yellow", "blue", "magenta", "cyan"] as const;

function TerminalSwatch({
  theme,
  variant,
}: {
  theme: TerminalTheme;
  variant?: string;
}) {
  const defining = schemesDefining(theme, variant ?? "default");
  const scheme: ColorScheme = defining.includes("dark")
    ? "dark"
    : (defining[0] ?? schemesOf(theme)[0] ?? "dark");
  const terminal = resolveTerminal(theme, scheme, variant)?.terminal;
  return (
    <span
      aria-hidden
      className="flex h-4 shrink-0 items-center gap-px rounded-[min(var(--radius-item),6px)] border px-0.5"
      style={{ backgroundColor: terminal?.["terminal-background"] }}
    >
      {ANSI.map((name) => (
        <span
          key={name}
          className="h-2.5 w-1 rounded-[min(var(--radius-item),1px)]"
          style={{ backgroundColor: terminal?.[`ansi-${name}`] }}
        />
      ))}
    </span>
  );
}

function SchemeMarks({ theme }: { theme: TerminalTheme }) {
  const schemes = schemesOf(theme);
  return (
    <span
      className="flex shrink-0 gap-0.5 text-muted-foreground"
      title={schemes.map((s) => (s === "light" ? "Light" : "Dark")).join(" + ")}
    >
      <SunIcon
        aria-hidden
        className={cn("size-3", !schemes.includes("light") && "opacity-25")}
      />
      <MoonIcon
        aria-hidden
        className={cn("size-3", !schemes.includes("dark") && "opacity-25")}
      />
    </span>
  );
}

/** "(dark only)" for a variant only some of the theme's palettes define. */
function onlyOn(theme: TerminalTheme, variant: Variant): string | null {
  const defining = schemesDefining(theme, variant.id);
  if (defining.length >= schemesOf(theme).length) return null;
  return defining.length === 1 ? `(${defining[0]} only)` : null;
}

const subId = (theme: string, variant: string) => `sub:${theme}:${variant}`;

/**
 * Theme picker for one slot of the provider's store: a filter box, Auto /
 * Light / Dark, and the themes with their variants in submenus. Whatever is
 * highlighted previews on the page; a pick commits it.
 */
export function ThemeMenu({
  slot = "ui",
  onCustomize,
  trigger,
}: ThemeMenuProps) {
  const slots = useThemeSlots();
  const ui = useTheme();
  const terminal = useTerminalTheme();
  const systemDark = useMediaQuery(DARK_QUERY);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const menu = useRef<FilterMenuHandle>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Whether this menu has a preview showing, so closing or unmounting one
  // menu never clears another's.
  const previewing = useRef(false);

  const { pref, setPref, preview } = ui;
  const style = useStyle();
  // The committed style's, so hovering another style leaves the list alone.
  const uiThemes = useMemo(
    () => themesShownFor(ui.themes, style.committed),
    [ui.themes, style.committed],
  );
  const themes: readonly TerminalTheme[] =
    slot === "ui" ? uiThemes : terminal.themes;
  // The composed custom themes lead the list. Only that run counts: a stored
  // custom theme whose id a base theme took is left out of the list, and the
  // base theme must not show as custom.
  const customIds = useMemo(() => {
    const ids = new Set(ui.customThemes.map((c) => c.id));
    const leading = new Set<string>();
    for (const theme of themes) {
      if (!ids.has(theme.id) || leading.has(theme.id)) break;
      leading.add(theme.id);
    }
    return leading;
  }, [ui.customThemes, themes]);
  const committed = slot === "ui" ? pref.ui : pref.terminal;
  const following = slot === "terminal" && committed === undefined;
  // A first terminal pick starts from the UI's mode.
  const current: ThemePick = committed ??
    pref.ui ?? { theme: "", mode: "system" };
  const committedTheme = following
    ? undefined
    : themes.find((t) => t.id === current.theme);
  const showFollow = slot === "terminal" && slots.ui;

  const cancelSettle = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  const show = (next: ThemePreview | null) => {
    if (next === null && !previewing.current) return;
    previewing.current = next !== null;
    preview(next);
  };
  const showRef = useRef(show);
  showRef.current = show;
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
      showRef.current(null);
    },
    [],
  );

  const previewOf = (row: Row | null): ThemePreview | null => {
    if (row === null || row.kind === "customize") return null;
    if (row.kind === "follow") return { terminal: "follow" };
    const theme = row.theme as TerminalTheme;
    const pick =
      row.kind === "theme"
        ? pickForTheme(current, theme)
        : previewForVariant(
            current,
            theme,
            (row.variant as Variant).id,
            systemDark ? "dark" : "light",
          );
    return { [slot]: pick };
  };

  const settle = (next: ThemePreview | null) => {
    cancelSettle();
    timer.current = setTimeout(() => {
      timer.current = null;
      show(next);
    }, SETTLE_MS);
  };

  // What leaving a style button shows again: the highlighted row's preview.
  const highlighted = useRef<Row | null>(null);
  const onHighlight = (row: Row | null) => {
    highlighted.current = row;
    cancelSettle();
    if (!open) return;
    settle(previewOf(row));
  };

  const pickStyle = (id: string) => {
    cancelSettle();
    previewing.current = false;
    style.setStyle(id);
    menu.current?.resetHighlight();
    // resetHighlight reports null, and setPref already showed the commit.
    cancelSettle();
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      cancelSettle();
      show(null);
    }
  };

  const commit = (pick: ThemePick | undefined) => {
    cancelSettle();
    previewing.current = false;
    setPref({ ...pref, [slot]: pick });
  };

  const onSelect = (row: Row) => {
    cancelSettle();
    if (row.kind === "customize") {
      show(null);
      onCustomize?.(undefined, slot);
      return;
    }
    if (row.kind === "follow") return commit(undefined);
    const theme = row.theme as TerminalTheme;
    commit(
      row.kind === "theme"
        ? pickForTheme(current, theme)
        : pickForVariant(current, theme, (row.variant as Variant).id),
    );
  };

  const setMode = (mode: ThemeMode) => {
    if (committed === undefined) return;
    commit({ ...committed, mode });
    menu.current?.resetHighlight();
    // resetHighlight reports null, and setPref already showed the commit.
    cancelSettle();
  };

  const submenus = useMemo(() => {
    const out = new Map<string, Row[]>();
    for (const theme of themes) {
      const variants = variantsOf(theme);
      if (variants.length < 2) continue;
      out.set(
        theme.id,
        variants.map((variant) => ({
          id: subId(theme.id, variant.id),
          kind: "variant",
          theme,
          variant,
        })),
      );
    }
    return out;
  }, [themes]);

  const sections = useMemo((): FilterMenuSection<Row>[] => {
    const q = query.trim();
    const all = q === "";
    const themeRows = (list: readonly TerminalTheme[], group: string) =>
      list.flatMap((theme): Row[] => {
        const row: Row = { id: `theme:${theme.id}`, kind: "theme", theme };
        if (
          all ||
          keyword(group, q) ||
          matchText(theme.label, q) ||
          paletteHit(theme, q) !== undefined ||
          schemesOf(theme).some((scheme) => keyword(scheme, q))
        ) {
          return [row];
        }
        return variantsOf(theme)
          .filter((v) => v.id !== "default" && matchText(v.label, q))
          .map((variant) => ({
            id: `variant:${theme.id}:${variant.id}`,
            kind: "variant",
            theme,
            variant,
            flat: true,
          }));
      });
    const custom = themes.filter((t) => customIds.has(t.id));
    const rest = themes.filter((t) => !customIds.has(t.id));
    const out: FilterMenuSection<Row>[] = [];
    if (showFollow && (all || keyword("follow", q) || keyword("same", q))) {
      out.push({ id: "follow", rows: [{ id: "follow", kind: "follow" }] });
    }
    out.push({
      id: "custom",
      label: "Custom",
      rows: themeRows(custom, "custom"),
    });
    if (slot === "ui") {
      out.push({ id: "themes", label: "Themes", rows: themeRows(rest, "") });
    } else {
      out.push({
        id: "themes",
        label: "Themes",
        rows: themeRows(rest.filter(isUiTheme), ""),
      });
      out.push({
        id: "terminal-only",
        label: "Terminal only",
        rows: themeRows(
          rest.filter((t) => !isUiTheme(t)),
          "terminal",
        ),
      });
    }
    if (onCustomize && (all || matchText(CUSTOMIZE_LABEL, q))) {
      out.push({
        id: "customize",
        rows: [{ id: "customize", kind: "customize" }],
      });
    }
    return out;
  }, [query, themes, customIds, showFollow, slot, onCustomize]);

  if (!slots[slot]) return null;

  const committedVariant = committed?.variant ?? "default";
  const flatSelected = `variant:${current.theme}:${committedVariant}`;
  const selectedId = following
    ? "follow"
    : sections.some((s) => s.rows.some((r) => r.id === flatSelected))
      ? flatSelected
      : `theme:${current.theme}`;

  const close = () => {
    setOpen(false);
    cancelSettle();
    show(null);
  };

  const renderRow = (row: Row, state: { highlighted: boolean }): ReactNode => {
    const Swatch = slot === "ui" ? UiSwatch : TerminalSwatch;
    if (row.kind === "customize") {
      return (
        <>
          <PaletteIcon aria-hidden className="text-muted-foreground" />
          <span className="flex-1 truncate">{CUSTOMIZE_LABEL}</span>
        </>
      );
    }
    if (row.kind === "follow") {
      return (
        <>
          <Swatch theme={ui.theme} variant={ui.variant} />
          <span className="flex-1 truncate">
            <MatchedText text={FOLLOW_LABEL} query={query.trim()} />{" "}
            <span className="text-muted-foreground">({ui.theme.label})</span>
          </span>
        </>
      );
    }
    const theme = row.theme as TerminalTheme;
    if (row.kind === "variant") {
      const variant = row.variant as Variant;
      const only = onlyOn(theme, variant);
      return (
        <>
          <Swatch theme={theme as Theme} variant={variant.id} />
          <span className="flex-1 truncate">
            {row.flat && (
              <span className="text-muted-foreground">{theme.label} › </span>
            )}
            <MatchedText text={variant.label} query={query.trim()} />
            {only && <span className="text-muted-foreground"> {only}</span>}
          </span>
        </>
      );
    }
    const palette = paletteHit(theme, query.trim());
    return (
      <>
        <Swatch theme={theme as Theme} />
        <span className="flex-1 truncate">
          <MatchedText text={theme.label} query={query.trim()} />
          {palette && (
            <span className="text-muted-foreground">
              {" · "}
              <MatchedText text={palette} query={query.trim()} />
            </span>
          )}
        </span>
        {onCustomize && customIds.has(theme.id) && (
          <button
            type="button"
            aria-label={`Edit ${theme.label}`}
            title="Edit"
            className={cn(
              "flex size-5 items-center justify-center rounded-[min(var(--radius-control),6px)] text-muted-foreground hover:text-foreground",
              !state.highlighted && "invisible",
            )}
            // Keeps focus, and so the keys, in the filter box.
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.stopPropagation();
              close();
              onCustomize(theme.id, slot);
            }}
          >
            <PencilIcon className="size-3.5" />
          </button>
        )}
        <SchemeMarks theme={theme} />
      </>
    );
  };

  const styleRow = slot === "ui" && style.styles.length > 1 && (
    <fieldset
      aria-label="Style"
      className={cn(SEGMENTS, "mt-2 auto-cols-fr grid-flow-col")}
    >
      {style.styles.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-pressed={style.committed === id}
          className={SEGMENT}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => pickStyle(id)}
          onPointerEnter={() => settle({ style: id })}
          onPointerLeave={() => settle(previewOf(highlighted.current))}
          onFocus={() => settle({ style: id })}
          onBlur={() => settle(previewOf(highlighted.current))}
        >
          {label}
        </button>
      ))}
    </fieldset>
  );

  const modes = (
    <fieldset
      aria-label="Mode"
      className={cn(SEGMENTS, "mt-2 mb-1 grid-cols-3")}
    >
      {MODES.map(({ mode, label, Icon }) => {
        const schemes = committedTheme ? schemesOf(committedTheme) : [];
        const usable =
          !following &&
          (mode === "system" ? schemes.length === 2 : schemes.includes(mode));
        const missing = schemes.includes("light") ? "dark" : "light";
        const title = following
          ? "Follows the UI theme"
          : usable
            ? undefined
            : `${committedTheme?.label ?? "This theme"} has no ${missing} palette`;
        const pressed = !following && committed?.mode === mode;
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={pressed}
            disabled={!usable}
            title={title}
            className={SEGMENT}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setMode(mode)}
          >
            <Icon aria-hidden />
            {label}
          </button>
        );
      })}
    </fieldset>
  );
  const header = (
    <>
      {styleRow}
      {modes}
    </>
  );

  const Icon: LucideIcon =
    slot === "terminal"
      ? SquareTerminalIcon
      : current.mode === "system"
        ? MonitorIcon
        : current.mode === "dark"
          ? MoonIcon
          : SunIcon;
  const label = slot === "ui" ? "Theme" : "Terminal theme";

  return (
    <FilterMenu<Row>
      ref={menu}
      open={open}
      onOpenChange={onOpenChange}
      query={query}
      onQueryChange={setQuery}
      sections={sections}
      renderRow={renderRow}
      selectedId={selectedId}
      onHighlight={onHighlight}
      onSelect={onSelect}
      getSubmenu={(row) =>
        row.kind === "theme" && row.theme
          ? submenus.get(row.theme.id)
          : undefined
      }
      selectedSubmenuId={
        following ? undefined : subId(current.theme, committedVariant)
      }
      submenuLabel={(row) => `${row.theme?.label ?? ""} variants`}
      header={header}
      placeholder={slot === "ui" ? "Filter themes…" : "Filter terminal themes…"}
      inputLabel={slot === "ui" ? "Filter themes" : "Filter terminal themes"}
      listLabel={slot === "ui" ? "Themes" : "Terminal themes"}
      empty={(q) => `No themes match "${q}"`}
      align="end"
      className="w-80"
    >
      {trigger ? (
        trigger({ Icon, label })
      ) : (
        <Button variant="ghost" size="sm" aria-label={label} title={label}>
          <Icon className="size-4" />
        </Button>
      )}
    </FilterMenu>
  );
}

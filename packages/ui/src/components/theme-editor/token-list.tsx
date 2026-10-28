import type {
  AnyCustomTheme,
  ColorScheme,
  CustomTheme,
  TerminalTokenName,
  TerminalTokens,
  TokenName,
  Tokens,
} from "@orz/themes";
import { ChevronRightIcon, RotateCcwIcon } from "lucide-react";
import { type Dispatch, useId, useState } from "react";
import { contrastRatio, parseColor } from "../../lib/color.ts";
import { cn } from "../../lib/utils.ts";
import { ColorPickerPopover } from "../color-picker.tsx";
import { MatchedText, matchText } from "../filter-menu.tsx";
import { Input } from "../input.tsx";
import { Label } from "../label.tsx";
import { Switch } from "../switch.tsx";
import {
  type DraftAction,
  isOverridden,
  isTerminalOverridden,
  sideMode,
  type TerminalTarget,
  terminalMode,
} from "./draft.ts";
import {
  rowTokens,
  TERMINAL_CONTRAST_WITH,
  TERMINAL_TOKEN_GROUPS,
  type TokenEntry,
  type TokenGroup,
  type TokenRow,
  UI_CONTRAST_WITH,
  UI_TOKEN_GROUPS,
} from "./tokens.ts";

interface TokenListCommon {
  draft: AnyCustomTheme;
  dispatch: Dispatch<DraftAction>;
  /**
   * The groups the user opened or closed, by group id. Pass it with
   * `onOpenGroupsChange` to keep them per tab while the list unmounts;
   * absent, the list keeps its own.
   */
  openGroups?: Readonly<Record<string, boolean>>;
  onOpenGroupsChange?: (openGroups: Record<string, boolean>) => void;
}

export type TokenListProps = TokenListCommon &
  (
    | {
        kind: "ui";
        scheme: ColorScheme;
        /** The colours the side shows now. */
        values: Tokens;
        /** A drag in a picker; `null` when its popover closes. */
        onPreview?: (name: TokenName, value: string | null) => void;
      }
    | {
        kind: "terminal";
        target: TerminalTarget;
        values: TerminalTokens;
        onPreview?: (name: TerminalTokenName, value: string | null) => void;
      }
  );

export function TokenList(props: TokenListProps) {
  const { draft, dispatch, openGroups, onOpenGroupsChange } = props;
  if (props.kind === "ui") {
    const { scheme } = props;
    return (
      <TokenListView
        groups={UI_TOKEN_GROUPS}
        values={props.values}
        contrastWith={UI_CONTRAST_WITH}
        format="oklch"
        showState={sideMode(draft, scheme) === "based"}
        // The UI list only ever shows a UI theme.
        overridden={(name) => isOverridden(draft as CustomTheme, scheme, name)}
        onPreview={props.onPreview}
        onCommit={(name, value) =>
          dispatch({ type: "setToken", scheme, name, value })
        }
        onReset={(name) => dispatch({ type: "resetToken", scheme, name })}
        openGroups={openGroups}
        onOpenGroupsChange={onOpenGroupsChange}
      />
    );
  }
  const { target } = props;
  // A shared terminal is equal on both sides, so either one answers.
  const scheme: ColorScheme =
    target === "both" ? (draft.light ? "light" : "dark") : target;
  const mode = terminalMode(draft, scheme);
  return (
    <TokenListView
      groups={TERMINAL_TOKEN_GROUPS}
      values={props.values}
      contrastWith={TERMINAL_CONTRAST_WITH}
      format="hex"
      showState={mode === "based" || mode === "follow"}
      overridden={(name) => isTerminalOverridden(draft, scheme, name)}
      onPreview={props.onPreview}
      onCommit={(name, value) =>
        dispatch({ type: "setTerminalToken", target, name, value })
      }
      onReset={(name) => dispatch({ type: "resetTerminalToken", target, name })}
      openGroups={openGroups}
      onOpenGroupsChange={onOpenGroupsChange}
    />
  );
}

interface ViewProps<N extends string> {
  groups: readonly TokenGroup<N>[];
  values: Readonly<Record<N, string>>;
  contrastWith: Readonly<Partial<Record<N, N>>>;
  format: "oklch" | "hex";
  /** A based side (or terminal): rows say inherited or overridden. */
  showState: boolean;
  overridden: (name: N) => boolean;
  onPreview?: (name: N, value: string | null) => void;
  onCommit: (name: N, value: string) => void;
  onReset: (name: N) => void;
  openGroups?: Readonly<Record<string, boolean>>;
  onOpenGroupsChange?: (openGroups: Record<string, boolean>) => void;
}

// The default trigger's checkerboard, so a translucent colour reads as one.
const CHECKERBOARD = {
  backgroundImage: "conic-gradient(#ccc 25%, #fff 0 50%, #ccc 0 75%, #fff 0)",
  backgroundSize: "8px 8px",
} as const;

function TokenListView<N extends string>({
  groups,
  values,
  contrastWith,
  format,
  showState,
  overridden,
  onPreview,
  onCommit,
  onReset,
  openGroups: controlledOpen,
  onOpenGroupsChange,
}: ViewProps<N>) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [onlyOverridden, setOnlyOverridden] = useState(false);
  const [ownOpen, setOwnOpen] = useState<Record<string, boolean>>({});
  const opened = controlledOpen ?? ownOpen;
  const q = query.trim();
  const only = showState && onlyOverridden;
  const filtering = q !== "" || only;
  // Toggles made while filtering last until the filter changes, so clearing
  // it brings back the groups the user had open.
  const filterKey = `${q}\0${only}`;
  const [filterOpen, setFilterOpen] = useState<{
    key: string;
    open: Record<string, boolean>;
  }>({ key: filterKey, open: {} });
  const transient = filterOpen.key === filterKey ? filterOpen.open : {};

  const passes = (entry: TokenEntry<N>) =>
    (q === "" ||
      matchText(entry.label, q) !== null ||
      matchText(entry.name, q) !== null) &&
    (!only || overridden(entry.name));

  const shown = groups
    .map((group, index) => {
      const names = group.rows.flatMap((row) =>
        rowTokens(row).map((t) => t.name),
      );
      const count = showState ? names.filter(overridden).length : 0;
      const rows = group.rows.filter((row) => rowTokens(row).some(passes));
      const open = filtering
        ? (transient[group.id] ?? true)
        : (opened[group.id] ?? (index === 0 || count > 0));
      return { group, count, rows, open };
    })
    .filter(({ rows }) => rows.length > 0);

  const toggle = (groupId: string, open: boolean) => {
    if (filtering) {
      setFilterOpen({
        key: filterKey,
        open: { ...transient, [groupId]: open },
      });
      return;
    }
    const next = { ...opened, [groupId]: open };
    if (onOpenGroupsChange) onOpenGroupsChange(next);
    if (controlledOpen === undefined) setOwnOpen(next);
  };

  const swatchFor = (entry: TokenEntry<N>, className?: string) => {
    const others = new Set<string>();
    for (const [name, value] of Object.entries(values) as [N, string][]) {
      if (name !== entry.name) others.add(value);
    }
    const against = contrastWith[entry.name];
    return (
      <ColorPickerPopover
        value={values[entry.name]}
        format={format}
        alpha
        swatches={[{ label: "This theme", colors: [...others] }]}
        contrastWith={against === undefined ? undefined : values[against]}
        contrastLabel={against}
        onValueChange={(value) => onPreview?.(entry.name, value)}
        onValueCommit={(value) => onCommit(entry.name, value)}
        onOpenChange={(open) => {
          if (!open) onPreview?.(entry.name, null);
        }}
        align="end"
        aria-label={`${entry.label} (${entry.name})`}
      >
        <button
          type="button"
          title={values[entry.name]}
          className={cn(
            "size-7 shrink-0 overflow-hidden rounded-md border border-black/15 shadow-xs outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid dark:border-white/15",
            className,
          )}
          style={CHECKERBOARD}
        >
          <span
            className="block size-full"
            style={{ background: values[entry.name] }}
          />
        </button>
      </ColorPickerPopover>
    );
  };

  const resetButton = (entry: TokenEntry<N>) => (
    <button
      type="button"
      aria-label={`Reset ${entry.name}`}
      title="Remove the override"
      onClick={() => onReset(entry.name)}
      className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <RotateCcwIcon className="size-3" />
    </button>
  );

  const state = (entry: TokenEntry<N>) => {
    if (!showState) return null;
    return overridden(entry.name) ? (
      <span className="flex shrink-0 items-center gap-0.5 text-xs">
        overridden
        {resetButton(entry)}
      </span>
    ) : (
      <span className="shrink-0 text-xs text-muted-foreground">inherited</span>
    );
  };

  const entryRow = (entry: TokenEntry<N>) => (
    <div key={entry.name} className="flex min-h-8 items-center gap-2">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">
          <MatchedText text={entry.label} query={q} />
        </div>
        <div className="truncate font-mono text-[11px] text-muted-foreground">
          <MatchedText text={entry.name} query={q} />
        </div>
      </div>
      {state(entry)}
      {swatchFor(entry)}
    </div>
  );

  const renderRow = (row: TokenRow<N>, key: number) => {
    if (row.kind === "single") {
      return <li key={key}>{entryRow(row.token)}</li>;
    }
    if (row.kind === "pair") {
      return (
        <li key={key} className="flex gap-3">
          <PairSample
            surface={values[row.surface.name]}
            text={values[row.text.name]}
            label={`${row.text.label} on ${row.surface.label}`}
          />
          <div className="min-w-0 flex-1 space-y-1">
            {entryRow(row.surface)}
            {entryRow(row.text)}
          </div>
        </li>
      );
    }
    return (
      <li
        key={key}
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${row.tokens.length}, minmax(0, 1fr))`,
        }}
      >
        {row.tokens.map((entry) =>
          passes(entry) ? (
            <div
              key={entry.name}
              className="flex min-w-0 flex-col items-center gap-0.5"
            >
              {swatchFor(entry, "h-7 w-full")}
              <span
                title={entry.name}
                className={cn(
                  "max-w-full truncate text-[10px]",
                  showState && !overridden(entry.name)
                    ? "text-muted-foreground"
                    : undefined,
                )}
              >
                <MatchedText text={entry.label} query={q} />
              </span>
              {showState && overridden(entry.name) && resetButton(entry)}
            </div>
          ) : (
            <div key={entry.name} aria-hidden />
          ),
        )}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query !== "") setQuery("");
          }}
          data-keeps-escape={query !== "" ? "" : undefined}
          placeholder="Find a colour…"
          aria-label="Find a colour"
          className="h-7 flex-1"
        />
        {showState && (
          <div className="flex shrink-0 items-center gap-1.5">
            <Switch
              id={`${id}-only`}
              checked={onlyOverridden}
              onCheckedChange={setOnlyOverridden}
            />
            <Label htmlFor={`${id}-only`} className="text-xs font-normal">
              Only overridden
            </Label>
          </div>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {only && q === ""
            ? "No colours are overridden."
            : "No colours match."}
        </p>
      ) : (
        shown.map(({ group, count, rows, open }) => (
          <section key={group.id} className="border-t pt-1">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={`${id}-${group.id}`}
              onClick={() => toggle(group.id, !open)}
              className="flex w-full items-center gap-1.5 rounded py-1 text-left text-sm font-medium hover:bg-accent/50"
            >
              <ChevronRightIcon
                aria-hidden
                className={cn(
                  "size-3.5 text-muted-foreground transition-transform",
                  open && "rotate-90",
                )}
              />
              {group.label}
              {count > 0 && (
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {count} overridden
                </span>
              )}
            </button>
            {open && (
              <ul id={`${id}-${group.id}`} className="space-y-2 pt-1 pb-2">
                {rows.map((r) => renderRow(r, group.rows.indexOf(r)))}
              </ul>
            )}
          </section>
        ))
      )}
    </div>
  );
}

/** "Aa" in the pair's colours, with their WCAG 2 ratio; amber below 4.5:1. */
function PairSample({
  surface,
  text,
  label,
}: {
  surface: string;
  text: string;
  label: string;
}) {
  const bg = parseColor(surface);
  const fg = parseColor(text);
  const ratio = bg && fg ? contrastRatio(fg.color, bg.color) : null;
  const low = ratio !== null && ratio < 4.5;
  return (
    <div className="flex w-14 shrink-0 flex-col items-center gap-1 pt-0.5">
      <div
        aria-hidden
        className="flex h-9 w-full items-center justify-center rounded-md border text-base font-semibold"
        style={{ background: surface, color: text }}
      >
        Aa
      </div>
      {ratio !== null && (
        <span
          data-contrast
          data-low={low || undefined}
          title={`WCAG 2 contrast of ${label}`}
          className={cn(
            "font-mono text-[11px] tabular-nums",
            low ? "text-warning" : "text-muted-foreground",
          )}
        >
          {/* Truncated as the picker does, so 4.4997 never reads 4.50. */}
          {`${(Math.floor(ratio * 100 + 1e-6) / 100).toFixed(2)}:1`}
        </span>
      )}
    </div>
  );
}

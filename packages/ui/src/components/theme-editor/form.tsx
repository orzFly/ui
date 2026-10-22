import {
  type ColorScheme,
  type CustomTheme,
  composeTheme,
  DEFAULT_VARIANT,
  isUiTheme,
  schemesOf,
  type TerminalTheme,
  type TerminalTokenName,
  type Theme,
  type TokenName,
} from "@orz/themes";
import { type Dispatch, type ReactNode, useId, useRef, useState } from "react";
import { cn } from "../../lib/utils.ts";
import { Button } from "../button.tsx";
import { Input } from "../input.tsx";
import { Label } from "../label.tsx";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../select.tsx";
import { Switch } from "../switch.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs.tsx";
import {
  type BasedSide,
  type BasedTerminal,
  canFollowBase,
  type DraftAction,
  fallbackBase,
  overrideCount,
  type SidePalette,
  sideMode,
  type TerminalBaseRef,
  type TerminalTarget,
  terminalMode,
  terminalOverrideCount,
} from "./draft.ts";
import { TokenList } from "./token-list.tsx";

export type EditorTab = ColorScheme | "terminal";

/** The Terminal tab's own state: "Same terminal for both sides" turned off, and which side it edits then. */
export interface TerminalView {
  split: boolean;
  side: ColorScheme;
}

/** A colour being dragged in a picker, not yet committed. */
export type PendingColour =
  | { kind: "ui"; scheme: ColorScheme; name: TokenName; value: string }
  | { kind: "terminal"; name: TerminalTokenName; value: string };

export interface ThemeFormProps {
  draft: CustomTheme;
  dispatch: Dispatch<DraftAction>;
  /** The draft composed against the base lists; null when no side resolves. */
  composed: Theme | null;
  /** The colours a side last showed, for detaching a side whose base is gone. */
  lastShown: (scheme: ColorScheme) => SidePalette | undefined;
  /** Base UI themes, custom ones excluded. */
  baseThemes: readonly Theme[];
  /** What a terminal can be based on: the terminal list, custom ones excluded. */
  palettes: readonly TerminalTheme[];
  /** Everything the draft composes against. */
  composeList: readonly TerminalTheme[];
  /** The committed UI pick's theme, the first choice of base for a side turned based. */
  committedTheme: string | undefined;
  nameError: string | null;
  tab: EditorTab;
  onTabChange: (tab: EditorTab) => void;
  terminalView: TerminalView;
  onTerminalViewChange: (view: TerminalView) => void;
  /** Both sides exist, carry the same terminal, and the user has not split them. */
  shared: boolean;
  onPreview: (pending: PendingColour | null) => void;
}

const SCHEMES: readonly ColorScheme[] = ["light", "dark"];
const SCHEME_LABEL: Record<ColorScheme, string> = {
  light: "Light",
  dark: "Dark",
};
const AUTO_SCHEME = "auto";
const MUTED_NOTE = "text-xs text-muted-foreground";

const isBased = (side: CustomTheme[ColorScheme]): side is BasedSide =>
  side !== undefined && "base" in side;

/** `default` first, then the variants the palette for `scheme` defines. */
function paletteVariants(theme: TerminalTheme, scheme: ColorScheme) {
  const variants = theme[scheme]?.variants ?? {};
  return [
    { id: DEFAULT_VARIANT, label: "Default" },
    ...Object.entries(variants)
      .filter(([id]) => id !== DEFAULT_VARIANT)
      .map(([id, { label }]) => ({ id, label })),
  ];
}

const definesVariant = (
  theme: TerminalTheme,
  scheme: ColorScheme,
  variant: string | undefined,
) =>
  variant !== undefined &&
  Object.hasOwn(theme[scheme]?.variants ?? {}, variant);

/** The scheme a terminal base shows on `side` when it names none, as composition picks it. */
function ownScheme(palette: TerminalTheme, side: ColorScheme): ColorScheme {
  if (palette.light && palette.dark) return side;
  return palette.light ? "light" : "dark";
}

function terminalBase(
  theme: string,
  scheme: ColorScheme | undefined,
  variant: string | undefined,
): TerminalBaseRef {
  const base: TerminalBaseRef = { theme };
  if (scheme !== undefined) base.scheme = scheme;
  if (variant !== undefined && variant !== DEFAULT_VARIANT) {
    base.variant = variant;
  }
  return base;
}

const withCount = (label: string, count: number) =>
  count > 0 ? `${label} + ${count}` : label;

function sideSubtitle(
  draft: CustomTheme,
  scheme: ColorScheme,
  baseThemes: readonly Theme[],
): string {
  const side = draft[scheme];
  if (side === undefined) return "None";
  if (!isBased(side)) return "Fully custom";
  const label =
    baseThemes.find((t) => t.id === side.base.theme)?.label ?? side.base.theme;
  return withCount(label, overrideCount(draft, scheme));
}

function terminalSubtitle(
  draft: CustomTheme,
  composeList: readonly TerminalTheme[],
): string {
  const each = SCHEMES.filter((s) => draft[s] !== undefined).map((scheme) => {
    const terminal = draft[scheme]?.terminal;
    if (terminal === undefined) return "follows base";
    if (!("base" in terminal)) return "Fully custom";
    const label =
      composeList.find((t) => t.id === terminal.base.theme)?.label ??
      terminal.base.theme;
    return withCount(label, terminalOverrideCount(draft, scheme));
  });
  if (each.length === 0) return "None";
  return each.every((s) => s === each[0]) ? (each[0] as string) : "per side";
}

interface ModeOption<M extends string> {
  value: M;
  label: string;
  disabled?: boolean;
}

/** A segmented radio group. */
function ModeControl<M extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: M | null;
  options: ModeOption<M>[];
  onChange: (value: M) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex rounded-lg bg-muted p-0.5"
    >
      {options.map((option) => (
        // biome-ignore lint/a11y/useSemanticElements: a segmented control, not a list of native radios
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          disabled={option.disabled}
          onClick={() => {
            if (option.value !== value) onChange(option.value);
          }}
          className={cn(
            "flex-1 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
            option.value === value && "bg-background text-foreground shadow-xs",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      {children(id)}
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs"
    >
      {children}
    </div>
  );
}

/** Name, the Light · Dark · Terminal tabs, and each tab's controls over the token list. */
export function ThemeForm(props: ThemeFormProps) {
  const {
    draft,
    dispatch,
    baseThemes,
    composeList,
    nameError,
    tab,
    onTabChange,
  } = props;
  const nameId = useId();
  // Kept per tab, so a group the user opened stays open across tab switches.
  const [openGroups, setOpenGroups] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const groupProps = (key: string) => ({
    openGroups: openGroups[key] ?? {},
    onOpenGroupsChange: (next: Record<string, boolean>) =>
      setOpenGroups((all) => ({ ...all, [key]: next })),
  });

  const tabs: { value: EditorTab; label: string; subtitle: string }[] = [
    ...SCHEMES.map((scheme) => ({
      value: scheme,
      label: SCHEME_LABEL[scheme],
      subtitle: sideSubtitle(draft, scheme, baseThemes),
    })),
    {
      value: "terminal",
      label: "Terminal",
      subtitle: terminalSubtitle(draft, composeList),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={nameId}>Name</Label>
        <Input
          id={nameId}
          value={draft.label}
          onChange={(event) =>
            dispatch({ type: "setLabel", label: event.target.value })
          }
          aria-invalid={nameError !== null || undefined}
          aria-describedby={nameError ? `${nameId}-error` : undefined}
          autoComplete="off"
        />
        {nameError && (
          <p
            id={`${nameId}-error`}
            className="text-xs text-[color-mix(in_oklab,var(--destructive),var(--foreground)_65%)]"
          >
            {nameError}
          </p>
        )}
      </div>
      <Tabs value={tab} onValueChange={(v) => onTabChange(v as EditorTab)}>
        <TabsList className="w-full">
          {tabs.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="h-auto min-w-0 flex-1 flex-col gap-0"
            >
              {t.label}
              <span className="max-w-full truncate text-[11px] font-normal text-muted-foreground">
                {t.subtitle}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        {SCHEMES.map((scheme) => (
          <TabsContent
            key={scheme}
            value={scheme}
            className="flex flex-col gap-3 pt-2"
          >
            <SideTab {...props} scheme={scheme} groups={groupProps(scheme)} />
          </TabsContent>
        ))}
        <TabsContent value="terminal" className="flex flex-col gap-3 pt-2">
          <TerminalTab {...props} groupProps={groupProps} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type GroupProps = {
  openGroups: Record<string, boolean>;
  onOpenGroupsChange: (next: Record<string, boolean>) => void;
};

function SideTab({
  draft,
  dispatch,
  composed,
  lastShown,
  baseThemes,
  composeList,
  committedTheme,
  onPreview,
  scheme,
  groups,
}: ThemeFormProps & { scheme: ColorScheme; groups: GroupProps }) {
  const mode = sideMode(draft, scheme);
  const side = draft[scheme];
  const shown = composed?.[scheme];
  const baseSelect = useRef<HTMLButtonElement>(null);

  const setMode = (next: "none" | "based" | "detached") => {
    if (next === "none") {
      dispatch({ type: "setSideMode", scheme, mode: "none" });
      return;
    }
    const base = fallbackBase(scheme, committedTheme, baseThemes);
    let resolved: SidePalette | undefined = shown ?? lastShown(scheme);
    if (resolved === undefined && base !== undefined) {
      // From None: the colours the side would show based on the fallback.
      resolved = composeTheme(
        { id: draft.id, label: "-", [scheme]: { base } },
        composeList,
      )?.[scheme];
    }
    dispatch({ type: "setSideMode", scheme, mode: next, base, resolved });
  };

  const bases = baseThemes.filter((t) => t[scheme] !== undefined);
  const based = isBased(side) ? side : undefined;
  const base = based && bases.find((t) => t.id === based.base.theme);
  const overrides = overrideCount(draft, scheme);
  const kept = lastShown(scheme);

  return (
    <>
      <ModeControl
        label={`${SCHEME_LABEL[scheme]} side`}
        value={mode}
        onChange={setMode}
        options={[
          { value: "none", label: "None" },
          { value: "based", label: "Based on a theme" },
          { value: "detached", label: "Fully custom" },
        ]}
      />
      {mode === "none" && (
        <p className={MUTED_NOTE}>
          This theme has no {scheme} palette. Choose a mode above to add one.
        </p>
      )}
      {based && (
        <>
          <div className="flex gap-2">
            <Field label="Base theme">
              {(id) => (
                <Select
                  value={base ? base.id : ""}
                  onValueChange={(theme) => {
                    const next = bases.find((t) => t.id === theme);
                    if (next === undefined) return;
                    const variant = based.base.variant;
                    dispatch({
                      type: "setBase",
                      scheme,
                      base: definesVariant(next, scheme, variant)
                        ? { theme, variant }
                        : { theme },
                    });
                  }}
                >
                  <SelectTrigger
                    id={id}
                    ref={baseSelect}
                    size="sm"
                    className="w-full"
                  >
                    <SelectValue placeholder="Choose a theme" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {bases.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label="Variant">
              {(id) => (
                <Select
                  value={based.base.variant ?? DEFAULT_VARIANT}
                  disabled={!base}
                  onValueChange={(variant) =>
                    dispatch({
                      type: "setVariant",
                      scheme,
                      variant:
                        variant === DEFAULT_VARIANT ? undefined : variant,
                    })
                  }
                >
                  <SelectTrigger id={id} size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {(base
                      ? paletteVariants(base, scheme)
                      : [{ id: DEFAULT_VARIANT, label: "Default" }]
                    ).map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>
          {base ? (
            <div className="flex items-start gap-2">
              <p className={cn(MUTED_NOTE, "flex-1")}>
                Colours you change override <em>{base.label}</em>; the rest keep
                following it.
              </p>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={overrides === 0}
                onClick={() => dispatch({ type: "resetAll", scheme })}
              >
                Reset all ({overrides})
              </Button>
            </div>
          ) : (
            <Notice>
              <p>
                Base <em>{based.base.theme}</em> is no longer available.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => baseSelect.current?.focus()}
                >
                  Choose another
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={kept === undefined}
                  onClick={() =>
                    dispatch({
                      type: "setSideMode",
                      scheme,
                      mode: "detached",
                      resolved: kept,
                    })
                  }
                >
                  Keep as fully custom
                </Button>
              </div>
            </Notice>
          )}
        </>
      )}
      {shown && (
        <TokenList
          kind="ui"
          draft={draft}
          dispatch={dispatch}
          scheme={scheme}
          values={shown.tokens}
          onPreview={(name, value) =>
            onPreview(
              value === null ? null : { kind: "ui", scheme, name, value },
            )
          }
          {...groups}
        />
      )}
    </>
  );
}

function TerminalTab({
  draft,
  dispatch,
  composed,
  palettes,
  composeList,
  terminalView,
  onTerminalViewChange,
  shared,
  onPreview,
  groupProps,
}: ThemeFormProps & { groupProps: (key: string) => GroupProps }) {
  const sides = SCHEMES.filter((s) => draft[s] !== undefined);
  const switchId = useId();
  const [first] = sides;
  if (first === undefined) {
    return (
      <p className={MUTED_NOTE}>
        Add a light or a dark side first; each side carries its terminal
        colours.
      </p>
    );
  }
  const both = sides.length === 2;
  const target: TerminalTarget = shared
    ? "both"
    : both
      ? terminalView.side
      : first;
  // A shared terminal is equal on both sides, so the first one answers.
  const source: ColorScheme = target === "both" ? first : target;
  const targets = target === "both" ? sides : [target];
  const mode = terminalMode(draft, source);
  const followable = targets.every((s) => canFollowBase(draft, s));
  const values = composed?.[source]?.terminal;

  const fallback = (): TerminalBaseRef | undefined => {
    const side = draft[source];
    if (isBased(side) && composeList.some((t) => t.id === side.base.theme)) {
      return terminalBase(side.base.theme, undefined, side.base.variant);
    }
    const palette = palettes.find((t) => t[source]) ?? palettes[0];
    return palette && { theme: palette.id };
  };

  return (
    <>
      {both && (
        <div className="flex items-center gap-2">
          <Switch
            id={switchId}
            checked={shared}
            onCheckedChange={(on) => {
              onTerminalViewChange({ ...terminalView, split: !on });
              if (on) {
                dispatch({
                  type: "shareTerminal",
                  from: terminalView.side,
                  resolved: composed?.[terminalView.side]?.terminal,
                });
              }
            }}
          />
          <Label htmlFor={switchId} className="font-normal">
            Same terminal for both sides
          </Label>
        </div>
      )}
      {both && !shared && (
        <ModeControl
          label="Terminal of"
          value={terminalView.side}
          onChange={(side) => onTerminalViewChange({ ...terminalView, side })}
          options={SCHEMES.map((s) => ({
            value: s,
            label: `${SCHEME_LABEL[s]} side`,
          }))}
        />
      )}
      <ModeControl
        label="Terminal colours"
        value={mode}
        onChange={(next) =>
          dispatch({
            type: "setTerminalMode",
            target,
            mode: next,
            resolved: values,
            base: next === "based" ? fallback() : undefined,
          })
        }
        options={[
          { value: "follow", label: "Follow the base", disabled: !followable },
          { value: "based", label: "Based on a palette" },
          { value: "detached", label: "Fully custom" },
        ]}
      />
      {mode === "follow" && (
        <p className={MUTED_NOTE}>
          Shows the base theme's own terminal colours. A colour you change pins
          it on top of them.
        </p>
      )}
      {mode === "based" && (
        <TerminalBaseControls
          draft={draft}
          dispatch={dispatch}
          palettes={palettes}
          composeList={composeList}
          target={target}
          source={source}
        />
      )}
      {values && (
        <TokenList
          key={target}
          kind="terminal"
          draft={draft}
          dispatch={dispatch}
          target={target}
          values={values}
          onPreview={(name, value) =>
            onPreview(value === null ? null : { kind: "terminal", name, value })
          }
          {...groupProps(`terminal-${target}`)}
        />
      )}
    </>
  );
}

function TerminalBaseControls({
  draft,
  dispatch,
  palettes,
  composeList,
  target,
  source,
}: {
  draft: CustomTheme;
  dispatch: Dispatch<DraftAction>;
  palettes: readonly TerminalTheme[];
  composeList: readonly TerminalTheme[];
  target: TerminalTarget;
  source: ColorScheme;
}) {
  const terminal = draft[source]?.terminal as BasedTerminal;
  const { base } = terminal;
  const palette = composeList.find((t) => t.id === base.theme);
  const options =
    palette && !palettes.includes(palette) ? [...palettes, palette] : palettes;
  const groups = [
    { label: "Themes", themes: options.filter((t) => isUiTheme(t)) },
    {
      label: "Terminal-only themes",
      themes: options.filter((t) => !isUiTheme(t)),
    },
  ].filter((g) => g.themes.length > 0);
  const schemes = palette ? schemesOf(palette) : [];
  // The scheme whose variants are listed: the named one, else what the
  // edited side shows.
  const shownScheme = palette
    ? (base.scheme ?? ownScheme(palette, source))
    : source;
  const overrides = terminalOverrideCount(draft, source);

  const choosePalette = (id: string) => {
    const next = composeList.find((t) => t.id === id);
    if (next === undefined) return;
    const scheme =
      base.scheme !== undefined && next[base.scheme] ? base.scheme : undefined;
    const variantScheme = scheme ?? ownScheme(next, source);
    const variant = definesVariant(next, variantScheme, base.variant)
      ? base.variant
      : undefined;
    dispatch({
      type: "setTerminalBase",
      target,
      base: terminalBase(id, scheme, variant),
    });
  };

  const chooseScheme = (value: string) => {
    const scheme =
      value === AUTO_SCHEME || (target !== "both" && value === source)
        ? undefined
        : (value as ColorScheme);
    dispatch({
      type: "setTerminalBase",
      target,
      base: terminalBase(base.theme, scheme, base.variant),
    });
  };

  return (
    <>
      <div className="flex gap-2">
        <Field label="Palette">
          {(id) => (
            <Select
              value={palette ? palette.id : ""}
              onValueChange={choosePalette}
            >
              <SelectTrigger id={id} size="sm" className="w-full">
                <SelectValue placeholder="Choose a palette" />
              </SelectTrigger>
              <SelectContent position="popper">
                {groups.map((g) => (
                  <SelectGroup key={g.label}>
                    <SelectLabel>{g.label}</SelectLabel>
                    {g.themes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        {schemes.length > 1 && (
          <Field label="Scheme">
            {(id) => (
              <Select
                value={
                  base.scheme ?? (target === "both" ? AUTO_SCHEME : source)
                }
                onValueChange={chooseScheme}
              >
                <SelectTrigger id={id} size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {target === "both" && (
                    <SelectItem value={AUTO_SCHEME}>Each side's own</SelectItem>
                  )}
                  {schemes.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SCHEME_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        )}
        <Field label="Variant">
          {(id) => (
            <Select
              value={base.variant ?? DEFAULT_VARIANT}
              disabled={!palette}
              onValueChange={(variant) =>
                dispatch({
                  type: "setTerminalVariant",
                  target,
                  variant: variant === DEFAULT_VARIANT ? undefined : variant,
                })
              }
            >
              <SelectTrigger id={id} size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {(palette
                  ? paletteVariants(palette, shownScheme)
                  : [{ id: DEFAULT_VARIANT, label: "Default" }]
                ).map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
      {palette ? (
        <div className="flex items-start gap-2">
          <p className={cn(MUTED_NOTE, "flex-1")}>
            Colours you change override <em>{palette.label}</em>; the rest keep
            following it.
          </p>
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={overrides === 0}
            onClick={() => dispatch({ type: "resetAllTerminal", target })}
          >
            Reset all ({overrides})
          </Button>
        </div>
      ) : (
        <Notice>
          <p>
            Palette <em>{base.theme}</em> is no longer available. Choose
            another.
          </p>
        </Notice>
      )}
    </>
  );
}

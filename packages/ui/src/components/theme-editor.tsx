import {
  type AnyCustomTheme,
  type ColorScheme,
  type CustomTheme,
  DEFAULT_VARIANT,
  isCustomTerminalTheme,
  type TerminalTheme,
  type TerminalTokens,
  type Theme,
} from "@orz/themes";
import { XIcon } from "lucide-react";
import {
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type ImportEntry, serializeThemeFile } from "../lib/theme-file.ts";
import { useDirtySource } from "../lib/unsaved-guard.ts";
import {
  type ThemeMode,
  useStyle,
  useTerminalTheme,
  useTheme,
  useThemeSlots,
} from "../theme/index.ts";
import { Button } from "./button.tsx";
import { ConfirmDialog } from "./confirm-dialog.tsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "./sheet.tsx";
import {
  duplicate,
  newTheme,
  newThemeId,
  type SidePalette,
  sameTerminal,
  useThemeDraft,
} from "./theme-editor/draft.ts";
import {
  ALL_THEMES_FILE_NAME,
  ExportPanel,
  themeFileName,
} from "./theme-editor/export-panel.tsx";
import {
  type EditorTab,
  type PendingColour,
  TerminalThemeForm,
  type TerminalView,
  ThemeForm,
} from "./theme-editor/form.tsx";
import { ImportPanel } from "./theme-editor/import-panel.tsx";
import { displayLabel, ThemeList } from "./theme-editor/theme-list.tsx";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog.tsx";

export type CustomThemeKind = "ui" | "terminal";

export interface ThemeEditorProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /**
   * The custom theme to open, as `ThemeMenu`'s `onCustomize(id?)` passes it. Absent, an id the
   * store does not hold, or a theme of a kind this store cannot show: a new theme. Read when
   * `open` turns true; changing it while open selects that theme (with the unsaved-changes
   * prompt).
   */
  themeId?: string;
  /**
   * The kind of a new theme, as `ThemeMenu`'s `onCustomize(id, slot)` passes its slot. Unset, or a
   * slot the store lacks: "ui" when the store has a UI slot, else "terminal". Read when `open`
   * turns true, as `themeId` is.
   */
  kind?: CustomThemeKind;
}

/** What the panel's body shows: the form, or the import or export panel in its place. */
type EditorPanel =
  | { kind: "form" }
  | { kind: "import" }
  | { kind: "export"; scope: "theme" | "all" };

const FORM: EditorPanel = { kind: "form" };
const SCHEMES: readonly ColorScheme[] = ["light", "dark"];
const other = (scheme: ColorScheme): ColorScheme =>
  scheme === "light" ? "dark" : "light";
const kindOf = (custom: AnyCustomTheme): CustomThemeKind =>
  isCustomTerminalTheme(custom) ? "terminal" : "ui";

/**
 * The custom theme editor: a panel docked to the right that edits the
 * store's custom themes while the page previews the draft. A store with a
 * UI slot edits UI themes, one with a terminal slot terminal themes, and one
 * with both, both kinds.
 */
export function ThemeEditor(props: ThemeEditorProps) {
  // Esc, the outside click and ✕ all arrive here; the session decides
  // whether to ask first.
  const requestClose = useRef(() => props.onOpenChange(false));
  // The sheet keeps its content through the exit animation, so a reopening
  // in that window would otherwise get the closing session back.
  const [opening, setOpening] = useState({ open: props.open, count: 0 });
  if (opening.open !== props.open) {
    setOpening({
      open: props.open,
      count: opening.count + (props.open ? 1 : 0),
    });
  }
  return (
    <Sheet
      open={props.open}
      onOpenChange={(open) => {
        if (!open) requestClose.current();
      }}
    >
      <SheetContent
        side="right"
        overlay="clear"
        showCloseButton={false}
        className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[460px]"
        onEscapeKeyDown={(event) => {
          // An Esc that clears the colour filter or ends an IME composition is not a close.
          const { target } = event;
          if (
            event.isComposing ||
            (target instanceof Element && target.closest("[data-keeps-escape]"))
          ) {
            event.preventDefault();
          }
        }}
      >
        <EditorSession
          key={opening.count}
          {...props}
          requestClose={requestClose}
        />
      </SheetContent>
    </Sheet>
  );
}

interface SessionProps extends ThemeEditorProps {
  requestClose: RefObject<() => void>;
}

/** One opening of the editor; mounted while the sheet is open. */
function EditorSession({
  open,
  themeId,
  kind,
  onOpenChange,
  requestClose,
}: SessionProps) {
  const ui = useTheme();
  const terminal = useTerminalTheme();
  const slots = useThemeSlots();
  const { style } = useStyle();
  const { customThemes: everyCustom, pref, setPref, preview } = ui;
  // Without a UI slot useTheme() answers a fallback list.
  const themes = slots.ui ? ui.themes : NO_THEMES;
  const offered = (k: CustomThemeKind) => slots[k];
  const newKind: CustomThemeKind =
    kind !== undefined && offered(kind) ? kind : slots.ui ? "ui" : "terminal";
  // Writes go through the whole stored list, so a kind this store cannot
  // show is written back untouched.
  const customs = useMemo(
    () => everyCustom.filter((c) => slots[kindOf(c)]),
    [everyCustom, slots],
  );

  const customIds = useMemo(
    () => new Set(everyCustom.map((c) => c.id)),
    [everyCustom],
  );
  const baseThemes = useMemo(
    () => themes.filter((t) => !customIds.has(t.id)),
    [themes, customIds],
  );
  const palettes = useMemo(
    () =>
      (slots.terminal ? terminal.themes : themes).filter(
        (t) => !customIds.has(t.id),
      ),
    [slots.terminal, terminal.themes, themes, customIds],
  );
  // Custom themes are never bases, so the draft composes against the base
  // lists alone.
  const composeList = useMemo<readonly TerminalTheme[]>(
    () => [...baseThemes, ...palettes],
    [baseThemes, palettes],
  );
  // Names are unique across both kinds and both slots' base themes, so the
  // two pickers never show two rows with one name.
  const labels = useMemo(
    () => [
      ...everyCustom.map((c) => c.label),
      ...composeList.map((t) => t.label),
    ],
    [everyCustom, composeList],
  );

  const start = (
    id: string | undefined,
    kindForNew: CustomThemeKind = newKind,
  ): { draft: AnyCustomTheme; saved: AnyCustomTheme | null } => {
    const custom =
      id === undefined ? undefined : customs.find((c) => c.id === id);
    if (custom !== undefined) return { draft: custom, saved: custom };
    // The committed picks, not what the page shows: that may be this
    // session's preview.
    const committed = themes.find((t) => t.id === pref.ui?.theme) ?? ui.theme;
    if (kindForNew === "terminal") {
      const pick = pref.terminal;
      const picked = pick && terminal.themes.find((t) => t.id === pick.theme);
      const shown =
        picked !== undefined
          ? {
              theme: picked,
              variant: pick?.variant ?? DEFAULT_VARIANT,
              following: false,
            }
          : slots.ui
            ? {
                theme: committed,
                variant: pref.ui?.variant ?? DEFAULT_VARIANT,
                following: true,
              }
            : {
                theme: terminal.theme,
                variant: terminal.variant,
                following: false,
              };
      const draft = newTheme({
        kind: "terminal",
        pref,
        terminal: shown,
        baseThemes,
        customs: everyCustom,
        labels,
      });
      return { draft, saved: null };
    }
    const draft = newTheme({
      pref,
      resolved: {
        theme: committed,
        variant: pref.ui?.variant ?? DEFAULT_VARIANT,
      },
      baseThemes,
      customs: everyCustom,
      labels,
      style,
    });
    return { draft, saved: null };
  };

  const [initial] = useState(() => start(themeId));
  const { state, draft, dirty, composed, dispatch } = useThemeDraft(
    initial,
    composeList,
  );
  const terminalDraft = isCustomTerminalTheme(draft) ? draft : null;
  const uiDraft = isCustomTerminalTheme(draft) ? null : draft;
  const composedUi = terminalDraft ? null : (composed as Theme | null);
  const composedTerminal = terminalDraft
    ? (composed as TerminalTheme | null)
    : null;

  const shownScheme = (custom: AnyCustomTheme) =>
    isCustomTerminalTheme(custom) || !slots.ui
      ? terminal.colorScheme
      : ui.colorScheme;
  const firstScheme = (custom: AnyCustomTheme): ColorScheme => {
    const scheme = shownScheme(custom);
    return custom[scheme]
      ? scheme
      : (SCHEMES.find((s) => custom[s] !== undefined) ?? scheme);
  };
  const [tab, setTab] = useState<EditorTab>(() => firstScheme(initial.draft));
  // The side the page shows: the last Light or Dark tab.
  const [uiScheme, setUiScheme] = useState<ColorScheme>(() =>
    firstScheme(initial.draft),
  );
  const viewFor = (
    custom: AnyCustomTheme,
    side: ColorScheme,
  ): TerminalView => ({
    split: isCustomTerminalTheme(custom) || !sameTerminal(custom),
    side: custom[side] ? side : other(side),
  });
  const [terminalView, setTerminalView] = useState(() =>
    viewFor(initial.draft, firstScheme(initial.draft)),
  );
  const [panel, setPanel] = useState<EditorPanel>(FORM);
  const [formKey, setFormKey] = useState(0);
  const [prompt, setPrompt] = useState<{ proceed: () => void } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const both = draft.light !== undefined && draft.dark !== undefined;
  const shared =
    uiDraft !== null && both && !terminalView.split && sameTerminal(uiDraft);

  // The colours each side last showed, so a side whose base disappears can
  // still be kept as fully custom.
  const lastShown = useRef<Partial<Record<ColorScheme, SidePalette>>>({});
  const lastShownTerminal = useRef<
    Partial<Record<ColorScheme, TerminalTokens>>
  >({});
  useEffect(() => {
    for (const scheme of SCHEMES) {
      const palette = composedUi?.[scheme];
      if (palette) lastShown.current[scheme] = palette;
      const terminalPalette = composedTerminal?.[scheme];
      if (terminalPalette) {
        lastShownTerminal.current[scheme] = terminalPalette.terminal;
      }
    }
  }, [composedUi, composedTerminal]);

  // A drag repaints at most once a frame.
  const [pending, setPending] = useState<PendingColour | null>(null);
  const pendingNext = useRef<PendingColour | null>(null);
  const frame = useRef(0);
  const queuePreview = (next: PendingColour | null) => {
    pendingNext.current = next;
    if (next === null) {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      setPending(null);
      return;
    }
    if (frame.current !== 0) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      setPending(pendingNext.current);
    });
  };

  const shownTheme = useMemo((): {
    theme: Theme;
    scheme: ColorScheme;
  } | null => {
    if (composedUi === null) return null;
    const scheme = composedUi[uiScheme] ? uiScheme : other(uiScheme);
    const palette = composedUi[scheme];
    if (palette === undefined) return null;
    let { tokens, terminal: terminalTokens } = palette;
    // On the Terminal tab the page keeps its UI side and shows the terminal
    // being edited.
    const edited =
      tab === "terminal" && both && !shared ? terminalView.side : scheme;
    const editedPalette = composedUi[edited];
    if (editedPalette) terminalTokens = editedPalette.terminal;
    if (pending?.kind === "ui" && pending.scheme === scheme) {
      tokens = { ...tokens, [pending.name]: pending.value };
    } else if (pending?.kind === "terminal") {
      terminalTokens = { ...terminalTokens, [pending.name]: pending.value };
    }
    return {
      theme: {
        ...composedUi,
        [scheme]: { ...palette, tokens, terminal: terminalTokens },
      } as Theme,
      scheme,
    };
  }, [composedUi, uiScheme, tab, both, shared, terminalView.side, pending]);

  // A terminal theme previews through the terminal slot alone, on the side
  // of the active tab (or the one it has).
  const shownTerminal = useMemo((): {
    theme: TerminalTheme;
    scheme: ColorScheme;
  } | null => {
    if (composedTerminal === null) return null;
    const scheme = composedTerminal[uiScheme] ? uiScheme : other(uiScheme);
    const palette = composedTerminal[scheme];
    if (palette === undefined) return null;
    if (pending?.kind !== "terminal") {
      return { theme: composedTerminal, scheme };
    }
    return {
      theme: {
        ...composedTerminal,
        [scheme]: {
          terminal: { ...palette.terminal, [pending.name]: pending.value },
        },
      } as TerminalTheme,
      scheme,
    };
  }, [composedTerminal, uiScheme, pending]);

  // Set once the editor hands back control, so a re-render on the way out
  // (Save re-composes the lists) does not preview again.
  const closing = useRef(false);
  useEffect(() => {
    if (closing.current) return;
    if (open && shownTerminal !== null) {
      preview({
        terminal: { theme: shownTerminal.theme, mode: shownTerminal.scheme },
      });
      return;
    }
    if (!open || shownTheme === null) {
      preview(null);
      return;
    }
    preview({
      ui: { theme: shownTheme.theme, mode: shownTheme.scheme },
      // Shows the edited terminal even when the user picked a separate one.
      ...(tab === "terminal" && slots.terminal
        ? { terminal: "follow" as const }
        : {}),
    });
  }, [open, shownTheme, shownTerminal, tab, slots.terminal, preview]);
  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      preview(null);
    },
    [preview],
  );

  useDirtySource(() => dirty);

  const finish = () => {
    closing.current = true;
    preview(null);
    onOpenChange(false);
  };
  const guarded = (proceed: () => void) => {
    if (dirty) setPrompt({ proceed });
    else proceed();
  };
  const close = () => guarded(finish);
  useEffect(() => {
    requestClose.current = close;
  });

  const load = (next: {
    draft: AnyCustomTheme;
    saved: AnyCustomTheme | null;
  }) => {
    dispatch({ type: "load", ...next });
    lastShown.current = {};
    lastShownTerminal.current = {};
    queuePreview(null);
    setPanel(FORM);
    setSaveError(null);
    // A terminal theme has no Terminal tab.
    if (isCustomTerminalTheme(next.draft) && tab === "terminal") {
      setTab(uiScheme);
    }
    setTerminalView(viewFor(next.draft, uiScheme));
    setFormKey((k) => k + 1);
  };
  const select = (id: string | undefined, kindForNew?: CustomThemeKind) =>
    guarded(() => load(start(id, kindForNew)));

  const seenThemeId = useRef(themeId);
  useEffect(() => {
    // On the way out the app clears the id; that is not a new selection.
    if (!open || closing.current) return;
    if (themeId === seenThemeId.current) return;
    seenThemeId.current = themeId;
    if (themeId !== undefined && themeId === draft.id) return;
    select(themeId);
  });

  const stored = customIds.has(draft.id);
  const deletedElsewhere = state.saved !== null && !stored;
  const label = draft.label.trim();
  const clash =
    label === ""
      ? undefined
      : [...everyCustom.filter((c) => c.id !== draft.id), ...composeList].find(
          (t) => t.label.trim().toLowerCase() === label.toLowerCase(),
        );
  const nameError =
    label === ""
      ? "A theme needs a name."
      : clash
        ? `The theme "${clash.label}" already has this name.`
        : null;
  const sideError =
    draft.light === undefined && draft.dark === undefined
      ? "A theme needs a light or a dark side."
      : null;

  const save = () => {
    if (nameError !== null || sideError !== null) return;
    let theme: AnyCustomTheme = { ...draft, label };
    // A new theme's id was free when it was made; another tab may have
    // taken it since.
    if (state.saved === null && stored) {
      theme = {
        ...theme,
        id: newThemeId([
          ...everyCustom.map((c) => c.id),
          ...composeList.map((t) => t.id),
        ]),
      };
    }
    const saved = theme;
    const next = everyCustom.some((c) => c.id === saved.id)
      ? everyCustom.map((c) => (c.id === saved.id ? saved : c))
      : [...everyCustom, saved];
    try {
      ui.setCustomThemes(next);
    } catch (error) {
      setSaveError(
        `The theme could not be saved: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }
    dispatch({ type: "markSaved", saved });
    // The saved theme stays on screen: reverting to the old pick right
    // after the page showed the new one would look like the save failed.
    if (isCustomTerminalTheme(saved)) {
      const mode: ThemeMode = pref.terminal?.mode ?? pref.ui?.mode ?? "system";
      setPref({ ...pref, terminal: { theme: saved.id, mode } });
    } else {
      setPref({
        ...pref,
        ui: { theme: saved.id, mode: pref.ui?.mode ?? uiScheme },
      });
    }
    finish();
  };

  // The order the list shows: UI themes, then terminal themes.
  const listed = useMemo(
    () => [
      ...customs.filter((c) => !isCustomTerminalTheme(c)),
      ...customs.filter(isCustomTerminalTheme),
    ],
    [customs],
  );

  // After Delete the editor stays open on a neighbour of the deleted theme,
  // or a new one of its kind; loaded once the store's list and pick reflect
  // the delete.
  const [afterDelete, setAfterDelete] = useState<{
    id?: string;
    kind: CustomThemeKind;
  } | null>(null);
  useLayoutEffect(() => {
    if (afterDelete === null) return;
    setAfterDelete(null);
    load(start(afterDelete.id, afterDelete.kind));
  });

  const remove = () => {
    setConfirmingDelete(false);
    const at = listed.findIndex((c) => c.id === draft.id);
    const next = listed[at + 1] ?? listed[at - 1];
    try {
      ui.setCustomThemes(everyCustom.filter((c) => c.id !== draft.id));
    } catch (error) {
      setSaveError(
        `The theme could not be deleted: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }
    setAfterDelete({ id: next?.id, kind: kindOf(draft) });
  };

  const copy = () =>
    guarded(() =>
      load({
        draft: duplicate(state.saved ?? draft, {
          baseThemes,
          customs: everyCustom,
          labels,
        }),
        saved: null,
      }),
    );

  const importThemes = (picked: NonNullable<ImportEntry["theme"]>[]) =>
    guarded(() => {
      const taken = [
        ...everyCustom.map((c) => c.id),
        ...composeList.map((t) => t.id),
      ];
      const added = picked.map((theme): AnyCustomTheme => {
        const id = newThemeId(taken);
        taken.push(id);
        return { ...theme, id };
      });
      try {
        ui.setCustomThemes([...everyCustom, ...added]);
      } catch (error) {
        setImportError(
          `The themes could not be imported: ${error instanceof Error ? error.message : String(error)}`,
        );
        return;
      }
      const first = added.find((c) => offered(kindOf(c)));
      if (first) load({ draft: first, saved: first });
    });

  const exported = useMemo(() => {
    if (panel.kind !== "export") return null;
    if (panel.scope === "all") {
      return {
        title: "Export all themes",
        text: serializeThemeFile(everyCustom, composeList),
        fileName: ALL_THEMES_FILE_NAME,
      };
    }
    const label = displayLabel(draft.label);
    return {
      title: `Export ${label}`,
      text: serializeThemeFile([{ ...draft, label }], composeList),
      fileName: themeFileName(label),
    };
  }, [panel, everyCustom, composeList, draft]);

  // The button that switched panels is gone with the old panel; without
  // this, focus would fall back to the sheet itself.
  const body = useRef<HTMLDivElement>(null);
  const shownPanel = useRef(panel);
  useEffect(() => {
    if (shownPanel.current === panel) return;
    shownPanel.current = panel;
    body.current?.querySelector<HTMLElement>("input, textarea")?.focus();
  }, [panel]);

  const changeTab = (next: EditorTab) => {
    setTab(next);
    if (next !== "terminal") setUiScheme(next);
  };

  return (
    <>
      <SheetHeader className="gap-3 border-b">
        <div className="flex items-center gap-2">
          <SheetTitle className="flex-1">Custom themes</SheetTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
            onClick={close}
          >
            <XIcon />
          </Button>
        </div>
        <SheetDescription className="sr-only">
          Edit a custom theme. The page previews every change until you save or
          close.
        </SheetDescription>
        <ThemeList
          customs={customs}
          kinds={(["ui", "terminal"] as const).filter(offered)}
          draft={draft}
          dirty={dirty}
          themes={composeList}
          onSelect={(id) => select(id)}
          onNew={(k) => select(undefined, k)}
          onImport={() => {
            setImportError(null);
            setPanel({ kind: "import" });
          }}
          exportAllDisabled={everyCustom.length === 0}
          onExportAll={() => setPanel({ kind: "export", scope: "all" })}
        />
      </SheetHeader>
      <div ref={body} className="min-h-0 flex-1 overflow-y-auto p-4">
        {panel.kind === "form" ? (
          <>
            {deletedElsewhere && (
              <p
                role="status"
                className="mb-3 rounded-frame border border-warning/40 bg-warning/10 p-2.5 text-ui-sm"
              >
                This theme was deleted elsewhere. Save adds it again.
              </p>
            )}
            {terminalDraft ? (
              <TerminalThemeForm
                key={formKey}
                draft={terminalDraft}
                dispatch={dispatch}
                composed={composedTerminal}
                lastShown={(scheme) => lastShownTerminal.current[scheme]}
                palettes={palettes}
                composeList={composeList}
                nameError={nameError}
                tab={tab === "terminal" ? uiScheme : tab}
                onTabChange={changeTab}
                onPreview={queuePreview}
              />
            ) : (
              <ThemeForm
                key={formKey}
                draft={uiDraft as CustomTheme}
                dispatch={dispatch}
                composed={composedUi}
                lastShown={(scheme) => lastShown.current[scheme]}
                baseThemes={baseThemes}
                palettes={palettes}
                composeList={composeList}
                committedTheme={pref.ui?.theme}
                nameError={nameError}
                tab={tab}
                onTabChange={changeTab}
                terminalView={terminalView}
                onTerminalViewChange={setTerminalView}
                shared={shared}
                onPreview={queuePreview}
              />
            )}
          </>
        ) : panel.kind === "import" ? (
          <ImportPanel
            themes={composeList}
            labels={labels}
            slots={slots}
            onImport={importThemes}
            error={importError}
            onBack={() => setPanel(FORM)}
          />
        ) : (
          exported && (
            <ExportPanel {...exported} onBack={() => setPanel(FORM)} />
          )
        )}
      </div>
      {panel.kind === "form" && (
        <SheetFooter className="gap-2 border-t">
          {[sideError, saveError].map(
            (message) =>
              message && (
                <p
                  key={message}
                  role="alert"
                  className="text-ui-sm text-[color-mix(in_oklab,var(--destructive),var(--foreground)_65%)]"
                >
                  {message}
                </p>
              ),
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={!stored}
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={copy}>
              Duplicate
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPanel({ kind: "export", scope: "theme" })}
            >
              Export
            </Button>
            <div className="flex-1" />
            <Button type="button" variant="outline" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={nameError !== null || sideError !== null}
              onClick={save}
            >
              Save
            </Button>
          </div>
        </SheetFooter>
      )}
      <UnsavedChangesDialog
        open={prompt !== null}
        onProceed={() => {
          setPrompt(null);
          prompt?.proceed();
        }}
        onStay={() => setPrompt(null)}
      />
      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete ${displayLabel(state.saved?.label ?? draft.label)}?`}
        description="It is removed from the custom themes. A pick that shows it falls back to another theme."
        confirmLabel="Delete"
        destructive
        onConfirm={remove}
      />
    </>
  );
}

const NO_THEMES: readonly Theme[] = [];

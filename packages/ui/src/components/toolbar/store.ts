import * as React from "react";
import { useOverflowPart } from "../overflow/part.ts";
import {
  OverflowStore,
  type PartRecord,
  type PlanInput,
} from "../overflow/store.ts";
import { dev, outerHeight, outerWidth } from "../overflow/util.ts";
import {
  type SolverResult,
  type SolverUnit,
  solveToolbar,
  type ToolbarPriority,
  type UnitView,
} from "./solver.ts";

export {
  dev,
  OUT_OF_FLOW,
  outerHeight,
  outerWidth,
  slotProps,
  useComposedRef,
} from "../overflow/util.ts";
export type { ToolbarPriority, UnitView };

export interface ToolbarCloseOverflowOptions {
  /**
   * Whether closing the ⋯ menu hands the focus back to its button, as it
   * does by default. An item that opens a surface of its own at once (a
   * `FilterMenu`, a popover) passes `false`, so the two do not race for it.
   */
  restoreFocus?: boolean;
}

/** What any part inside a `Toolbar` can read about it, through `useToolbar`. */
export interface ToolbarContextValue {
  inToolbar: true;
  /** The size its controls take when they are given none. */
  size: "sm" | "default";
  /** The pointer is coarse: a `[data-pointer]` ancestor first, then `(pointer: coarse)`. */
  coarsePointer: boolean;
  /** Some part has hidden its labels to fit. */
  anyLabelsHidden: boolean;
  /** A search holds the whole bar. */
  searchTakeover: boolean;
  /** Some part is in the ⋯ menu. */
  hasOverflow: boolean;
  /** The ⋯ button, which an overflowed part's own surface anchors to and hands the focus back to. */
  overflowTriggerRef: React.RefObject<HTMLButtonElement | null>;
  closeOverflow: (options?: ToolbarCloseOverflowOptions) => void;
}

/** What a part reads about where it stands, through `useToolbarItem`. */
export interface ToolbarItemContextValue {
  /** On the bar, or drawn in the ⋯ menu. */
  surface: "bar" | "overflow";
  /** Its place on the bar is held, out of sight, while it is drawn in the ⋯ menu. */
  overflowed: boolean;
  /** Its labels are hidden to fit (a fine pointer only). */
  labelHidden: boolean;
  /** A segmented control shown as a dropdown of its current value. */
  collapsedToDropdown: boolean;
  /** An empty search shown as its icon. */
  collapsedToIcon: boolean;
  /** Closes the ⋯ menu; nothing on the bar. */
  closeOverflow: (options?: ToolbarCloseOverflowOptions) => void;
}

export interface UnitMeasure {
  width: number;
  labelWidth?: number;
  dropdownWidth?: number;
  iconWidth?: number;
  /** The tallest it is drawn in any of its forms, the one on the bar or one held out of sight. */
  height?: number;
}

export interface UnitMeta {
  priority?: ToolbarPriority;
  active?: boolean;
  overflowable: boolean;
  group?: boolean;
  pinned?: boolean;
  /** Its surface is open: the bar keeps it where it is until it closes. */
  held?: boolean;
  /** A `ToolbarOverflow` with items of its own. */
  permanent?: boolean;
  renderOverflow?: () => React.ReactNode;
  /** A `ToolbarOverflow`'s menu class. */
  contentClassName?: string;
}

type UnitKind = "unit" | "separator" | "spacer" | "overflow";

type UnitRecord = PartRecord<UnitMeta, UnitMeasure>;

/** A label that hides to fit: how much room it gives back when it does. */
export interface LabelEntry {
  el: HTMLElement;
  /** `swap`: its button turns from a text size to an icon size; `stay`: its button keeps its size. */
  mode: "swap" | "stay";
  button: React.RefObject<HTMLElement | null>;
}

const EMPTY: SolverResult = {
  views: {},
  overflow: [],
  breaks: [],
  trigger: null,
  activeCount: 0,
  takeover: false,
  scrollable: false,
};

/**
 * One toolbar's parts on the shared overflow layer: its steps (labels,
 * dropdowns, icons, then the ⋯ by priority), its rulers, a search that
 * takes the bar, and a height kept to the tallest form of any part.
 */
export class ToolbarStore extends OverflowStore<
  UnitMeta,
  SolverResult,
  UnitMeasure
> {
  /** The row's width when a search took it. */
  private takeoverWidth = 0;
  /** The row's min-height, and the frame that will write it. */
  private minHeight = "";
  private frame = 0;
  private warnedSized = false;
  /** Under `fit`: the box the toolbar may grow to fill. */
  shell: HTMLElement | null = null;
  pane: HTMLElement | null = null;
  iconRuler: HTMLElement | null = null;
  textRuler: HTMLElement | null = null;
  /** The ⋯ with a one-digit count, and with the widest, `9+`. */
  countRuler: HTMLElement | null = null;
  wideCountRuler: HTMLElement | null = null;
  /**
   * The element in the bar that last took the focus, a surface opened from
   * it and the ⋯ menu included. Kept when it is removed while holding the
   * focus, so whoever reads it after a commit learns where the focus was
   * without catching the part before it unmounts.
   */
  lastFocused: Element | null = null;

  constructor() {
    super(EMPTY);
  }

  focusIn = (event: React.FocusEvent) => {
    // A handler deeper in may have moved the focus on before this event got
    // here (a menu handing it to its first item, the bar to its current
    // command): the events of that move have said where it went.
    if (event.target !== event.target.ownerDocument.activeElement) return;
    this.lastFocused = event.target;
  };

  focusOut = (event: React.FocusEvent) => {
    // Gone to another element: if that one is in the bar too, its focus
    // event, next, writes it back.
    if (event.relatedTarget) {
      if (this.lastFocused === event.target) this.lastFocused = null;
      return;
    }
    // Gone to nothing: a click on blank space or another window lets go of
    // it, while a removal (its part unmounting) keeps it. Which one is only
    // known once the commit that may remove it is done.
    const left = event.target;
    queueMicrotask(() => {
      if (left.isConnected && this.lastFocused === left) {
        this.lastFocused = null;
      }
    });
  };

  override viewOf(id: string): UnitView {
    return (this.result.views[id] ?? "bar") as UnitView;
  }

  permanentRecord() {
    for (const record of this.records.values()) {
      if (record.kind === "overflow") return record;
    }
    return undefined;
  }

  override connect(): () => void {
    const stop = super.connect();
    return () => {
      if (this.frame) cancelAnimationFrame(this.frame);
      this.frame = 0;
      stop();
    };
  }

  /** The room the row has for its parts. */
  protected override available(): number {
    const row = this.row;
    if (!row) return 0;
    if (this.shell && this.pane) {
      // Under `fit` the bar is as wide as its parts, so its room is the
      // shell's less the bar's own padding and border.
      const chrome =
        this.pane.getBoundingClientRect().width -
        row.getBoundingClientRect().width;
      return Math.floor(this.shell.clientWidth - chrome);
    }
    return Math.floor(row.clientWidth);
  }

  /**
   * A search that holds the bar keeps it until it lets go or the bar
   * widens; the other parts are undisplayed meanwhile and measure as
   * nothing, so they are measured again once they are back.
   */
  protected override skip(coarseChanged: boolean): boolean {
    if (!this.result.takeover) return false;
    if (this.available() > this.takeoverWidth) this.releaseTakeover();
    else if (coarseChanged) this.emit();
    return true;
  }

  protected override affectsLayout(was: UnitMeta, meta: UnitMeta): boolean {
    return (
      was.priority !== meta.priority ||
      was.active !== meta.active ||
      was.overflowable !== meta.overflowable ||
      was.group !== meta.group ||
      was.pinned !== meta.pinned ||
      was.held !== meta.held ||
      was.permanent !== meta.permanent
    );
  }

  /** A `ToolbarOverflow`'s own items are in the menu whether or not anything is folded. */
  protected override drawnInMenu(record: UnitRecord): boolean {
    return super.drawnInMenu(record) || record.kind === "overflow";
  }

  protected override isOwn(child: Element): boolean {
    // The ⋯ the toolbar places itself is counted by the solver.
    return (
      super.isOwn(child) ||
      child.hasAttribute("data-toolbar-internal") ||
      child.getAttribute("data-slot") === "toolbar-overflow-trigger"
    );
  }

  /** A `ToolbarOverflow` with items of its own keeps the ⋯ and its menu. */
  protected override keepsMenu(): boolean {
    for (const record of this.records.values()) {
      if (
        record.el?.isConnected &&
        record.kind === "overflow" &&
        record.meta.permanent
      )
        return true;
    }
    return false;
  }

  protected override solved(next: SolverResult, width: number) {
    if (next.takeover) this.takeoverWidth = width;
  }

  /** What a label gives back when it hides. */
  labelDelta(entry: LabelEntry): number {
    const width = entry.el.getBoundingClientRect().width;
    if (entry.mode === "swap") {
      const text = this.textRuler ? outerWidth(this.textRuler) : 0;
      const icon = this.iconRuler ? outerWidth(this.iconRuler) : 0;
      return Math.max(text - icon, 0) + width;
    }
    const button = entry.button.current;
    const gap = button
      ? Number.parseFloat(getComputedStyle(button).columnGap) || 0
      : 0;
    return gap + width;
  }

  protected override plan({
    available,
    gap,
    coarse,
    children,
  }: PlanInput<UnitMeta, UnitMeasure>): SolverResult {
    const ruler = (el: HTMLElement | null, otherwise: number) =>
      el ? Math.ceil(outerWidth(el)) : otherwise;
    const triggerWidth = ruler(this.iconRuler, 0);
    const countWidth = ruler(this.countRuler, triggerWidth);
    const wideCountWidth = ruler(this.wideCountRuler, triggerWidth);
    const units: SolverUnit[] = [];
    let tallest = 0;
    for (const child of children) {
      const { el, record } = child;
      if (!record) {
        this.warnSized(el);
        tallest = Math.max(tallest, outerHeight(el));
        units.push({
          id: child.id,
          kind: "fixed",
          width: Math.ceil(outerWidth(el)),
          priority: "pin",
        });
        continue;
      }
      const unit: SolverUnit = {
        id: record.id,
        kind: record.kind as UnitKind,
        width: 0,
        priority: record.meta.priority,
        active: record.meta.active,
        overflowable: record.meta.overflowable,
        group: record.meta.group,
        pinned: record.meta.pinned,
      };
      if (record.meta.held) unit.held = this.viewOf(record.id);
      if (child.hidden) unit.cssHidden = true;
      else if (record.kind === "overflow") {
        if (record.meta.permanent) {
          // Without the count it shows now, which the solver adds back for
          // the parts each step moves into it.
          const shown = el.querySelector("[data-slot=toolbar-overflow-count]");
          const count = !shown
            ? 0
            : (shown.textContent === "9+" ? wideCountWidth : countWidth) -
              triggerWidth;
          unit.width =
            Math.ceil(outerWidth(el.firstElementChild ?? el)) - count;
        }
      } else if (record.kind !== "spacer") {
        const measured = record.measure(child.view, el);
        tallest = Math.max(tallest, measured.height ?? 0);
        unit.width = Math.ceil(measured.width);
        if (measured.labelWidth !== undefined)
          unit.labelWidth = Math.ceil(measured.labelWidth);
        if (measured.dropdownWidth !== undefined)
          unit.dropdownWidth = Math.ceil(measured.dropdownWidth);
        if (measured.iconWidth !== undefined)
          unit.iconWidth = Math.ceil(measured.iconWidth);
      }
      units.push(unit);
    }
    this.hold(tallest);
    return solveToolbar({
      availableWidth: available,
      gap,
      overflowTriggerWidth: triggerWidth,
      overflowTriggerCountWidth: countWidth,
      overflowTriggerWideCountWidth: wideCountWidth,
      permanentOverflow: this.keepsMenu(),
      coarsePointer: coarse,
      units,
    });
  }

  /**
   * Keeps the row as tall as its tallest part in any form, so the bar keeps
   * its height as a search turns into its icon or a part goes into the ⋯
   * menu. Only the first height is written at once. A later one comes from
   * parts that changed size (a style drawing them anew, a transition), heard
   * through the ResizeObserver: the row resized while it delivers is a
   * change it cannot deliver until the next frame, and it reports a loop.
   */
  private hold(tallest: number) {
    const row = this.row;
    // Measured as nothing, the bar is out of sight: it keeps what it had.
    if (!row || tallest <= 0) return;
    this.minHeight = `${tallest}px`;
    if (row.style.minHeight === this.minHeight) return;
    if (
      row.style.minHeight === "" ||
      typeof requestAnimationFrame !== "function"
    ) {
      row.style.minHeight = this.minHeight;
      return;
    }
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (this.row) this.row.style.minHeight = this.minHeight;
    });
  }

  /**
   * A child the bar does not know is counted at the width it is drawn at,
   * which a browser that grows it into spare room, or shrinks it below its
   * content, has already set from the bar's room: counted that way the parts
   * either never come back from the ⋯ or never go into it.
   */
  private warnSized(el: HTMLElement) {
    if (this.warnedSized || !dev()) return;
    const style = getComputedStyle(el);
    const grows = (Number.parseFloat(style.flexGrow) || 0) > 0;
    const shrink =
      style.flexShrink === "" ? 1 : Number.parseFloat(style.flexShrink);
    const below =
      (style.minWidth !== "" && style.minWidth !== "auto") ||
      (style.overflowX !== "" && style.overflowX !== "visible");
    if (!grows && !(shrink > 0 && below)) return;
    this.warnedSized = true;
    console.warn(
      "Toolbar: a child it does not know grows into the room left or shrinks below its content, so the bar counts it at the width the browser gave it and moves the wrong parts. Leave room with `ToolbarSpacer`, and put text that takes the room left in a `ToolbarItem` with `flex` and a `minWidth`.",
      el,
    );
  }

  /** Lets go of a search's hold on the bar. */
  releaseTakeover() {
    if (!this.result.takeover) return;
    this.result = { ...this.result, takeover: false };
    this.markRelayout();
    this.emit();
    this.schedule();
  }
}

export interface ToolbarInternal {
  store: ToolbarStore;
  size: "sm" | "default";
  labelCollapse: "auto" | "never";
}

export const ToolbarInternalContext =
  React.createContext<ToolbarInternal | null>(null);
export const ToolbarContext = React.createContext<ToolbarContextValue | null>(
  null,
);
export const ToolbarItemContext =
  React.createContext<ToolbarItemContextValue | null>(null);

/** The toolbar a part stands in, or `null` outside one. */
export function useToolbar(): ToolbarContextValue | null {
  return React.useContext(ToolbarContext);
}

/** Where a part stands in its toolbar, or `null` outside one. */
export function useToolbarItem(): ToolbarItemContextValue | null {
  return React.useContext(ToolbarItemContext);
}

/** A unit's labels, which it counts to know its width with them hidden. */
export interface UnitLabels {
  add(entry: LabelEntry): () => void;
}
export const UnitLabelsContext = React.createContext<UnitLabels | null>(null);

/** The button a `ToolbarLabel` sits in: how it hides, and where its text goes. */
export interface LabelHost {
  mode: "swap" | "stay";
  /** Its label may hide: a fine pointer, `labelCollapse` not `never`, and something left to show. */
  collapsible: boolean;
  hidden: boolean;
  button: React.RefObject<HTMLElement | null>;
  setText: (text: string) => void;
}
export const LabelHostContext = React.createContext<LabelHost | null>(null);

export interface UnitOptions {
  kind?: UnitKind;
  /** `false` keeps a part that could be a unit out of the count. */
  enabled?: boolean;
  meta: UnitMeta;
  /** Widths besides the part's own outer width and its labels. */
  measure?: (
    view: UnitView,
    el: HTMLElement,
    own: number,
  ) => Partial<UnitMeasure>;
}

export interface Unit {
  id: string;
  /** Written in and laid out by the toolbar: on its bar, and not inside another part. */
  registered: boolean;
  view: UnitView;
  ref: (el: HTMLElement | null) => void;
  labels: UnitLabels;
  internal: ToolbarInternal | null;
  item: ToolbarItemContextValue;
}

/**
 * Writes a part into its toolbar and reads back where it stands. Outside a
 * toolbar, in the ⋯ menu or inside another part, it counts nothing and
 * reads `"bar"`.
 */
export function useToolbarUnit(options: UnitOptions): Unit {
  const internal = React.useContext(ToolbarInternalContext);
  const parent = React.useContext(ToolbarItemContext);
  const store = internal?.store ?? null;
  const labels = React.useRef(new Set<LabelEntry>());
  const part = useOverflowPart<UnitMeta, UnitMeasure>({
    store,
    enabled: options.enabled !== false && parent === null,
    kind: options.kind,
    meta: options.meta,
    measure: (view: UnitView, node) => {
      const own = outerWidth(node);
      const result: UnitMeasure = { width: own, height: outerHeight(node) };
      if (labels.current.size > 0 && store) {
        let delta = 0;
        for (const entry of labels.current) delta += store.labelDelta(entry);
        if (view === "label") {
          result.width = own + delta;
          result.labelWidth = own;
        } else {
          result.labelWidth = own - delta;
        }
      }
      return { ...result, ...options.measure?.(view, node, own) };
    },
  });
  const view = part.view as UnitView;

  const labelsApi = React.useMemo<UnitLabels>(
    () => ({
      add(entry) {
        labels.current.add(entry);
        store?.observe(entry.el);
        store?.schedule();
        return () => {
          labels.current.delete(entry);
          store?.unobserve(entry.el);
          store?.schedule();
        };
      },
    }),
    [store],
  );

  const closeOverflow = store?.closeOverflow ?? noClose;
  const item = React.useMemo<ToolbarItemContextValue>(
    () =>
      parent ?? {
        surface: "bar",
        overflowed: view === "overflow",
        labelHidden: view === "label",
        collapsedToDropdown: view === "dropdown",
        collapsedToIcon: view === "icon",
        closeOverflow,
      },
    [parent, view, closeOverflow],
  );

  return {
    id: part.id,
    registered: part.registered,
    view,
    ref: part.ref,
    labels: labelsApi,
    internal,
    item,
  };
}

function noClose() {}

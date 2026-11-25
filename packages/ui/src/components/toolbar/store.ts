import * as React from "react";
import {
  type SolverResult,
  type SolverUnit,
  solveToolbar,
  type ToolbarPriority,
  type UnitView,
} from "./solver.ts";

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
  /** A `ToolbarOverflow` with items of its own. */
  permanent?: boolean;
  renderOverflow?: () => React.ReactNode;
  /** A `ToolbarOverflow`'s menu class. */
  contentClassName?: string;
}

type UnitKind = "unit" | "separator" | "spacer" | "overflow";

interface UnitRecord {
  id: string;
  kind: UnitKind;
  el: HTMLElement | null;
  meta: UnitMeta;
  measure: (view: UnitView, el: HTMLElement) => UnitMeasure;
}

/** A label that hides to fit: how much room it gives back when it does. */
export interface LabelEntry {
  el: HTMLElement;
  /** `swap`: its button turns from a text size to an icon size; `stay`: its button keeps its size. */
  mode: "swap" | "stay";
  button: React.RefObject<HTMLElement | null>;
}

/**
 * Out of the flow and out of sight, still measured: a part in the ⋯ menu, a
 * hidden label, a probe. Its width is its own, unwrapped: no `w-max`, which
 * would take a button's `size-*` with it.
 */
export const OUT_OF_FLOW =
  "pointer-events-none invisible absolute top-0 start-0 whitespace-nowrap";

/** The width a part takes in its row, margins included. */
export function outerWidth(el: Element): number {
  const style = getComputedStyle(el);
  return (
    el.getBoundingClientRect().width +
    (Number.parseFloat(style.marginLeft) || 0) +
    (Number.parseFloat(style.marginRight) || 0)
  );
}

/** The height a part takes in its row, margins included. */
export function outerHeight(el: Element): number {
  const style = getComputedStyle(el);
  return (
    el.getBoundingClientRect().height +
    (Number.parseFloat(style.marginTop) || 0) +
    (Number.parseFloat(style.marginBottom) || 0)
  );
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
 * One toolbar's parts, the layout they were last given and who listens: the
 * parts write themselves in as they render, without re-rendering each
 * other, and each reads back only its own place.
 */
export class ToolbarStore {
  private records = new Map<string, UnitRecord>();
  private listeners = new Set<() => void>();
  private observer: ResizeObserver | null = null;
  private observed = new Set<Element>();
  private scheduled = false;
  /** The row's width when a search took it. */
  private takeoverWidth = 0;
  /** The row's min-height, and the frame that will write it. */
  private minHeight = "";
  private frame = 0;
  /** The answers since the last one that held, to catch two that alternate. */
  private chain: string[] = [];
  /** At this width, the answer kept over one that would only flip back. */
  private held: {
    width: number;
    coarse: boolean;
    keep: SolverResult;
    avoid: string;
  } | null = null;
  result: SolverResult = EMPTY;
  /** Bumped when what an overflowed part draws in the menu changes. */
  menuVersion = 0;
  row: HTMLElement | null = null;
  /** Under `fit`: the box the toolbar may grow to fill. */
  shell: HTMLElement | null = null;
  pane: HTMLElement | null = null;
  iconRuler: HTMLElement | null = null;
  textRuler: HTMLElement | null = null;
  coarse = false;
  overflowOpen = false;
  /** The next close of the ⋯ menu leaves the focus where it is. */
  keepFocusOnClose = false;
  /** The focus was in a part that just went to the menu: the ⋯ takes it. */
  rescueFocus = false;
  readonly triggerRef: React.RefObject<HTMLButtonElement | null> = {
    current: null,
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private emit() {
    for (const listener of [...this.listeners]) listener();
  }

  getResult = () => this.result;

  viewOf(id: string): UnitView {
    return this.result.views[id] ?? "bar";
  }

  setOverflowOpen(open: boolean) {
    if (this.overflowOpen === open) return;
    this.overflowOpen = open;
    this.emit();
  }

  closeOverflow = (options?: ToolbarCloseOverflowOptions) => {
    if (options?.restoreFocus === false) this.keepFocusOnClose = true;
    this.setOverflowOpen(false);
  };

  register(record: UnitRecord) {
    this.records.set(record.id, record);
    if (record.el) this.observe(record.el);
    this.schedule();
  }

  unregister(id: string) {
    const record = this.records.get(id);
    if (!record) return;
    this.records.delete(id);
    if (record.el) this.unobserve(record.el);
    this.schedule();
  }

  /** The part's latest props: solved again only when they bear on the layout. */
  update(id: string, meta: UnitMeta) {
    const record = this.records.get(id);
    if (!record) return;
    const was = record.meta;
    record.meta = meta;
    if (
      was.priority !== meta.priority ||
      was.active !== meta.active ||
      was.overflowable !== meta.overflowable ||
      was.group !== meta.group ||
      was.pinned !== meta.pinned ||
      was.permanent !== meta.permanent
    ) {
      this.schedule();
    }
    if (
      this.overflowOpen &&
      (this.viewOf(id) === "overflow" || record.kind === "overflow")
    ) {
      this.menuVersion++;
      this.emit();
    }
  }

  setElement(id: string, el: HTMLElement | null) {
    const record = this.records.get(id);
    if (!record || record.el === el) return;
    if (record.el) this.unobserve(record.el);
    record.el = el;
    if (el) this.observe(el);
    this.schedule();
  }

  /** The parts in the ⋯ menu, in order, then the `ToolbarOverflow`'s own. */
  overflowRecords() {
    return this.result.overflow
      .map((id) => this.records.get(id))
      .filter((record): record is UnitRecord => record !== undefined);
  }

  permanentRecord() {
    for (const record of this.records.values()) {
      if (record.kind === "overflow") return record;
    }
    return undefined;
  }

  observe(el: Element) {
    this.observed.add(el);
    this.observer?.observe(el);
  }

  unobserve(el: Element) {
    this.observed.delete(el);
    this.observer?.unobserve(el);
  }

  /** Starts watching sizes, the pointer and the style; the returned function stops. */
  connect(): () => void {
    const solve = () => this.solve();
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(solve);
      for (const el of this.observed) this.observer.observe(el);
    }
    const media =
      typeof matchMedia === "function" ? matchMedia("(pointer: coarse)") : null;
    media?.addEventListener("change", solve);
    // A style or a forced pointer redraws the parts at other sizes, and a
    // margin that changes (the touch room beside an icon button) is no
    // resize of the part itself.
    const mutations =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(solve);
    mutations?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-style", "data-pointer"],
      subtree: true,
    });
    let live = true;
    document.fonts?.ready.then(() => {
      if (live) solve();
    });
    return () => {
      live = false;
      if (this.frame) cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.observer?.disconnect();
      this.observer = null;
      media?.removeEventListener("change", solve);
      mutations?.disconnect();
    };
  }

  /** Solves again once the current commit is done and every ref is set. */
  schedule() {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      this.solve();
    });
  }

  private readCoarse(): boolean {
    const forced = this.row
      ?.closest("[data-pointer]")
      ?.getAttribute("data-pointer");
    if (forced === "coarse") return true;
    if (forced === "fine") return false;
    return (
      typeof matchMedia === "function" &&
      matchMedia("(pointer: coarse)").matches
    );
  }

  /** The room the row has for its parts. */
  private available(): number {
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

  /** Measures every part and lays the bar out again, notifying only when that changes. */
  solve() {
    const row = this.row;
    if (!row?.isConnected) return;
    const coarse = this.readCoarse();
    const coarseChanged = coarse !== this.coarse;
    this.coarse = coarse;
    // A search that holds the bar keeps it until it lets go or the bar
    // widens; the other parts are undisplayed meanwhile and measure as
    // nothing, so they are measured again once they are back.
    if (this.result.takeover) {
      if (this.available() > this.takeoverWidth) this.releaseTakeover();
      else if (coarseChanged) this.emit();
      return;
    }
    const records = [...this.records.values()].filter(
      (record) => record.el?.isConnected,
    );
    const mine = new Set<Element>();
    for (const record of records) if (record.el) mine.add(record.el);
    const units: Array<{ el: Element; unit: SolverUnit }> = [];
    let tallest = 0;
    for (const record of records) {
      const el = record.el as HTMLElement;
      // A part wrapped in an element of the caller's is that element's; the
      // wrapper is counted whole, below.
      if (el.parentElement !== row) continue;
      const style = getComputedStyle(el);
      const view = this.viewOf(record.id);
      const unit: SolverUnit = {
        id: record.id,
        kind: record.kind,
        width: 0,
        priority: record.meta.priority,
        active: record.meta.active,
        overflowable: record.meta.overflowable,
        group: record.meta.group,
        pinned: record.meta.pinned,
      };
      if (style.display === "none") unit.cssHidden = true;
      else if (record.kind === "overflow") {
        unit.width = record.meta.permanent
          ? Math.ceil(outerWidth(el.firstElementChild ?? el))
          : 0;
      } else if (record.kind !== "spacer") {
        const measured = record.measure(view, el);
        tallest = Math.max(tallest, measured.height ?? 0);
        unit.width = Math.ceil(measured.width);
        if (measured.labelWidth !== undefined)
          unit.labelWidth = Math.ceil(measured.labelWidth);
        if (measured.dropdownWidth !== undefined)
          unit.dropdownWidth = Math.ceil(measured.dropdownWidth);
        if (measured.iconWidth !== undefined)
          unit.iconWidth = Math.ceil(measured.iconWidth);
      }
      units.push({ el, unit });
    }
    let fixed = 0;
    for (const child of row.children) {
      // The ⋯ the toolbar places itself is counted by the solver.
      if (
        mine.has(child) ||
        child.hasAttribute("data-toolbar-internal") ||
        child.getAttribute("data-slot") === "toolbar-overflow-trigger"
      )
        continue;
      const style = getComputedStyle(child);
      if (style.display === "none" || style.position === "absolute") continue;
      tallest = Math.max(tallest, outerHeight(child));
      units.push({
        el: child,
        unit: {
          id: `fixed-${fixed++}`,
          kind: "fixed",
          width: Math.ceil(outerWidth(child)),
          priority: "pin",
        },
      });
    }
    units.sort((a, b) =>
      a.el === b.el
        ? 0
        : a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1,
    );
    const permanent = records.some(
      (record) => record.kind === "overflow" && record.meta.permanent,
    );
    this.hold(tallest);
    const gap = Number.parseFloat(getComputedStyle(row).columnGap) || 0;
    const width = this.available();
    let next = solveToolbar({
      availableWidth: width,
      gap,
      overflowTriggerWidth: this.iconRuler
        ? Math.ceil(outerWidth(this.iconRuler))
        : 0,
      permanentOverflow: permanent,
      coarsePointer: coarse,
      units: units.map((each) => each.unit),
    });
    next = this.settle(next, width, coarse);
    const same = JSON.stringify(next) === JSON.stringify(this.result);
    if (same) {
      this.chain = [];
      if (coarseChanged) this.emit();
      return;
    }
    const active = document.activeElement;
    if (active && row.contains(active)) {
      for (const id of next.overflow) {
        if (this.viewOf(id) === "overflow") continue;
        if (this.records.get(id)?.el?.contains(active)) this.rescueFocus = true;
      }
    }
    this.result = next;
    if (next.takeover) this.takeoverWidth = width;
    if (next.overflow.length === 0 && !permanent) this.overflowOpen = false;
    this.menuVersion++;
    this.emit();
  }

  /**
   * Widths read with fractions, and labels estimated while hidden, can put a
   * bar on an edge where showing a part makes it not fit and hiding it makes
   * it fit. When an answer comes back before any has held, the more
   * collapsed of the two is kept until the width or the pointer changes.
   */
  private settle(
    next: SolverResult,
    width: number,
    coarse: boolean,
  ): SolverResult {
    const held = this.held;
    if (held && (held.width !== width || held.coarse !== coarse)) {
      this.held = null;
    }
    const key = JSON.stringify(next);
    if (this.held?.avoid === key) return this.held.keep;
    if (!this.chain.includes(key)) {
      this.chain.push(key);
      return next;
    }
    this.chain = [];
    const folded = (result: SolverResult) =>
      Object.values(result.views).filter((view) => view !== "bar").length;
    const keep = folded(next) >= folded(this.result) ? next : this.result;
    const avoid = keep === next ? JSON.stringify(this.result) : key;
    this.held = { width, coarse, keep, avoid };
    return keep;
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

  /** Lets go of a search's hold on the bar. */
  releaseTakeover() {
    if (!this.result.takeover) return;
    this.result = { ...this.result, takeover: false };
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

const noSubscribe = () => () => {};
const bar = (): UnitView => "bar";

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
  const registered =
    store !== null && options.enabled !== false && parent === null;
  const id = React.useId();
  const kind = options.kind ?? "unit";
  const el = React.useRef<HTMLElement | null>(null);
  const labels = React.useRef(new Set<LabelEntry>());
  const latest = React.useRef(options);
  latest.current = options;

  const record = React.useRef<UnitRecord | null>(null);
  if (record.current === null) {
    record.current = {
      id,
      kind,
      el: null,
      meta: options.meta,
      measure: (view, node) => {
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
        return { ...result, ...latest.current.measure?.(view, node, own) };
      },
    };
  }

  const view = React.useSyncExternalStore(
    registered && store ? store.subscribe : noSubscribe,
    registered && store ? () => store.viewOf(id) : bar,
    bar,
  );

  React.useLayoutEffect(() => {
    if (!registered || !store || !record.current) return;
    record.current.el = el.current;
    store.register(record.current);
    return () => store.unregister(id);
  }, [registered, store, id]);

  React.useLayoutEffect(() => {
    if (registered && store) store.update(id, options.meta);
  });

  const ref = React.useCallback(
    (node: HTMLElement | null) => {
      el.current = node;
      if (record.current) record.current.el = node;
      if (registered && store) store.setElement(id, node);
    },
    [registered, store, id],
  );

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
    id,
    registered,
    view: registered ? view : "bar",
    ref,
    labels: labelsApi,
    internal,
    item,
  };
}

function noClose() {}

/** The props that hold an overflowed part's place on the bar. */
export function slotProps(overflowed: boolean) {
  return overflowed
    ? ({ inert: true, "data-overflowed": "" } as const)
    : ({} as const);
}

/** Calls every ref it is given. */
export function useComposedRef<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  // biome-ignore lint/correctness/useExhaustiveDependencies: the refs are the dependencies
  return React.useCallback(compose(refs), refs);
}

function compose<T>(refs: Array<React.Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.RefObject<T | null>).current = node;
    }
  };
}

// Only what is read here: the package builds without Node's types.
declare const process: { env: { NODE_ENV?: string } };

/** A bundler writes NODE_ENV in; a page loaded with none gets no warnings rather than an error. */
export const dev = () => {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
};

import type * as React from "react";
import { outerHeight, outerWidth } from "./util.ts";

/** What every part of a row that folds into a ⋯ tells its row. */
export interface PartMeta {
  /** It has a form in the ⋯ menu. */
  overflowable: boolean;
  renderOverflow?: () => React.ReactNode;
}

/** What a part measures at, in a view: its width, and the height it takes. */
export interface PartMeasure {
  width: number;
  height?: number;
}

export interface PartRecord<
  M extends PartMeta,
  X extends PartMeasure = PartMeasure,
> {
  id: string;
  /** The component's own kinds: Toolbar's "unit" | "separator" | "spacer" | "overflow", TabNav's "link". */
  kind: string;
  el: HTMLElement | null;
  meta: M;
  measure(view: string, el: HTMLElement): X;
}

/** A child of the row, in row order: a part, or a child the component does not know. */
export interface RowChild<
  M extends PartMeta,
  X extends PartMeasure = PartMeasure,
> {
  /** A part's id; a child the component does not know is `fixed-<n>`. */
  id: string;
  el: HTMLElement;
  /** `null`: a child the component does not know, never moved. */
  record: PartRecord<M, X> | null;
  /** Its view in the current result. */
  view: string;
  /** Undisplayed by the caller's CSS. */
  hidden: boolean;
}

export interface PlanInput<
  M extends PartMeta,
  X extends PartMeasure = PartMeasure,
> {
  available: number;
  gap: number;
  coarse: boolean;
  children: readonly RowChild<M, X>[];
}

export interface OverflowResult {
  views: Record<string, string>;
  /** The parts in the menu, in row order. */
  overflow: string[];
  /** Parts in the menu parted from the one before by a separator. */
  breaks: string[];
}

export interface OverflowCloseOptions {
  /**
   * Whether closing the ⋯ menu hands the focus back to its button, as it
   * does by default. An item that opens a surface of its own at once (a
   * `FilterMenu`, a popover) passes `false`, so the two do not race for it.
   */
  restoreFocus?: boolean;
}

/**
 * One row's parts, the layout they were last given and who listens: the
 * parts write themselves in as they render, without re-rendering each
 * other, and each reads back only its own place. What to fold first, how
 * wide the row is in a layout and what the ⋯ looks like are the
 * component's; measuring, when to measure again, holding a folded part's
 * place and the ⋯ menu are here.
 */
export abstract class OverflowStore<
  M extends PartMeta,
  R extends OverflowResult,
  X extends PartMeasure = PartMeasure,
> {
  protected records = new Map<string, PartRecord<M, X>>();
  private listeners = new Set<() => void>();
  private observer: ResizeObserver | null = null;
  private observed = new Set<Element>();
  private scheduled = false;
  /** The row marked `data-relayout`, and the frame that takes the mark off. */
  private relayoutRow: HTMLElement | null = null;
  private relayoutFrame = 0;
  /** The answers since the last one that held, to catch two that alternate. */
  private chain: string[] = [];
  /** At this width, the answer kept over one that would only flip back. */
  private held: {
    width: number;
    coarse: boolean;
    keep: R;
    avoid: string;
  } | null = null;
  result: R;
  /** Bumped when what an overflowed part draws in the menu changes. */
  menuVersion = 0;
  row: HTMLElement | null = null;
  coarse = false;
  overflowOpen = false;
  /** The next close of the ⋯ menu leaves the focus where it is. */
  keepFocusOnClose = false;
  /** The focus was in a part that just went to the menu: the ⋯ takes it. */
  rescueFocus = false;
  readonly triggerRef: React.RefObject<HTMLButtonElement | null> = {
    current: null,
  };

  constructor(empty: R) {
    this.result = empty;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  protected emit() {
    for (const listener of [...this.listeners]) listener();
  }

  getResult = () => this.result;

  viewOf(id: string): string {
    return this.result.views[id] ?? "bar";
  }

  setOverflowOpen(open: boolean) {
    if (this.overflowOpen === open) return;
    this.overflowOpen = open;
    this.emit();
  }

  closeOverflow = (options?: OverflowCloseOptions) => {
    if (options?.restoreFocus === false) this.keepFocusOnClose = true;
    this.setOverflowOpen(false);
  };

  register(record: PartRecord<M, X>) {
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
  update(id: string, meta: M) {
    const record = this.records.get(id);
    if (!record) return;
    const was = record.meta;
    record.meta = meta;
    if (this.affectsLayout(was, meta)) this.schedule();
    if (this.overflowOpen && this.drawnInMenu(record)) {
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

  /** The parts in the ⋯ menu, in row order. */
  overflowRecords() {
    return this.result.overflow
      .map((id) => this.records.get(id))
      .filter((record): record is PartRecord<M, X> => record !== undefined);
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
      if (this.relayoutFrame) cancelAnimationFrame(this.relayoutFrame);
      this.relayoutFrame = 0;
      this.relayoutRow?.removeAttribute("data-relayout");
      this.relayoutRow = null;
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

  /** The row's children, parts and others, in row order. */
  private rowChildren(row: HTMLElement): RowChild<M, X>[] {
    const records = [...this.records.values()].filter(
      (record) => record.el?.isConnected,
    );
    const mine = new Set<Element>();
    for (const record of records) if (record.el) mine.add(record.el);
    const children: RowChild<M, X>[] = [];
    for (const record of records) {
      const el = record.el as HTMLElement;
      // A part wrapped in an element of the caller's is that element's; the
      // wrapper is counted whole, below.
      if (el.parentElement !== row) continue;
      children.push({
        id: record.id,
        el,
        record,
        view: this.viewOf(record.id),
        hidden: getComputedStyle(el).display === "none",
      });
    }
    let fixed = 0;
    for (const child of row.children) {
      if (mine.has(child) || this.isOwn(child)) continue;
      const style = getComputedStyle(child);
      if (style.display === "none" || style.position === "absolute") continue;
      children.push({
        id: `fixed-${fixed++}`,
        el: child as HTMLElement,
        record: null,
        view: "bar",
        hidden: false,
      });
    }
    children.sort((a, b) =>
      a.el === b.el
        ? 0
        : a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1,
    );
    return children;
  }

  /** Measures every part and lays the row out again, notifying only when that changes. */
  solve() {
    const row = this.row;
    if (!row?.isConnected) return;
    const coarse = this.readCoarse();
    const coarseChanged = coarse !== this.coarse;
    this.coarse = coarse;
    if (this.skip(coarseChanged)) return;
    const children = this.rowChildren(row);
    const gap = Number.parseFloat(getComputedStyle(row).columnGap) || 0;
    const width = this.available();
    let next = this.plan({ available: width, gap, coarse, children });
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
    this.solved(next, width);
    if (next.overflow.length === 0 && !this.keepsMenu()) {
      this.overflowOpen = false;
    }
    this.menuVersion++;
    this.markRelayout();
    this.emit();
  }

  /** The layout for this width: the component's step table and row width. */
  protected abstract plan(input: PlanInput<M, X>): R;

  /** The room the row has for its parts. */
  protected available(): number {
    return this.row ? Math.floor(this.row.clientWidth) : 0;
  }

  /** Skips this solve. */
  protected skip(_coarseChanged: boolean): boolean {
    return false;
  }

  /** Whether a change of meta bears on the layout: any field but a function. */
  protected affectsLayout(was: M, now: M): boolean {
    const keys = new Set([...Object.keys(was), ...Object.keys(now)]);
    for (const key of keys) {
      const a = (was as Record<string, unknown>)[key];
      const b = (now as Record<string, unknown>)[key];
      if (typeof a === "function" || typeof b === "function") continue;
      if (a !== b) return true;
    }
    return false;
  }

  /** What the part draws is in the open menu, so the menu draws again when it changes. */
  protected drawnInMenu(record: PartRecord<M, X>): boolean {
    return this.viewOf(record.id) === "overflow";
  }

  /** After a new result is taken. */
  protected solved(_next: R, _width: number): void {}

  /** The menu stays open with nothing folded. */
  protected keepsMenu(): boolean {
    return false;
  }

  /** A row child that is the component's own, not the caller's: a ruler, a ⋯ held out of sight. */
  protected isOwn(child: Element): boolean {
    return child.hasAttribute("data-overflow-internal");
  }

  /**
   * Marks the row for the frame a new layout is first drawn in, so nothing in
   * it transitions there. A part going into the ⋯ menu moves to the row's
   * start at once, and a `visibility` easing to hidden would draw it there,
   * over the parts at the start, until it is done; one coming back would ease
   * from hidden, leaving a hole for a frame. The mark goes at the start of
   * the next frame, once the values have stopped changing, so taking it off
   * starts nothing either.
   */
  protected markRelayout() {
    const row = this.row;
    if (!row || typeof requestAnimationFrame !== "function") return;
    row.setAttribute("data-relayout", "");
    this.relayoutRow = row;
    if (this.relayoutFrame) return;
    this.relayoutFrame = requestAnimationFrame(() => {
      this.relayoutFrame = 0;
      this.relayoutRow?.removeAttribute("data-relayout");
      this.relayoutRow = null;
    });
  }

  /**
   * Widths read with fractions, and labels estimated while hidden, can put a
   * row on an edge where showing a part makes it not fit and hiding it makes
   * it fit. When an answer comes back before any has held, the more
   * collapsed of the two is kept until the width or the pointer changes.
   */
  private settle(next: R, width: number, coarse: boolean): R {
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
    const folded = (result: R) =>
      Object.values(result.views).filter((view) => view !== "bar").length;
    const keep = folded(next) >= folded(this.result) ? next : this.result;
    const avoid = keep === next ? JSON.stringify(this.result) : key;
    this.held = { width, coarse, keep, avoid };
    return keep;
  }
}

/** A part's own outer width and height, the default measure. */
export function measureOuter(_view: string, el: HTMLElement): PartMeasure {
  return { width: outerWidth(el), height: outerHeight(el) };
}

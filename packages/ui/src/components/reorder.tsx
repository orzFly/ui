"use client";

import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon } from "lucide-react";
import { Slot } from "radix-ui";
import * as React from "react";

import { edgeScrollBy, scrollerEdges, scrollerOf } from "../lib/edge-scroll.ts";
import { isApplePlatform } from "../lib/platform.ts";
import {
  nearestPlace,
  positionOf,
  type ReorderCanDrop,
  type ReorderMove,
  type ReorderPlaces,
  type ReorderPosition,
  samePlace,
  stepPlace,
} from "../lib/reorder-places.ts";
import { cn } from "../lib/utils.ts";
import { Button } from "./button.tsx";
import { Kbd } from "./kbd.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip.tsx";

export {
  moveInGroups,
  moveItem,
  type ReorderMove,
  type ReorderPosition,
} from "../lib/reorder-places.ts";

export interface ReorderLabels {
  /** Default `Move ${name} up`. */
  moveUp: (name: string) => string;
  /** Default `Move ${name} down`. */
  moveDown: (name: string) => string;
  /**
   * Default `${name} moved to position ${position} of ${count}`, then
   * ` in ${group}` when there is one. `group` is the ReorderGroup's `name`,
   * passed only in a list with groups.
   */
  moved: (
    name: string,
    position: number,
    count: number,
    group?: string,
  ) => string;
}

type ReorderData =
  | { items: readonly string[]; groups?: never }
  | {
      groups: readonly { id: string; items: readonly string[] }[];
      items?: never;
    };

export type ReorderProps = React.ComponentProps<"div"> &
  ReorderData & {
    /** Called once for each drag let go somewhere new and each press of a move button or key. */
    onMove: (move: ReorderMove) => void;
    /** Default: every row moves. */
    canMove?: (id: string) => boolean;
    /** Default: every place is accepted. Never asked about a row's own place. */
    canDrop?: ReorderCanDrop;
    /** Whether some place above accepts the row; asked instead of walking the places with `canDrop`. */
    canMoveUp?: (id: string) => boolean;
    /** Whether some place below accepts the row; asked instead of walking the places with `canDrop`. */
    canMoveDown?: (id: string) => boolean;
    /** No row moves for now, while an order is being saved say. */
    disabled?: boolean;
    labels?: Partial<ReorderLabels>;
    /** Render the single child element (a `ul`, a `TableBody`, a `List`) as the root. */
    asChild?: boolean;
  };

const LABELS: ReorderLabels = {
  moveUp: (name) => `Move ${name} up`,
  moveDown: (name) => `Move ${name} down`,
  moved: (name, position, count, group) =>
    `${name} moved to position ${position} of ${count}${
      group === undefined ? "" : ` in ${group}`
    }`,
};

/** How far the pointer goes before a press on a handle becomes a drag. */
const START_PX = 4;
/** Past the slide's 150ms: a slide that sends no transitionend still ends. */
const SETTLE_MS = 200;

const dev = () => process.env.NODE_ENV !== "production";

// Literal, not built from shared strings: Tailwind only generates the classes
// it finds written out. The lifted row floats as a menu does, on the popover
// ground with its ring and hard shadow; under raymond it is the highlight, as
// a dragged list item is in Explorer, and nothing slides. A table row's
// fill goes on its cells too: TableRow's hover and raymond's unfilled rows
// outrank a fill on the row. A row's own transform would be overridden while
// it moves.
const ITEM =
  "data-lifted:relative data-lifted:z-10 data-lifted:bg-popover data-lifted:text-popover-foreground data-lifted:shadow-menu data-lifted:ring-1 data-lifted:ring-border data-lifted:[&>td]:bg-popover data-shifting:transition-transform data-shifting:duration-150 data-shifting:ease-out motion-reduce:data-shifting:transition-none touch:min-h-11 touch:[&:is(tr)]:h-11 raymond:data-lifted:bg-primary raymond:data-lifted:text-primary-foreground raymond:data-lifted:shadow-none raymond:data-lifted:ring-0 raymond:data-lifted:[--foreground:var(--primary-foreground)] raymond:data-lifted:[--muted-foreground:var(--primary-foreground)] raymond:data-lifted:[&>td]:bg-primary raymond:data-shifting:transition-none";

// No fill, border or padding of its own: the whole group slides over its
// neighbours while a row crosses it, and the frame is the List's or Table's.
const GROUP =
  "data-shifting:transition-transform data-shifting:duration-150 data-shifting:ease-out motion-reduce:data-shifting:transition-none data-has-lifted:relative data-has-lifted:z-10 raymond:data-shifting:transition-none";

// Under raymond the grip is a toolbar's: two raised bars, the icon dropped.
const HANDLE =
  "relative flex w-6 shrink-0 cursor-grab items-center justify-center self-stretch text-muted-foreground select-none touch-none [-webkit-touch-callout:none] not-data-disabled:hover:text-foreground in-data-lifted:cursor-grabbing in-data-lifted:text-foreground data-disabled:cursor-default data-disabled:opacity-50 [&_svg]:size-3.5 touch:w-11 raymond:w-3.5 raymond:touch:w-11 raymond:gap-px raymond:[&_svg]:hidden raymond:before:h-3 raymond:before:w-[3px] raymond:before:bg-(--3d-face) raymond:before:shadow-[inset_1px_1px_var(--3d-highlight),inset_-1px_-1px_var(--3d-shadow)] raymond:before:content-[''] raymond:after:h-3 raymond:after:w-[3px] raymond:after:bg-(--3d-face) raymond:after:shadow-[inset_1px_1px_var(--3d-highlight),inset_-1px_-1px_var(--3d-shadow)] raymond:after:content-['']";

// Under touch the two buttons stand 44px apart, centre to centre, so their
// hit areas do not overlap: the gap is what the style's button leaves of it.
const BUTTONS =
  "flex shrink-0 gap-0.5 touch:gap-[calc(44px-var(--spacing-control-xs))] raymond:gap-0 raymond:touch:gap-[calc(44px-var(--spacing-control-xs))]";

type Dir = -1 | 1;

interface Ability {
  /** In `items` or `groups`. */
  known: boolean;
  up: boolean;
  down: boolean;
  /** Its handle starts a drag. */
  drag: boolean;
}

const NOWHERE: Ability = { known: false, up: false, down: false, drag: false };

interface Rules {
  data: readonly ReorderPlaces[];
  /** Given `groups` rather than `items`. */
  grouped: boolean;
  onMove: (move: ReorderMove) => void;
  canMove?: (id: string) => boolean;
  canDrop?: ReorderCanDrop;
  canMoveUp?: (id: string) => boolean;
  canMoveDown?: (id: string) => boolean;
  disabled: boolean;
  labels: ReorderLabels;
}

function abilityOf(rules: Rules, id: string): Ability {
  if (!positionOf(rules.data, id)) return NOWHERE;
  if (rules.disabled || rules.canMove?.(id) === false)
    return { known: true, up: false, down: false, drag: false };
  const can = (dir: Dir, asked?: (id: string) => boolean) =>
    asked
      ? asked(id)
      : stepPlace(rules.data, id, dir, rules.canDrop) !== undefined;
  // Places other than its own: every other row's, plus one per group.
  const rows = rules.data.reduce((n, g) => n + g.items.length, 0);
  return {
    known: true,
    up: can(-1, rules.canMoveUp),
    down: can(1, rules.canMoveDown),
    drag: rows - 1 + rules.data.length > 1,
  };
}

/** The data's order, as one string, so a new array in the same order is no change. */
const orderKey = (data: readonly ReorderPlaces[]) =>
  JSON.stringify(data.map((g) => [g.id ?? null, g.items]));

const place = (group: string | undefined, index: number): ReorderPosition =>
  group === undefined ? { index } : { group, index };

/** A computed `transform`'s vertical offset: `matrix(…)`, `matrix3d(…)` or a bare `translateY(…px)`. */
function translateYOf(transform: string): number {
  const matrix = /^matrix(3d)?\((.+)\)$/.exec(transform.trim());
  if (matrix) {
    const values = matrix[2].split(",").map(Number);
    return (matrix[1] ? values[13] : values[5]) || 0;
  }
  const y = /translateY\((-?[\d.]+)px\)/.exec(transform);
  return y ? Number(y[1]) : 0;
}

const hasTransition = (el: HTMLElement) => {
  const style = getComputedStyle(el);
  return (
    style.transitionProperty !== "none" &&
    style.transitionDuration
      .split(",")
      .some((duration) => Number.parseFloat(duration) > 0)
  );
};

const isTextEntry = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT");

/** The browser clicks where a drag let go, which a row may take as opening it. */
function swallowNextClick(win: Window) {
  const swallow = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  win.addEventListener("click", swallow, { capture: true, once: true });
  // The click follows its pointerup within the same input task; a guard
  // still up after that would eat the next deliberate click.
  setTimeout(
    () => win.removeEventListener("click", swallow, { capture: true }),
    0,
  );
}

function mergeRefs<T>(
  ...refs: (React.Ref<T> | undefined)[]
): React.RefCallback<T> {
  return (value) => {
    const cleanups = refs.map((ref) => {
      if (typeof ref === "function") {
        const cleanup = ref(value);
        return typeof cleanup === "function" ? cleanup : () => ref(null);
      }
      if (ref) {
        ref.current = value;
        return () => {
          ref.current = null;
        };
      }
      return undefined;
    });
    return () => {
      for (const cleanup of cleanups) cleanup?.();
    };
  };
}

interface Registered {
  el: HTMLElement;
  name: string;
}

interface Pending {
  id: string;
  to: ReorderPosition;
  /** Where every row and group was drawn when the move was asked for. */
  first: Map<string, number>;
  kind: "press" | "drop";
  dir?: Dir;
  /** What held the focus in the row when a button or key was pressed. */
  held?: HTMLElement | null;
  /** The app took longer than a frame: the new order just appears. */
  late: boolean;
  frame: number;
}

/** A group's part in a drag, in the root's coordinates as it started. */
interface Zone {
  id?: string;
  /** Past this line the dragged row's middle is in the group. */
  headMid: number;
  /** The middles of its rows other than the dragged one. */
  mids: number[];
  /** Where its first place starts and its last ends. */
  top: number;
  bottom: number;
}

interface Drag {
  id: string;
  pointerId: number;
  handle: HTMLElement;
  /** The pointer's start, from the root's top. */
  startY: number;
  startClientY: number;
  clientY: number;
  started: boolean;
  unlisten: () => void;
  row?: HTMLElement;
  originGroup?: HTMLElement;
  data: readonly ReorderPlaces[];
  from: ReorderPosition;
  to: ReorderPosition;
  candidate: ReorderPosition;
  rowTop: number;
  rowHeight: number;
  /** How far a row moves to make room: the dragged row's height and the gap after it. */
  slot: number;
  zones: Zone[];
  min: number;
  max: number;
  frame?: number;
  cursor: string;
}

/**
 * What a `Reorder` keeps outside React: its rows' and groups' elements, the
 * move it asked for, the drag under way and the slide drawing. A drag writes
 * transforms and attributes straight on the elements, so nothing renders
 * while the pointer moves.
 */
class Engine {
  rules!: Rules;
  root: HTMLElement | null = null;
  readonly items = new Map<string, Registered>();
  readonly groups = new Map<string, Registered>();
  readonly buttons = new Map<
    string,
    { up?: HTMLButtonElement; down?: HTMLButtonElement }
  >();
  region: HTMLElement | null = null;
  key: string | undefined;
  pending: Pending | undefined;
  drag: Drag | undefined;
  settling: (() => void) | undefined;
  announcing = 0;
  warned = false;

  register(map: Map<string, Registered>, id: string, name: string) {
    return (el: HTMLElement | null) => {
      if (!el) return;
      const entry = { el, name };
      map.set(id, entry);
      return () => {
        if (map.get(id) === entry) map.delete(id);
      };
    };
  }

  registerButton(id: string, dir: Dir) {
    return (el: HTMLButtonElement | null) => {
      if (!el) return;
      const side = dir < 0 ? "up" : "down";
      const entry = this.buttons.get(id) ?? {};
      entry[side] = el;
      this.buttons.set(id, entry);
      return () => {
        if (entry[side] === el) delete entry[side];
        if (!entry.up && !entry.down && this.buttons.get(id) === entry)
          this.buttons.delete(id);
      };
    };
  }

  elements(): HTMLElement[] {
    return [
      ...[...this.groups.values()].map((g) => g.el),
      ...[...this.items.values()].map((i) => i.el),
    ];
  }

  /**
   * Where each group and row is drawn, by id: a row that moves to another
   * group is a new element there.
   */
  measure(): Map<string, number> {
    const tops = new Map<string, number>();
    for (const [id, { el }] of this.groups)
      tops.set(`group:${id}`, el.getBoundingClientRect().top);
    for (const [id, { el }] of this.items)
      tops.set(`item:${id}`, el.getBoundingClientRect().top);
    return tops;
  }

  /** The data changed: finish the move it answers, or drop what it overtook. */
  changed() {
    if (this.drag) this.endDrag(this.drag, "data");
    const pending = this.pending;
    if (!pending) return;
    this.pending = undefined;
    cancelAnimationFrame(pending.frame);
    const now = positionOf(this.rules.data, pending.id);
    if (!now || !samePlace(now, pending.to)) {
      if (pending.kind === "drop") this.reset();
      return;
    }
    if (!pending.late) {
      if (pending.kind === "drop") this.relift(pending.id);
      this.settle(pending.first);
    }
    this.restoreFocus(pending);
    this.announce(pending.id, now);
  }

  press(id: string, dir: Dir, held: HTMLElement | null) {
    if (this.drag?.started) return;
    const rules = this.rules;
    const ability = abilityOf(rules, id);
    if (!(dir < 0 ? ability.up : ability.down)) return;
    const to = stepPlace(rules.data, id, dir, rules.canDrop);
    if (!to) {
      if (dev() && !this.warned) {
        this.warned = true;
        console.warn(
          `Reorder: ${dir < 0 ? "canMoveUp" : "canMoveDown"} says "${id}" can move, but canDrop accepts no place that way.`,
        );
      }
      return;
    }
    this.request(id, to, "press", this.measure(), dir, held);
  }

  request(
    id: string,
    to: ReorderPosition,
    kind: Pending["kind"],
    first: Map<string, number>,
    dir?: Dir,
    held?: HTMLElement | null,
  ) {
    const from = positionOf(this.rules.data, id);
    if (!from) return;
    if (this.pending) cancelAnimationFrame(this.pending.frame);
    const pending: Pending = {
      id,
      to,
      first,
      kind,
      dir,
      held,
      late: false,
      frame: 0,
    };
    pending.frame = requestAnimationFrame(() => {
      pending.late = true;
      // Not taken in time: the dropped row goes back where it came from.
      if (pending.kind === "drop" && this.pending === pending) {
        this.pending = undefined;
        this.settle(pending.first);
      }
    });
    this.pending = pending;
    this.rules.onMove({ id, from, to });
  }

  /**
   * Slides every row and group from where it was drawn (`first`) to where it
   * now stands. A row inside a group that moves too takes only the
   * difference, both sliding together on one curve.
   */
  settle(first: Map<string, number>) {
    this.settling?.();
    for (const el of this.elements()) {
      el.style.removeProperty("transform");
      el.removeAttribute("data-shifting");
    }
    const last = this.measure();
    const shift = (key: string) => {
      const from = first.get(key);
      const to = last.get(key);
      return from === undefined || to === undefined ? undefined : from - to;
    };
    const moving: [HTMLElement, number][] = [];
    const groupShift = new Map<string, number>();
    for (const [id, group] of this.groups) {
      const by = shift(`group:${id}`) ?? 0;
      groupShift.set(id, by);
      if (Math.abs(by) > 0.5) moving.push([group.el, by]);
    }
    for (const group of this.rules.data) {
      const parent =
        group.id === undefined ? 0 : (groupShift.get(group.id) ?? 0);
      for (const id of group.items) {
        const el = this.items.get(id)?.el;
        const own = shift(`item:${id}`);
        if (!el || own === undefined) continue;
        const by = own - parent;
        if (Math.abs(by) > 0.5) moving.push([el, by]);
      }
    }
    for (const [el, by] of moving)
      el.style.setProperty("transform", `translateY(${by}px)`);
    // Lays the inverted places out before the slide toward none begins.
    if (moving.length > 0) this.root?.getBoundingClientRect();
    for (const [el] of moving) {
      el.setAttribute("data-shifting", "");
      el.style.removeProperty("transform");
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      clearTimeout(timer);
      for (const [el] of moving) el.removeAttribute("data-shifting");
      this.unlift();
      if (this.settling === finish) this.settling = undefined;
    };
    // Under reduced motion and raymond nothing slides: no wait.
    if (!moving.some(([el]) => hasTransition(el))) {
      finish();
      return;
    }
    timer = setTimeout(finish, SETTLE_MS);
    this.settling = finish;
  }

  /** Every row and group straight back where its layout puts it. */
  reset() {
    this.settling?.();
    for (const el of this.elements()) {
      el.style.removeProperty("transform");
      el.removeAttribute("data-shifting");
    }
    this.unlift();
  }

  /**
   * A row dropped into another group is a new element there: it stays lifted,
   * over the rest, until it has slid into place.
   */
  relift(id: string) {
    const row = this.items.get(id)?.el;
    if (!row || row.hasAttribute("data-lifted")) return;
    this.unlift();
    row.setAttribute("data-lifted", "");
    const group = positionOf(this.rules.data, id)?.group;
    if (group !== undefined)
      this.groups.get(group)?.el.setAttribute("data-has-lifted", "");
  }

  unlift() {
    for (const { el } of this.items.values()) el.removeAttribute("data-lifted");
    for (const { el } of this.groups.values())
      el.removeAttribute("data-has-lifted");
  }

  restoreFocus(pending: Pending) {
    if (pending.kind !== "press" || pending.dir === undefined) return;
    const row = this.items.get(pending.id)?.el;
    const usable = (el: HTMLElement | null | undefined): el is HTMLElement =>
      !!el &&
      el.isConnected &&
      !!row?.contains(el) &&
      !(el instanceof HTMLButtonElement && el.disabled);
    const { held } = pending;
    if (usable(held)) {
      if (held.ownerDocument.activeElement !== held) held.focus();
      return;
    }
    // The pressed button is disabled at the end it reached: the other one.
    const buttons = this.buttons.get(pending.id);
    const same = pending.dir < 0 ? buttons?.up : buttons?.down;
    const other = pending.dir < 0 ? buttons?.down : buttons?.up;
    if (usable(same)) same.focus();
    else if (usable(other)) other.focus();
  }

  announce(id: string, now: ReorderPosition) {
    const region = this.region;
    if (!region) return;
    const { data, grouped, labels } = this.rules;
    const count = data.find((g) => g.id === now.group)?.items.length ?? 0;
    const group =
      grouped && now.group !== undefined
        ? (this.groups.get(now.group)?.name ?? now.group)
        : undefined;
    const text = labels.moved(
      this.items.get(id)?.name ?? id,
      now.index + 1,
      count,
      group,
    );
    // Emptied first, so the same words twice running are read twice.
    region.textContent = "";
    cancelAnimationFrame(this.announcing);
    this.announcing = requestAnimationFrame(() => {
      region.textContent = text;
    });
  }

  grab(id: string, event: React.PointerEvent<HTMLElement>) {
    if (event.button !== 0 || !event.isPrimary || this.drag) return;
    const root = this.root;
    if (!root || !abilityOf(this.rules, id).drag) return;
    // No text selection and no focus move from the press.
    event.preventDefault();
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    try {
      handle.setPointerCapture(pointerId);
    } catch {
      // A pointer the browser no longer tracks: the moves still reach the handle.
    }
    const here = positionOf(this.rules.data, id) as ReorderPosition;
    const drag: Drag = {
      id,
      pointerId,
      handle,
      startY: event.clientY - root.getBoundingClientRect().top,
      startClientY: event.clientY,
      clientY: event.clientY,
      started: false,
      unlisten: () => {},
      data: this.rules.data,
      from: here,
      to: here,
      candidate: here,
      rowTop: 0,
      rowHeight: 0,
      slot: 0,
      zones: [],
      min: 0,
      max: 0,
      cursor: "",
    };
    const mine = (e: PointerEvent) => e.pointerId === pointerId;
    const move = (e: PointerEvent) => {
      if (!mine(e)) return;
      drag.clientY = e.clientY;
      if (!drag.started) {
        if (Math.abs(e.clientY - drag.startClientY) <= START_PX) return;
        if (!this.lift(drag)) return;
      }
      this.follow(drag);
    };
    const up = (e: PointerEvent) => {
      if (mine(e)) this.drop(drag);
    };
    const cancel = (e: PointerEvent) => {
      if (mine(e)) this.endDrag(drag, "cancel");
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", cancel);
    handle.addEventListener("lostpointercapture", cancel);
    drag.unlisten = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", cancel);
      handle.removeEventListener("lostpointercapture", cancel);
    };
    this.drag = drag;
  }

  /** Measures everything once and lifts the row; false when it cannot. */
  lift(drag: Drag): boolean {
    const root = this.root;
    const row = this.items.get(drag.id)?.el;
    if (!root || !row) {
      this.endDrag(drag, "cancel");
      return false;
    }
    // A slide still running would be measured halfway.
    this.settling?.();
    const { data } = drag;
    const rootTop = root.getBoundingClientRect().top;
    const box = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return { top: r.top - rootTop, bottom: r.bottom - rootTop };
    };
    const own = box(row);
    drag.row = row;
    drag.rowTop = own.top;
    drag.rowHeight = own.bottom - own.top;
    // The gap between rows, from the first pair there is; a ruled list's is 0.
    let gap = 0;
    for (const group of data) {
      const a = this.items.get(group.items[0])?.el;
      const b = this.items.get(group.items[1])?.el;
      if (a && b) {
        gap = box(b).top - box(a).bottom;
        break;
      }
    }
    drag.slot = drag.rowHeight + gap;
    drag.zones = data.map((group) => {
      const el =
        group.id === undefined ? undefined : this.groups.get(group.id)?.el;
      const frame = el ? box(el) : undefined;
      const rows = group.items.flatMap((id) => {
        const item = this.items.get(id)?.el;
        return item ? [{ id, ...box(item) }] : [];
      });
      const first = rows[0];
      const last = rows.at(-1);
      const mids = rows
        .filter((r) => r.id !== drag.id)
        .map((r) => (r.top + r.bottom) / 2);
      if (first && last) {
        return {
          id: group.id,
          headMid: frame ? (frame.top + first.top) / 2 : first.top,
          mids,
          top: first.top,
          bottom: last.bottom,
        };
      }
      // An empty group: the row lands over whatever it shows at its foot.
      const top = frame ? frame.top : 0;
      const bottom = frame ? frame.bottom : 0;
      return {
        id: group.id,
        headMid: (top + bottom) / 2,
        mids,
        top: Math.max(top, bottom - drag.rowHeight),
        bottom,
      };
    });
    drag.min = Math.min(...drag.zones.map((z) => z.top)) - own.top;
    drag.max = Math.max(...drag.zones.map((z) => z.bottom)) - own.bottom;
    drag.started = true;
    row.setAttribute("data-lifted", "");
    drag.originGroup =
      drag.from.group === undefined
        ? undefined
        : this.groups.get(drag.from.group)?.el;
    drag.originGroup?.setAttribute("data-has-lifted", "");
    for (const el of this.elements())
      if (el !== row) el.setAttribute("data-shifting", "");
    const html = root.ownerDocument.documentElement;
    drag.cursor = html.style.cursor;
    html.style.cursor = "grabbing";
    root.ownerDocument.defaultView?.addEventListener(
      "keydown",
      this.escape,
      true,
    );
    const frame = () => {
      drag.frame = requestAnimationFrame(frame);
      this.scroll(drag);
      this.follow(drag);
    };
    drag.frame = requestAnimationFrame(frame);
    return true;
  }

  /** Where the pointer puts the row: the place under its middle, and the room the rest make. */
  follow(drag: Drag) {
    const root = this.root;
    const row = drag.row;
    if (!root || !row || !drag.started) return;
    const y = drag.clientY - root.getBoundingClientRect().top;
    const dy = Math.min(drag.max, Math.max(drag.min, y - drag.startY));
    const mid = drag.rowTop + drag.rowHeight / 2 + dy;
    let at = 0;
    drag.zones.forEach((zone, i) => {
      if (i > 0 && mid >= zone.headMid) at = i;
    });
    const zone = drag.zones[at];
    // A tie goes the way the row travels: held at the last place, a row of
    // the last row's height has its middle exactly on that row's.
    const passed = (m: number) => (dy > 0 ? m <= mid : m < mid);
    const candidate = place(zone.id, zone.mids.filter(passed).length);
    if (!samePlace(candidate, drag.candidate)) {
      drag.candidate = candidate;
      const to = nearestPlace(
        drag.data,
        drag.id,
        candidate,
        this.rules.canDrop,
      );
      if (!samePlace(to, drag.to)) {
        drag.to = to;
        this.makeRoom(drag);
      }
    }
    // The row's own group may be sliding: take its offset away, so the row
    // stays under the pointer.
    const parent = drag.originGroup
      ? translateYOf(getComputedStyle(drag.originGroup).transform)
      : 0;
    row.style.setProperty("transform", `translateY(${dy - parent}px)`);
  }

  /**
   * Moving down, the target group rises a slot and its rows from the place on
   * sink one back; moving up, the origin group sinks a slot and its rows after
   * the dragged one rise one back.
   */
  makeRoom(drag: Drag) {
    const { data, from, to, slot } = drag;
    const shifts = new Map<HTMLElement, number>();
    const set = (el: HTMLElement | undefined, by: number) => {
      if (el) shifts.set(el, by);
    };
    const rows = (group: ReorderPlaces) =>
      group.items.filter((id) => id !== drag.id);
    const rowEl = (id: string) => this.items.get(id)?.el;
    const groupEl = (group: ReorderPlaces) =>
      group.id === undefined ? undefined : this.groups.get(group.id)?.el;
    const origin = data.findIndex((g) => g.id === from.group);
    const target = data.findIndex((g) => g.id === to.group);
    if (origin === target) {
      rows(data[origin]).forEach((id, i) => {
        if (to.index > from.index && i >= from.index && i < to.index)
          set(rowEl(id), -slot);
        if (to.index < from.index && i >= to.index && i < from.index)
          set(rowEl(id), slot);
      });
    } else if (target > origin) {
      rows(data[origin]).forEach((id, i) => {
        if (i >= from.index) set(rowEl(id), -slot);
      });
      for (let k = origin + 1; k <= target; k++) set(groupEl(data[k]), -slot);
      rows(data[target]).forEach((id, i) => {
        if (i >= to.index) set(rowEl(id), slot);
      });
    } else {
      set(groupEl(data[origin]), slot);
      rows(data[origin]).forEach((id, i) => {
        if (i >= from.index) set(rowEl(id), -slot);
      });
      for (let k = target + 1; k < origin; k++) set(groupEl(data[k]), slot);
      rows(data[target]).forEach((id, i) => {
        if (i >= to.index) set(rowEl(id), slot);
      });
    }
    for (const el of this.elements()) {
      if (el === drag.row) continue;
      const by = shifts.get(el);
      if (by) el.style.setProperty("transform", `translateY(${by}px)`);
      else el.style.removeProperty("transform");
    }
  }

  scroll(drag: Drag) {
    const root = this.root;
    if (!root) return;
    const scroller = scrollerOf(root);
    const { top, bottom } = scrollerEdges(root, scroller);
    const by = edgeScrollBy(drag.clientY, top, bottom);
    if (by === 0) return;
    if (scroller) scroller.scrollTop += by;
    else root.ownerDocument.defaultView?.scrollBy({ top: by });
  }

  drop(drag: Drag) {
    const started = drag.started;
    this.stopDrag(drag);
    if (!started) return;
    const win = this.root?.ownerDocument.defaultView;
    if (win) swallowNextClick(win);
    if (samePlace(drag.to, drag.from)) this.settle(this.measure());
    else this.request(drag.id, drag.to, "drop", this.measure());
  }

  /** A drag that ends with no move: everything back where it was. */
  endDrag(drag: Drag, why: "cancel" | "escape" | "data" | "unmount") {
    const started = drag.started;
    this.stopDrag(drag);
    if (!started) return;
    if (why === "cancel" || why === "escape") this.settle(this.measure());
    else if (why === "data") this.reset();
    if (why === "escape") {
      // The pointer is still down; its release clicks the handle.
      const win = drag.handle.ownerDocument.defaultView;
      const release = (e: PointerEvent) => {
        if (e.pointerId !== drag.pointerId) return;
        win?.removeEventListener("pointerup", release, true);
        if (win) swallowNextClick(win);
      };
      win?.addEventListener("pointerup", release, true);
    }
  }

  stopDrag(drag: Drag) {
    drag.unlisten();
    if (drag.frame !== undefined) cancelAnimationFrame(drag.frame);
    if (drag.started) {
      const doc = drag.handle.ownerDocument;
      doc.documentElement.style.cursor = drag.cursor;
      doc.defaultView?.removeEventListener("keydown", this.escape, true);
    }
    try {
      if (drag.handle.hasPointerCapture?.(drag.pointerId))
        drag.handle.releasePointerCapture(drag.pointerId);
    } catch {
      // Already released.
    }
    if (this.drag === drag) this.drag = undefined;
  }

  // Taken in the capture phase at the window, before a Dialog or Sheet around
  // the list hears it and closes.
  escape = (event: KeyboardEvent) => {
    const drag = this.drag;
    if (event.key !== "Escape" || !drag?.started) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.endDrag(drag, "escape");
  };

  destroy() {
    if (this.drag) this.endDrag(this.drag, "unmount");
    if (this.pending) cancelAnimationFrame(this.pending.frame);
    this.pending = undefined;
    cancelAnimationFrame(this.announcing);
    this.settling?.();
  }
}

interface RootContext {
  engine: Engine;
  ability: (id: string) => Ability;
  grouped: boolean;
  data: readonly ReorderPlaces[];
  labels: ReorderLabels;
}

const ReorderContext = React.createContext<RootContext | null>(null);

interface ItemContext {
  id: string;
  name: string;
  ability: Ability;
}

const ReorderItemContext = React.createContext<ItemContext | null>(null);

function useRoot(part: string): RootContext {
  const context = React.useContext(ReorderContext);
  if (!context) throw new Error(`${part} must be inside a Reorder.`);
  return context;
}

function useItem(part: string): ItemContext & { root: RootContext } {
  const root = useRoot(part);
  const item = React.useContext(ReorderItemContext);
  if (!item) throw new Error(`${part} must be inside a ReorderItem.`);
  return { ...item, root };
}

// Where the live region goes: not into the root, which may be a `tbody` or a
// `ul` that cannot hold a `span`, and not onto `body`, which a Dialog around
// the list hides from screen readers while it is open.
const NO_SPAN = /^(TABLE|THEAD|TBODY|TFOOT|TR|UL|OL)$/;

/**
 * A list ordered by hand: each row a `ReorderItem` holding a `ReorderHandle`
 * to drag it and `ReorderButtons` to move it one place up or down, or with
 * Alt+↑ / Alt+↓ from anywhere in the row. Give the rows' ids in `items`, or
 * in `groups` when rows sit under headings and move between them, each
 * group a `ReorderGroup`. The component changes no data: `onMove` hears one
 * move, which `moveItem` or `moveInGroups` applies, and the new order passed
 * back slides into place. Rows carry no `transform` of their own; a drag
 * overrides it while it lasts.
 */
function Reorder({
  items,
  groups,
  onMove,
  canMove,
  canDrop,
  canMoveUp,
  canMoveDown,
  disabled = false,
  labels,
  asChild = false,
  ref,
  ...props
}: ReorderProps) {
  const [engine] = React.useState(() => new Engine());
  const data = React.useMemo<readonly ReorderPlaces[]>(
    () => groups ?? [{ items: items ?? [] }],
    [groups, items],
  );
  const key = orderKey(data);
  const merged = { ...LABELS, ...labels };
  const rules: Rules = {
    data,
    grouped: groups !== undefined,
    onMove,
    canMove,
    canDrop,
    canMoveUp,
    canMoveDown,
    disabled,
    labels: merged,
  };
  const context: RootContext = {
    engine,
    ability: (id) => abilityOf(rules, id),
    grouped: rules.grouped,
    data,
    labels: merged,
  };

  // Runs before any handler can: the handlers read the rules from here.
  React.useLayoutEffect(() => {
    engine.rules = rules;
    if (engine.key === key) return;
    const changed = engine.key !== undefined;
    engine.key = key;
    if (changed) engine.changed();
  });

  React.useEffect(() => {
    if (!dev()) return;
    const ids = (JSON.parse(key) as [unknown, string[]][]).flatMap(
      ([, rows]) => rows,
    );
    const twice = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (twice.length > 0)
      console.error(
        `Reorder: ${twice.map((id) => `"${id}"`).join(", ")} stands in the order more than once.`,
      );
  }, [key]);

  React.useEffect(() => {
    const root = engine.root;
    let host = root?.parentElement ?? null;
    while (host && NO_SPAN.test(host.tagName)) host = host.parentElement;
    if (!root || !host) return;
    const region = root.ownerDocument.createElement("span");
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    region.className = "sr-only";
    host.append(region);
    engine.region = region;
    return () => {
      engine.destroy();
      region.remove();
      if (engine.region === region) engine.region = null;
    };
  }, [engine]);

  const rootRef = React.useMemo(
    () =>
      mergeRefs((el: HTMLElement | null) => {
        engine.root = el;
      }, ref),
    [engine, ref],
  );
  const Comp = asChild ? Slot.Root : "div";
  return (
    <ReorderContext.Provider value={context}>
      <Comp data-slot="reorder" ref={rootRef} {...props} />
    </ReorderContext.Provider>
  );
}

/**
 * A group of rows under its heading, in a `Reorder` given `groups`: it holds
 * the heading and the rows. `name` is what the move announcement calls it.
 * It draws no fill, border or padding; the frame around the groups is the
 * List's or the Table's. With `asChild` it is the caller's `section` or
 * `TableBody`.
 */
function ReorderGroup({
  id,
  name,
  asChild = false,
  className,
  ref,
  ...props
}: React.ComponentProps<"div"> & {
  id: string;
  name: string;
  asChild?: boolean;
}) {
  const root = useRoot("ReorderGroup");
  const { engine } = root;
  const register = React.useMemo(
    () => engine.register(engine.groups, id, name),
    [engine, id, name],
  );
  const known = root.data.some((g) => g.id === id);
  React.useEffect(() => {
    if (dev() && !known)
      console.error(
        `ReorderGroup: "${id}" is not one of the Reorder's groups.`,
      );
  }, [id, known]);
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      data-slot="reorder-group"
      ref={React.useMemo(() => mergeRefs(register, ref), [register, ref])}
      className={cn(GROUP, className)}
      {...props}
    />
  );
}

/**
 * A row. `id` is its id in the Reorder's `items` or `groups`; `name` is what
 * its buttons and the move announcement call it. With `asChild` it is the
 * caller's `li` or `TableRow`.
 */
function ReorderItem({
  id,
  name,
  asChild = false,
  className,
  onKeyDown,
  ref,
  ...props
}: React.ComponentProps<"div"> & {
  id: string;
  name: string;
  asChild?: boolean;
}) {
  const root = useRoot("ReorderItem");
  const { engine } = root;
  // Kept by value, so the row's parts render again only when it changes.
  const { known, up, down, drag } = root.ability(id);
  const register = React.useMemo(
    () => engine.register(engine.items, id, name),
    [engine, id, name],
  );
  React.useEffect(() => {
    if (dev() && !known)
      console.error(
        `ReorderItem: "${id}" is not in the Reorder's ${root.grouped ? "groups" : "items"}.`,
      );
  }, [id, known, root.grouped]);
  const context = React.useMemo(
    () => ({ id, name, ability: { known, up, down, drag } }),
    [id, name, known, up, down, drag],
  );
  const Comp = asChild ? Slot.Root : "div";
  return (
    <ReorderItemContext.Provider value={context}>
      <Comp
        data-slot="reorder-item"
        ref={React.useMemo(() => mergeRefs(register, ref), [register, ref])}
        className={cn(ITEM, className)}
        onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
          onKeyDown?.(event);
          if (
            event.defaultPrevented ||
            !event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            (event.key !== "ArrowUp" && event.key !== "ArrowDown") ||
            isTextEntry(event.target)
          )
            return;
          // The nearest row's, when one Reorder sits in another's row.
          event.preventDefault();
          event.stopPropagation();
          const active = event.currentTarget.ownerDocument.activeElement;
          engine.press(
            id,
            event.key === "ArrowUp" ? -1 : 1,
            active instanceof HTMLElement ? active : null,
          );
        }}
        {...props}
      />
    </ReorderItemContext.Provider>
  );
}

/**
 * The row's grip, for the pointer alone: a drag on it carries the row to any
 * place. Hidden from screen readers and no Tab stop; the buttons are
 * everyone's.
 */
function ReorderHandle({
  className,
  onPointerDown,
  ...props
}: Omit<React.ComponentProps<"span">, "children">) {
  const { id, ability, root } = useItem("ReorderHandle");
  return (
    <span
      data-slot="reorder-handle"
      aria-hidden="true"
      data-disabled={ability.drag ? undefined : ""}
      className={cn(HANDLE, className)}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (!event.defaultPrevented) root.engine.grab(id, event);
      }}
      {...props}
    >
      <GripVerticalIcon />
    </span>
  );
}

/** Spelt as the keyboard prints it; read only once a tooltip opens, so the server never asks. */
function MoveKeys({ dir }: { dir: Dir }) {
  const arrow = dir < 0 ? "↑" : "↓";
  return <Kbd>{isApplePlatform() ? `⌥${arrow}` : `Alt ${arrow}`}</Kbd>;
}

function MoveButton({ dir }: { dir: Dir }) {
  const { id, name, ability, root } = useItem("ReorderButtons");
  const label = dir < 0 ? root.labels.moveUp(name) : root.labels.moveDown(name);
  const register = React.useMemo(
    () => root.engine.registerButton(id, dir),
    [root.engine, id, dir],
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={register}
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          aria-keyshortcuts={dir < 0 ? "Alt+ArrowUp" : "Alt+ArrowDown"}
          disabled={!(dir < 0 ? ability.up : ability.down)}
          onClick={(event) => root.engine.press(id, dir, event.currentTarget)}
        >
          {dir < 0 ? <ArrowUpIcon /> : <ArrowDownIcon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label} <MoveKeys dir={dir} />
      </TooltipContent>
    </Tooltip>
  );
}

/** The row's pair of move buttons, each to the next place that direction that takes the row. */
function ReorderButtons({
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children">) {
  useItem("ReorderButtons");
  return (
    <span
      data-slot="reorder-buttons"
      className={cn(BUTTONS, className)}
      {...props}
    >
      <TooltipProvider>
        <MoveButton dir={-1} />
        <MoveButton dir={1} />
      </TooltipProvider>
    </span>
  );
}

export { Reorder, ReorderButtons, ReorderGroup, ReorderHandle, ReorderItem };

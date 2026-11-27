import * as React from "react";
import {
  OverflowStore,
  type PartMeta,
  type PlanInput,
} from "../overflow/store.ts";
import { outerWidth } from "../overflow/util.ts";
import { solveTabNav, type TabNavLayout, type TabNavPart } from "./solve.ts";

export interface TabNavMeta extends PartMeta {
  current: boolean;
  /** Its name for the ⋯'s while it is in the menu; empty to read its text. */
  name: string;
}

export interface TabNavResult extends TabNavLayout {
  /**
   * Its parent lays it out in a flex column, where a flex size would be its
   * height: only its width is set there.
   */
  column: boolean;
}

const EMPTY: TabNavResult = {
  views: {},
  overflow: [],
  breaks: [],
  more: false,
  currentFolded: false,
  currentName: null,
  full: 0,
  least: 0,
  column: false,
};

const px = (value: string) => Number.parseFloat(value) || 0;

/** Whether the box that lays `el` out is a flex column, past any `display: contents` between. */
function inColumn(el: HTMLElement): boolean {
  let parent = el.parentElement;
  while (parent && getComputedStyle(parent).display === "contents") {
    parent = parent.parentElement;
  }
  if (!parent) return false;
  const style = getComputedStyle(parent);
  return (
    style.display.includes("flex") && style.flexDirection.startsWith("column")
  );
}

let context: CanvasRenderingContext2D | null | undefined;

/** How wide `text` is in `el`'s font; `null` without a canvas to measure on. */
function textWidth(el: Element, text: string): number | null {
  if (context === undefined) {
    try {
      context = document.createElement("canvas").getContext("2d");
    } catch {
      context = null;
    }
  }
  if (!context) return null;
  const style = getComputedStyle(el);
  context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return context.measureText(text).width;
}

/**
 * A link's width with all its words, and, when it has words of its own to
 * cut short, its width with two letters of them and an ellipsis.
 */
function linkWidths(
  el: HTMLElement,
  view: string,
): { width: number; narrowest?: number } {
  const own = outerWidth(el);
  const words = [...el.children].find(
    (child) => child.getAttribute("data-slot") === "tab-nav-link-text",
  );
  if (!words) return { width: own };
  const shown = words.getBoundingClientRect().width;
  // Cut short, the words show less than they hold.
  const whole = view === "cut" ? Math.max(shown, words.scrollWidth) : shown;
  const width = own - shown + whole;
  const letters = [...(words.textContent ?? "").trim()];
  if (letters.length <= 2) return { width };
  const cut =
    textWidth(words, `${letters.slice(0, 2).join("")}…`) ??
    (whole * 3) / letters.length;
  return { width, narrowest: width - whole + Math.min(cut, whole) };
}

/**
 * One TabNav's links on the shared overflow layer: they fold from the end,
 * the current one cut short and then last, and the TabNav's own box is sized
 * from the two widths that measures, so it never resizes with what it has
 * folded.
 */
export class TabNavStore extends OverflowStore<TabNavMeta, TabNavResult> {
  /** Its widths are written: the box is sized from them. */
  measured = false;

  constructor() {
    super(EMPTY);
  }

  protected override available(): number {
    const row = this.row;
    if (!row) return 0;
    const style = getComputedStyle(row);
    return Math.floor(
      row.clientWidth - px(style.paddingLeft) - px(style.paddingRight),
    );
  }

  protected override plan({
    available,
    gap,
    children,
  }: PlanInput<TabNavMeta>): TabNavResult {
    const parts: TabNavPart[] = [];
    let currentName: string | null = null;
    for (const child of children) {
      if (child.hidden) continue;
      const { record, el } = child;
      if (!record) {
        parts.push({
          id: child.id,
          kind: "fixed",
          width: Math.ceil(outerWidth(el)),
        });
        continue;
      }
      const { width, narrowest } = linkWidths(el, child.view);
      parts.push({
        id: child.id,
        kind: "link",
        width: Math.ceil(width),
        current: record.meta.current,
        narrowest:
          record.meta.current && narrowest !== undefined
            ? Math.ceil(narrowest)
            : undefined,
      });
      if (record.meta.current && currentName === null) {
        currentName = record.meta.name || el.textContent?.trim() || null;
      }
    }
    const trigger = this.triggerRef.current;
    const layout = solveTabNav({
      available,
      triggerWidth: trigger ? Math.ceil(outerWidth(trigger)) : 0,
      parts,
      gap,
      currentName,
    });
    // Measured as nothing, it is out of sight: it keeps what it had.
    if (layout.full <= 0 || !this.row) return this.result;
    this.size(layout);
    return { ...layout, column: inColumn(this.row) };
  }

  protected override solved() {
    this.measured = true;
  }

  /**
   * Writes the box's two widths, its padding and border added: every link
   * laid out, and the least before the current one folds. Written on every
   * measure, as a style that changes the padding may change nothing else.
   */
  private size(layout: TabNavLayout) {
    const row = this.row;
    if (!row) return;
    const style = getComputedStyle(row);
    const chrome =
      px(style.paddingLeft) +
      px(style.paddingRight) +
      px(style.borderLeftWidth) +
      px(style.borderRightWidth);
    const write = (name: string, width: number) => {
      const value = `${width}px`;
      if (row.style.getPropertyValue(name) !== value) {
        row.style.setProperty(name, value);
      }
    };
    write("--tab-nav-full", layout.full + chrome);
    write("--tab-nav-least", layout.least + chrome);
  }
}

export const TabNavContext = React.createContext<TabNavStore | null>(null);

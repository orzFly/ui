import type { HexPane, HexSelection } from "./types.ts";

export interface NavigationInput {
  key: string;
  shift: boolean;
  /** Ctrl, or ⌘ on Apple platforms. */
  mod: boolean;
}

export interface NavigationLayout {
  columns: number;
  size: number;
  /** Rows a PageUp/PageDown moves. */
  pageRows: number;
  /** The highest offset the caret may reach. */
  maxOffset: number;
  /** Where the caret lands when there is no selection yet. */
  firstVisible: number;
  /** The pane a fresh selection is made in. */
  pane?: HexPane;
}

/**
 * The selection after `input`, `undefined` when the key is not a navigation
 * key, and the same object when the key changes nothing.
 */
export function navigate(
  selection: HexSelection | null,
  input: NavigationInput,
  layout: NavigationLayout,
): HexSelection | null | undefined {
  const { key, shift, mod } = input;
  const { columns, pageRows, maxOffset } = layout;
  if (maxOffset < 0) {
    return isNavigationKey(input) ? selection : undefined;
  }

  if (key === "Escape") return null;
  if (mod && (key === "a" || key === "A")) {
    const pane = selection?.pane ?? layout.pane ?? "hex";
    if (
      selection &&
      selection.anchor === 0 &&
      selection.focus === maxOffset &&
      selection.pane === pane
    ) {
      return selection;
    }
    return { anchor: 0, focus: maxOffset, pane };
  }

  const from = selection?.focus;
  let next: number;
  if (from === undefined) {
    if (!isMovementKey(key)) return undefined;
    next = layout.firstVisible;
  } else {
    const rowStart = from - (from % columns);
    switch (key) {
      case "ArrowLeft":
        next = from - 1;
        break;
      case "ArrowRight":
        next = from + 1;
        break;
      case "ArrowUp":
        next = from - columns < 0 ? from : from - columns;
        break;
      case "ArrowDown":
        next = from + columns > maxOffset ? from : from + columns;
        break;
      case "PageUp":
        next = from - pageRows * columns;
        if (next < 0) next = from % columns;
        break;
      case "PageDown": {
        next = from + pageRows * columns;
        if (next > maxOffset) {
          const lastRowStart = maxOffset - (maxOffset % columns);
          next = Math.min(lastRowStart + (from % columns), maxOffset);
        }
        break;
      }
      case "Home":
        next = mod ? 0 : rowStart;
        break;
      case "End":
        next = mod ? maxOffset : rowStart + columns - 1;
        break;
      default:
        return undefined;
    }
  }
  next = Math.min(Math.max(0, next), maxOffset);

  const pane = selection?.pane ?? layout.pane ?? "hex";
  const anchor = shift && selection ? selection.anchor : next;
  if (
    selection &&
    selection.anchor === anchor &&
    selection.focus === next &&
    selection.pane === pane
  ) {
    return selection;
  }
  return { anchor, focus: next, pane };
}

const MOVEMENT_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);

function isMovementKey(key: string): boolean {
  return MOVEMENT_KEYS.has(key);
}

function isNavigationKey({ key, mod }: NavigationInput): boolean {
  return (
    isMovementKey(key) ||
    key === "Escape" ||
    (mod && (key === "a" || key === "A"))
  );
}

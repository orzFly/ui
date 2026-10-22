export type HexPane = "hex" | "text";

export interface HexSelection {
  /** Where the selection started; inclusive byte offset into the source. */
  anchor: number;
  /** The caret: where it ends and where the keyboard moves from; inclusive. */
  focus: number;
  /** The pane it was made in: gets the focused colours, and decides the copy format. */
  pane: HexPane;
}

export type ControlCodes = "abbreviations" | "dots";

/** Equal field by field, so a field added later (an editing caret's nibble) counts too. */
export function sameSelection(
  a: HexSelection | null,
  b: HexSelection | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = Object.keys(a) as (keyof HexSelection)[];
  return (
    keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k])
  );
}

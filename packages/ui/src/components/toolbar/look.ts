/**
 * A toolbar's command under raymond: flat until the pointer raises it by one
 * pixel, sunk while held or while its menu is open, as Windows 2000's
 * toolbars are; one that stays on (`aria-pressed`) latched, sunk over a
 * dithered face.
 */
export const FLAT =
  "raymond:border-0 raymond:hover:bg-transparent raymond:hover:shadow-[inset_1px_1px_var(--3d-highlight),inset_-1px_-1px_var(--3d-shadow)] raymond:active:translate-y-0 raymond:active:shadow-[inset_1px_1px_var(--3d-shadow),inset_-1px_-1px_var(--3d-highlight)] raymond:aria-expanded:bg-transparent raymond:aria-expanded:shadow-[inset_1px_1px_var(--3d-shadow),inset_-1px_-1px_var(--3d-highlight)] raymond:aria-pressed:bg-(--3d-highlight) raymond:aria-pressed:bg-[conic-gradient(var(--3d-face)_25%,transparent_0_50%,var(--3d-face)_0_75%,transparent_0)] raymond:aria-pressed:bg-size-[2px_2px] raymond:aria-pressed:shadow-[inset_1px_1px_var(--3d-shadow),inset_-1px_-1px_var(--3d-highlight)]";

/**
 * A toggle of a `ToolbarGroup` with a `selection`, which Radix marks with
 * `data-state=on` (and a single choice with `aria-checked` rather than
 * `aria-pressed`): filled and ringed as a segmented control's pressed one,
 * latched under raymond.
 */
export const TOGGLE =
  "data-[state=on]:bg-muted data-[state=on]:text-foreground data-[state=on]:pressed-cue raymond:data-[state=on]:bg-(--3d-highlight) raymond:data-[state=on]:bg-[conic-gradient(var(--3d-face)_25%,transparent_0_50%,var(--3d-face)_0_75%,transparent_0)] raymond:data-[state=on]:bg-size-[2px_2px] raymond:data-[state=on]:shadow-[inset_1px_1px_var(--3d-shadow),inset_-1px_-1px_var(--3d-highlight)]";

export type ToolbarSize = "sm" | "default";

export const iconSize = (size: ToolbarSize) =>
  size === "sm" ? ("icon-sm" as const) : ("icon" as const);
export const textSize = (size: ToolbarSize) =>
  size === "sm" ? ("sm" as const) : ("default" as const);

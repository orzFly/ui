/**
 * A tab of a TabNav, a link or its ⋯. Under raymond the row is a links bar,
 * as Explorer's and Internet Explorer's are: flat buttons that rise a pixel
 * under the pointer, the current one latched, sunk a pixel over the face
 * dithered with its highlight, as Explorer's Folders button.
 */
export const TAB =
  "relative inline-flex min-h-control shrink-0 items-center gap-1.5 px-3 text-ui font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:focus-ring touch:hit-area data-current:text-foreground data-current:tab-line-cue [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5 raymond:self-center raymond:font-normal raymond:text-foreground raymond:transition-none raymond:[--tab-line-cue:inset_1px_1px_var(--3d-shadow),inset_-1px_-1px_var(--3d-highlight)] raymond:not-data-current:hover:shadow-[inset_1px_1px_var(--3d-highlight),inset_-1px_-1px_var(--3d-shadow)] raymond:not-data-current:active:shadow-[inset_1px_1px_var(--3d-shadow),inset_-1px_-1px_var(--3d-highlight)] raymond:data-current:bg-(--3d-highlight) raymond:data-current:bg-[conic-gradient(var(--3d-face)_25%,transparent_0_50%,var(--3d-face)_0_75%,transparent_0)] raymond:data-current:bg-size-[2px_2px]";

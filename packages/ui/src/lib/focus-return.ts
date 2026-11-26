// Keyed by the overlay's content element, which Radix dispatches both
// autofocus events on, so the pair needs no state in the component.
const openers = new WeakMap<EventTarget, HTMLElement>();

/**
 * For a modal overlay's `onOpenAutoFocus`: notes what had the focus before
 * the overlay takes it. Radix reads it too, but on close hands the focus only
 * to a `Trigger`, so an overlay opened by `open` alone — a row that opens a
 * viewer, a confirm before a delete — dropped it on `<body>` (UI-183).
 */
export function rememberOpener(event: Event): void {
  const content = event.currentTarget;
  if (content === null) return;
  // The overlay's own document, not this one: an overlay portalled into
  // another window (Picture-in-Picture, UI-231) was opened from there, while
  // this document names what last had the focus in this window, so returning
  // to that on close took the focus out of the window in use. That window's
  // elements are of its realm, which this realm's HTMLElement rejects.
  const owner = (content as Node).ownerDocument ?? document;
  const active = owner.activeElement;
  const view = owner.defaultView ?? window;
  if (active instanceof view.HTMLElement && active !== owner.body)
    openers.set(content, active);
}

/**
 * For the same overlay's `onCloseAutoFocus`: hands the focus back to what
 * `rememberOpener` noted. One that has left the page falls through to Radix,
 * which focuses the `Trigger` if there is one.
 */
export function returnToOpener(event: Event): void {
  if (event.currentTarget === null) return;
  const opener = openers.get(event.currentTarget);
  openers.delete(event.currentTarget);
  if (event.defaultPrevented || opener === undefined || !opener.isConnected)
    return;
  event.preventDefault();
  // A bare focus() scrolls the opener into view under the scroll-padding
  // useScrollInsets writes, as PopoverContent explains (T-388).
  opener.focus({ preventScroll: true });
}

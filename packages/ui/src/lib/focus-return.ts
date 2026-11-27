// Keyed by the overlay's content element, which Radix dispatches both
// autofocus events on, so the pair needs no state in the component.
const openers = new WeakMap<EventTarget, HTMLElement>();

// What can hold the focus, for finding the control a press landed in.
const FOCUSABLE =
  "a[href], area[href], button, input, select, textarea, summary, iframe, audio[controls], video[controls], [tabindex], [contenteditable]:not([contenteditable='false'])";

// Per document, the control the last press landed in, or null for a press
// on nothing that takes the focus; absent once the focus has moved on.
const presses = new WeakMap<Document, Element | null>();
const watched = new WeakSet<Document>();

function watchPresses(owner: Document): void {
  if (watched.has(owner)) return;
  watched.add(owner);
  owner.addEventListener(
    "pointerdown",
    (event) => {
      // No `instanceof`: another window's nodes are of its realm.
      const target = event.target as Partial<Element> | null;
      presses.set(owner, target?.closest?.(FOCUSABLE) ?? null);
    },
    { capture: true, passive: true },
  );
  owner.addEventListener(
    "focusin",
    (event) => {
      const pressed = presses.get(owner);
      // Safari hands a pressed button's focus to the nearest box around it
      // that takes the focus, a dialog's content, say, and the press still
      // names the control inside.
      const into = event.target as Partial<Node> | null;
      if (pressed != null && into?.contains?.(pressed)) return;
      presses.delete(owner);
    },
    true,
  );
}

// The press comes before any overlay is open to ask about it, and an app may
// mount the overlay only once it opens, so this window's document is watched
// from when an overlay is first imported.
if (typeof document !== "undefined") watchPresses(document);

/**
 * What opened an overlay. The focus names it when the press that opened it
 * took the focus, but Safari focuses neither a button nor a link it presses,
 * and no browser focuses an image, so the focus was on `<body>`, or on a box
 * around the control, and that is where it went back to (UI-249). The press
 * names the control then, unless the focus has moved on since.
 */
function openerIn(owner: Document, content: Node): Element | null {
  const active = owner.activeElement;
  const focused = active !== null && active !== owner.body ? active : null;
  const pressed = presses.get(owner);
  if (
    pressed?.isConnected &&
    !content.contains(pressed) &&
    (focused === null || focused.contains(pressed))
  )
    return pressed;
  return focused;
}

/**
 * For a modal overlay's `onOpenAutoFocus`: notes what opened it, before the
 * overlay takes the focus. Radix reads the focus too, but on close hands it
 * only to a `Trigger`, so an overlay opened by `open` alone — a row that
 * opens a viewer, a confirm before a delete — dropped it on `<body>`
 * (UI-183).
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
  // Another window's presses are watched from its first overlay on.
  watchPresses(owner);
  const opener = openerIn(owner, content as Node);
  const view = owner.defaultView ?? window;
  if (opener instanceof view.HTMLElement) openers.set(content, opener);
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

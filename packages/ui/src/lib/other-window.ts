import type * as React from "react";

/**
 * What a modal dialog needs in place of Radix when it is portalled into
 * another window's document, a Picture-in-Picture window or a frame (UI-232).
 * Radix reads the global `document` and this realm's `Node`, so there it
 * focused the dialog itself on open, let Tab walk out, never closed on a
 * press of the scrim, and locked this window's scrolling instead of that
 * one's.
 */

/** The document `container` is in, when it is not this one. */
export function otherDocument(
  container: Element | DocumentFragment | null | undefined,
): Document | null {
  if (container == null || typeof document === "undefined") return null;
  const owner = container.ownerDocument;
  return owner === document ? null : owner;
}

/**
 * Radix's tabbable candidates: what takes focus from Tab, in document order.
 * No `instanceof`: the nodes are of the other window's realm.
 */
function candidates(container: HTMLElement): HTMLElement[] {
  const nodes: HTMLElement[] = [];
  const walker = container.ownerDocument.createTreeWalker(
    container,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        const element = node as HTMLElement & { disabled?: boolean };
        const hiddenInput =
          element.tagName === "INPUT" &&
          (element as HTMLInputElement).type === "hidden";
        if (element.disabled || element.hidden || hiddenInput)
          return NodeFilter.FILTER_SKIP;
        return element.tabIndex >= 0
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      },
    },
  );
  while (walker.nextNode()) nodes.push(walker.currentNode as HTMLElement);
  return nodes;
}

function visible(element: HTMLElement): boolean {
  return element.checkVisibility?.({ checkVisibilityCSS: true }) ?? true;
}

function focus(element: HTMLElement, select: boolean) {
  const before = element.ownerDocument.activeElement;
  element.focus({ preventScroll: true });
  if (
    select &&
    element !== before &&
    element.tagName === "INPUT" &&
    typeof (element as HTMLInputElement).select === "function"
  )
    (element as HTMLInputElement).select();
}

/**
 * Radix's autofocus on open: the first candidate that takes the focus,
 * skipping links, its text selected; the dialog itself when none does.
 */
export function focusFirst(container: HTMLElement): void {
  const owner = container.ownerDocument;
  const before = owner.activeElement;
  for (const candidate of candidates(container)) {
    if (candidate.tagName === "A") continue;
    focus(candidate, true);
    if (owner.activeElement !== before) return;
  }
  container.focus({ preventScroll: true });
}

/**
 * For the dialog's `onKeyDown`: Tab past the last control comes round to
 * the first, Shift+Tab before the first to the last. Radix compares its
 * edges with this window's `document.activeElement`, which never names an
 * element of another document, so its loop never closed.
 */
export function loopTab(event: React.KeyboardEvent<HTMLElement>): void {
  if (
    event.key !== "Tab" ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.defaultPrevented ||
    event.nativeEvent.isComposing
  )
    return;
  const container = event.currentTarget;
  const focused = container.ownerDocument.activeElement;
  // A key from a layer the dialog opened bubbles here through React, but its
  // focus is that layer's to move.
  if (focused === null || !container.contains(focused)) return;
  const shown = candidates(container).filter(visible);
  const first = shown[0];
  const last = shown[shown.length - 1];
  if (first === undefined) {
    event.preventDefault();
    return;
  }
  if (
    event.shiftKey
      ? focused === first || focused === container
      : focused === last
  ) {
    event.preventDefault();
    focus(event.shiftKey ? last : first, true);
  }
}

/**
 * Radix's focus trap, in the dialog's own document: focus that lands
 * behind the dialog goes back to where it was inside. Behind is what Radix
 * hid from assistive technology when the dialog opened, marked
 * `data-aria-hidden`: a menu or popover the dialog opens afterwards is not
 * marked, and keeps the focus it takes.
 *
 * It also undoes a steal Radix makes there. Its trap focuses the dialog
 * itself whenever a node inside is removed while `document.activeElement` is
 * `document.body`, taken to mean the focused node was the one removed; but
 * that is this window's document, whose focus is on its body whenever
 * nothing here holds it, so a line removed from the dialog took the focus
 * off the field being typed in. A press on the dialog's own blank face still
 * focuses it, as it does here.
 */
function keepFocus(container: HTMLElement): () => void {
  const owner = container.ownerDocument;
  let last: HTMLElement | null = null;
  let pressing = false;
  const press = () => {
    pressing = true;
    setTimeout(() => {
      pressing = false;
    }, 0);
  };
  const focusIn = (event: FocusEvent) => {
    // Radix traps only while open, not through the closing animation.
    if (container.getAttribute("data-state") === "closed") return;
    const target = event.target as HTMLElement;
    if (container.contains(target)) {
      const from = event.relatedTarget as HTMLElement | null;
      if (
        target === container &&
        !pressing &&
        from !== null &&
        from !== container &&
        from.isConnected &&
        container.contains(from)
      ) {
        from.focus({ preventScroll: true });
        return;
      }
      last = target;
      return;
    }
    if (typeof target.closest !== "function") return;
    if (target.closest("[data-aria-hidden]") === null) return;
    if (last?.isConnected && container.contains(last))
      last.focus({ preventScroll: true });
    else focusFirst(container);
  };
  container.addEventListener("pointerdown", press, true);
  owner.addEventListener("focusin", focusIn);
  return () => {
    container.removeEventListener("pointerdown", press, true);
    owner.removeEventListener("focusin", focusIn);
  };
}

// Keyed by the dialog's content element, which Radix dispatches both
// autofocus events on, as `rememberOpener` keys its openers.
const keepers = new WeakMap<EventTarget, () => void>();

/** For `onOpenAutoFocus`: starts keeping the focus inside. */
export function holdFocus(event: Event): void {
  const content = event.currentTarget as HTMLElement | null;
  if (content === null) return;
  keepers.get(content)?.();
  keepers.set(content, keepFocus(content));
}

/** For `onCloseAutoFocus`: stops, before the focus is handed back. */
export function releaseFocus(event: Event): void {
  if (event.currentTarget === null) return;
  keepers.get(event.currentTarget)?.();
  keepers.delete(event.currentTarget);
}

const locks = new WeakMap<Document, { count: number; release: () => void }>();

/**
 * Locks `owner`'s own scrolling while a dialog covers it, counted, so the
 * last of several dialogs open there releases it.
 *
 * Only the root: the scrim and the dialog are fixed, so a wheel that runs
 * out over them goes to the viewport and never to a scroller of the page
 * behind. A classic scroll bar would leave with the overflow and widen the
 * page under the scrim, so its gutter stays where the root had one.
 */
export function lockScroll(owner: Document): () => void {
  const held = locks.get(owner);
  if (held !== undefined) held.count++;
  else {
    const root = owner.documentElement;
    const { overflow, scrollbarGutter } = root.style;
    const bar =
      owner.defaultView !== null &&
      owner.defaultView.innerWidth > root.clientWidth;
    root.style.overflow = "hidden";
    if (bar) root.style.scrollbarGutter = "stable";
    locks.set(owner, {
      count: 1,
      release() {
        root.style.overflow = overflow;
        root.style.scrollbarGutter = scrollbarGutter;
      },
    });
  }
  let released = false;
  return () => {
    const lock = locks.get(owner);
    if (released || lock === undefined) return;
    released = true;
    lock.count--;
    if (lock.count > 0) return;
    lock.release();
    locks.delete(owner);
  };
}

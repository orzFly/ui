import { useEffect, useRef } from "react";

/** Where `/` must not steal the keystroke: the reader is already typing. */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export interface SlashShortcutOptions {
  /**
   * Whether `/` is bound at all; defaults to `true`. WCAG 2.1.4 asks that a
   * single-character shortcut can be turned off — speech input fires stray
   * keys — so an app wires this to a keyboard-shortcuts setting.
   */
  enabled?: boolean;
}

/**
 * `/` reaches a search from anywhere on the page.
 *
 * Callers answer the key differently — a box takes focus, a collapsed toggle
 * has to appear first — but the rule for when the key is ours to take is the
 * same for all of them, and this is the one place it is written.
 */
export function useSlashShortcut(
  onSlash: () => void,
  { enabled = true }: SlashShortcutOptions = {},
): void {
  // A search box re-renders on every keystroke; the listener must not be
  // torn down and re-attached that often, so the callback goes in a ref.
  const slash = useRef(onSlash);
  useEffect(() => {
    slash.current = onSlash;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      slash.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}

import { useCallback, useSyncExternalStore } from "react";

/**
 * How the attachment viewer paints an image: what shows through its
 * transparent pixels, and whether a zoomed-in pixel stays a square.
 */
export type ImageLook = {
  background: "black" | "checker";
  smoothing: "smooth" | "pixelated";
};

// Checkerboard under the image only: an opaque image then looks the same as
// with no background at all, and a transparent one shows where it ends.
export const DEFAULT_IMAGE_LOOK: ImageLook = {
  background: "checker",
  smoothing: "smooth",
};

/** Parse a stored payload; an unknown or missing field falls back to its default. */
export function parseImageLook(raw: string | null): ImageLook {
  let parsed: unknown;
  try {
    parsed = raw === null ? null : JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const stored =
    typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  return {
    background:
      stored.background === "black" || stored.background === "checker"
        ? stored.background
        : DEFAULT_IMAGE_LOOK.background,
    smoothing:
      stored.smoothing === "smooth" || stored.smoothing === "pixelated"
        ? stored.smoothing
        : DEFAULT_IMAGE_LOOK.smoothing,
  };
}

// One cached value per key, shared by every hook reading it, so a choice made
// in one viewer is what the next one opens with.
const looks = new Map<string, ImageLook>();
const listeners = new Set<() => void>();

function read(key: string): ImageLook {
  let look = looks.get(key);
  if (look === undefined) {
    try {
      look = parseImageLook(localStorage.getItem(key));
    } catch {
      // Storage may be unavailable (private mode); the defaults still render.
      look = DEFAULT_IMAGE_LOOK;
    }
    looks.set(key, look);
  }
  return look;
}

function write(key: string, look: ImageLook) {
  looks.set(key, look);
  try {
    localStorage.setItem(key, JSON.stringify(look));
  } catch {
    // Unsaved, but this page still switches.
  }
  for (const listener of listeners) listener();
}

// Another tab's choice applies here too.
function onStorage(e: StorageEvent) {
  if (e.key === null || !looks.has(e.key)) return;
  looks.set(e.key, parseImageLook(e.newValue));
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

/**
 * The viewer's image look kept in localStorage under `storageKey`, following
 * other tabs. Hand the pair to the viewer as `imageLook` and
 * `onImageLookChange`. Name the key after the app; there is no default.
 */
export function useStoredImageLook(
  storageKey: string,
): [ImageLook, (look: ImageLook) => void] {
  const look = useSyncExternalStore(
    subscribe,
    () => read(storageKey),
    () => DEFAULT_IMAGE_LOOK,
  );
  const setLook = useCallback(
    (next: ImageLook) => write(storageKey, next),
    [storageKey],
  );
  return [look, setLook];
}

/** What a mounted `FileDrop` gives the store, read afresh at every event. */
export interface ZoneOptions {
  accept: string | undefined;
  disabled: boolean;
  onFile: (file: File) => void;
  onReject: ((file: File) => void) | undefined;
}

export type ZoneRef = { readonly current: ZoneOptions };

/** How a zone draws the drag: `ready` while a file is dragged anywhere in the window, `over` under the pointer. */
export type DragState = "ready" | "over" | undefined;

interface State {
  /** A drag carrying files is in the window. */
  active: boolean;
  /** The zone the pointer is over that would take the drop. */
  over: Element | null;
}

interface Dropped {
  file: File;
  directory: boolean;
}

const SLOT = '[data-slot="file-drop"]';

// While a drag is in the window the browser fires dragover every few hundred
// milliseconds, even when the pointer rests. A cancelled drag (Esc) that
// fires neither dragleave nor drop goes quiet; this long a silence ends it.
const STALE_MS = 1000;

const IDLE: State = { active: false, over: null };

const zones = new Map<Element, ZoneRef>();
const subscribers = new Set<() => void>();
let state = IDLE;
// The dragenters not yet matched by a dragleave. A new element's dragenter
// fires before the old one's dragleave, so it reaches 0 only when the drag
// leaves the window.
let depth = 0;
let stale: ReturnType<typeof setTimeout> | undefined;

function set(next: State) {
  if (next.active === state.active && next.over === state.over) return;
  state = next;
  for (const notify of subscribers) notify();
}

function reset() {
  depth = 0;
  clearTimeout(stale);
  set(IDLE);
}

function keepAlive() {
  clearTimeout(stale);
  stale = setTimeout(reset, STALE_MS);
}

const carriesFiles = (data: DataTransfer | null): data is DataTransfer =>
  data?.types.includes("Files") === true;

function elementOf(target: EventTarget | null): Element | null {
  if (!(target instanceof Node)) return null;
  return target instanceof Element ? target : target.parentElement;
}

/** Where the browser's own handling may be wanted: an editor that takes a dropped file itself, an `<input type=file>`. */
export function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * The innermost zone around `target`, and its options when this store holds
 * it; none for a zone another copy of the package drew, which its own store
 * answers for.
 */
function zoneAt(target: EventTarget | null) {
  const element = elementOf(target)?.closest(SLOT);
  if (!element) return null;
  return { element, zone: zones.get(element) };
}

/** Of the zones `test` matches (a chain, each inside the last), the innermost. */
function innermost(test: (element: Element) => boolean) {
  let found: [Element, ZoneRef] | undefined;
  for (const entry of zones) {
    if (test(entry[0]) && (!found || found[0].contains(entry[0])))
      found = entry;
  }
  return found;
}

/** Whether `<input accept>` would offer `file`: an extension, `type/*` or a whole MIME type. */
export function accepts(accept: string | undefined, file: File): boolean {
  const patterns = (accept ?? "")
    .split(",")
    .map((pattern) => pattern.trim().toLowerCase())
    .filter(Boolean);
  if (patterns.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return patterns.some((pattern) => {
    if (pattern.startsWith(".")) return name.endsWith(pattern);
    if (pattern.endsWith("/*")) return type.startsWith(pattern.slice(0, -1));
    return type === pattern;
  });
}

function filesOf(data: DataTransfer): Dropped[] {
  if (!data.items) {
    return Array.from(data.files, (file) => ({ file, directory: false }));
  }
  const dropped: Dropped[] = [];
  for (const item of Array.from(data.items)) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file) {
      dropped.push({
        file,
        directory: item.webkitGetAsEntry?.()?.isDirectory === true,
      });
    }
  }
  return dropped;
}

/** The first file `accept` takes; a folder never. */
const pick = (dropped: Dropped[], accept: string | undefined) =>
  dropped.find(({ file, directory }) => !directory && accepts(accept, file))
    ?.file;

/** Hands the zone the first file it takes, or else the first file to refuse. */
function take(options: ZoneOptions, dropped: Dropped[]) {
  const file = pick(dropped, options.accept);
  if (file) options.onFile(file);
  else if (dropped[0]) options.onReject?.(dropped[0].file);
}

function onDragEnter(event: DragEvent) {
  if (!carriesFiles(event.dataTransfer)) return;
  depth++;
  keepAlive();
  set({ ...state, active: true });
}

function onDragLeave(event: DragEvent) {
  if (!carriesFiles(event.dataTransfer)) return;
  depth = Math.max(0, depth - 1);
  if (depth === 0) reset();
}

// Captured, so a handler that stops the event further in cannot let the drag
// go stale while it is still in the window.
function onDragOverCapture(event: DragEvent) {
  if (carriesFiles(event.dataTransfer) && state.active) keepAlive();
}

// After every other handler: one that already prevented the default is an
// editor inside a zone taking the file itself, and the zone gives way.
function onDragOver(event: DragEvent) {
  const data = event.dataTransfer;
  if (!carriesFiles(data)) return;
  if (event.defaultPrevented) {
    set({ ...state, over: null });
    return;
  }
  const hit = zoneAt(event.target);
  if (hit && !hit.zone) return;
  if (hit?.zone && !hit.zone.current.disabled) {
    event.preventDefault();
    data.dropEffect = "copy";
    set({ ...state, over: hit.element });
    return;
  }
  set({ ...state, over: null });
  // A file let go anywhere else would replace the page with itself.
  if (hit || !isEditable(event.target)) {
    event.preventDefault();
    data.dropEffect = "none";
  }
}

function onDropCapture(event: DragEvent) {
  if (carriesFiles(event.dataTransfer)) reset();
}

function onDrop(event: DragEvent) {
  const data = event.dataTransfer;
  if (!carriesFiles(data) || event.defaultPrevented) return;
  const hit = zoneAt(event.target);
  if (hit && !hit.zone) return;
  if (hit?.zone && !hit.zone.current.disabled) {
    event.preventDefault();
    take(hit.zone.current, filesOf(data));
    return;
  }
  if (hit || !isEditable(event.target)) event.preventDefault();
}

// A paste goes only to the focused element, so the window hears it and
// decides from the page as it stands: no flag that could have gone stale.
function onPaste(event: ClipboardEvent) {
  const data = event.clipboardData;
  if (event.defaultPrevented || !data) return;
  const files = Array.from(data.files ?? []);
  if (files.length === 0) return;
  const focus = document.activeElement;
  const focused = innermost((zone) => focus !== null && zone.contains(focus));
  const hit = focused ?? innermost((zone) => zone.matches(":hover"));
  if (!hit || hit[1].current.disabled) return;
  const options = hit[1].current;
  // Text copied from a spreadsheet or a word processor often carries a
  // picture of itself; pasted into a field, the text is what was meant.
  const typing = isEditable(focus) && data.types.includes("text/plain");
  const dropped = files.map((file) => ({ file, directory: false }));
  const file = pick(dropped, options.accept);
  if (focused) {
    if (typing && !file) return;
    event.preventDefault();
    take(options, dropped);
    return;
  }
  // The pointer resting on a zone is no sign the paste was meant for it, so
  // it takes only a file it wants, and refuses nothing.
  if (typing || !file) return;
  event.preventDefault();
  options.onFile(file);
}

const LISTENERS = [
  ["dragenter", onDragEnter, true],
  ["dragleave", onDragLeave, true],
  ["dragover", onDragOverCapture, true],
  ["dragover", onDragOver, false],
  ["drop", onDropCapture, true],
  ["drop", onDrop, false],
  ["paste", onPaste, false],
] as const;

function listen(on: boolean) {
  for (const [type, listener, capture] of LISTENERS) {
    if (on) window.addEventListener(type, listener as EventListener, capture);
    else window.removeEventListener(type, listener as EventListener, capture);
  }
}

/** Puts a mounted zone in the store; the window is listened to while any zone is. */
export function register(element: Element, options: ZoneRef): () => void {
  if (zones.size === 0) listen(true);
  zones.set(element, options);
  return () => {
    if (zones.get(element) !== options) return;
    zones.delete(element);
    if (zones.size === 0) {
      listen(false);
      reset();
    } else if (state.over === element) {
      set({ ...state, over: null });
    }
  };
}

export function subscribe(notify: () => void) {
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
  };
}

/**
 * How `element` draws the drag. A zone in a subtree that takes no input (one
 * behind a modal dialog) is no place to drop, so it shows no `ready`.
 */
export function dragOf(element: Element | null, disabled: boolean): DragState {
  if (!element || disabled) return undefined;
  if (state.over === element) return "over";
  if (!state.active || element.closest('[inert], [aria-hidden="true"]'))
    return undefined;
  return "ready";
}

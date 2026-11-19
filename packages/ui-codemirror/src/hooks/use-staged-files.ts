import { useDirtySource } from "@orz/ui/lib/unsaved-guard";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  EditorFileStaging,
  StagingSurface,
} from "../components/markdown-editor.tsx";
import {
  resolveStagedTokens,
  STAGED_FILE_TYPE,
  stagedKeysIn,
  stagedOrdinal,
  stagedToken,
  stagedTokenDeletions,
  stagedTokenRanges,
  tokenInsertion,
} from "../extensions/staged-tokens.ts";

/** What an upload answers: where the file now is, and the name it settled on. */
export type StagedUpload = {
  url: string;
  /** The name the upload settled on, when it is not the file's own. */
  filename?: string;
};

export type StagedFile<U extends StagedUpload = StagedUpload> = {
  /** `<n>-<tag>`: the `n`th file of its editor, and a random tag. */
  key: string;
  file: File;
  /** The placeholder that puts it in the text. */
  token: string;
  /**
   * Set once a send got this file uploaded. A retry after another file of
   * the same send failed does not upload it again.
   */
  uploaded?: U;
};

export type UseStagedFilesOptions<U extends StagedUpload> = {
  /**
   * Upload one file. A rejection stops the send; its message, after the
   * file's name, is the error `resolve` throws.
   */
  upload: (file: File) => Promise<U>;
  /**
   * An upload the text no longer links: its placeholder was deleted after
   * an earlier send got it up, or the text was discarded, or the editor
   * went away unsent. Delete a draft here, say. Not awaited.
   */
  withdraw?: (uploaded: U, file: File) => void;
  /** Whether a file goes in as an image (`![…]`). Default: an `image/` type. */
  isImage?: (file: File) => boolean;
};

/** What `useStagedFiles` hands its caller: the files, and the ways in and out. */
export type StagedFiles<U extends StagedUpload = StagedUpload> = {
  /** The staged files the text places, in staging order. */
  staged: StagedFile<U>[];
  /** For `<MarkdownEditor staging={…}>`; one identity for the hook's life. */
  editor: EditorFileStaging;
  /**
   * Stage files and place their placeholders: at `at`, else where the
   * reader left the caret, else at the end. `false` when there were no
   * files or no editor to place them in.
   */
  stage: (
    files: Iterable<File>,
    opts?: { fromClipboard?: boolean; at?: { from: number; to: number } },
  ) => boolean;
  /** Take a file out of the text: every placeholder of it goes. */
  remove: (key: string) => void;
  /** Whether sending `text` needs `resolve` first. */
  pending: (text: string) => boolean;
  /**
   * Upload the files `text` places and return it with their placeholders
   * pointing at the uploads. Throws on the first failure, the message
   * leading with the file's name.
   */
  resolve: (text: string) => Promise<string>;
  /** Forget the files after the text that links them was sent. */
  clear: () => void;
  /** Forget the files because the text is being abandoned: withdraw uploads. */
  discard: () => void;
};

/** Every key given out on this page, so no two of its editors share one. */
const pageKeys = new Set<string>();

/**
 * A new key for an editor's `n`th file. Four random letters and digits
 * tell it from another tab's or visit's `n`, and on this page are drawn
 * again until no other editor's file has them.
 */
function newKey(ordinal: number): string {
  for (let draw = 0; draw < 16; draw += 1) {
    const tag = Math.random().toString(36).slice(2, 6).padEnd(4, "0");
    const key = `${ordinal}-${tag}`;
    if (!pageKeys.has(key)) {
      pageKeys.add(key);
      return key;
    }
  }
  // A random source that keeps repeating itself (a stubbed one, say): a
  // five-character tag counted from the page's keys, which no four-character
  // draw can match.
  const key = `${ordinal}-${pageKeys.size.toString(36).padStart(5, "0")}`;
  pageKeys.add(key);
  return key;
}

/**
 * Past this an `n` in a text is not a count anyone made, and counting on
 * from it would spell the next one in exponent notation.
 */
const MAX_ORDINAL = 1_000_000;

/** This page load, so a drag from another tab is told apart. */
const PAGE = Math.random().toString(36).slice(2);

/** Every file staged on this page, so another editor can take one over. */
const pageFiles = new Map<string, File>();

/** What a staged file's drag carries under `STAGED_FILE_TYPE`. */
type StagedDrag = { page: string; key: string };

function stagedDragOf(data: string): StagedDrag | null {
  try {
    const value: unknown = JSON.parse(data);
    if (
      typeof value === "object" &&
      value !== null &&
      "page" in value &&
      "key" in value &&
      typeof value.page === "string" &&
      typeof value.key === "string"
    ) {
      return { page: value.page, key: value.key };
    }
  } catch {}
  return null;
}

/**
 * Props that make an element (a staged file's thumbnail) drag that file:
 * into its own editor to place it once more, or into another editor on the
 * page, which stages it too under a key of its own. The drag carries no
 * text, so a title field or another app does not take the placeholder for
 * words to paste, and an editor in another tab ignores it.
 */
export function stagedFileDrag(key: string): {
  draggable: true;
  onDragStart: (event: { dataTransfer: DataTransfer }) => void;
} {
  const drag: StagedDrag = { page: PAGE, key };
  return {
    draggable: true,
    onDragStart: (event) => {
      event.dataTransfer.setData(STAGED_FILE_TYPE, JSON.stringify(drag));
      event.dataTransfer.effectAllowed = "copy";
    },
  };
}

/** Every browser names a pasted screenshot `image.png`. */
const CLIPBOARD_DEFAULT = /^image\.(png|jpe?g|gif|webp|bmp|tiff?|avif)$/i;

const pad = (n: number, width: number) => String(n).padStart(width, "0");

/**
 * A pasted screenshot renamed `image-20260905-214530-a3f9.png`, in the
 * reader's own time zone, so a text that collects a few does not hold a
 * column of identical names. Settled here, before the upload, so the
 * placeholder, the request and the sent text all say the same thing. A real
 * file copied out of a file manager keeps its name.
 */
function renameIfClipboardDefault(file: File): File {
  if (!CLIPBOARD_DEFAULT.test(file.name)) return file;
  const ext = file.name.slice(file.name.lastIndexOf("."));
  const at = new Date();
  const stamp =
    `${at.getFullYear()}${pad(at.getMonth() + 1, 2)}${pad(at.getDate(), 2)}` +
    `-${pad(at.getHours(), 2)}${pad(at.getMinutes(), 2)}${pad(at.getSeconds(), 2)}`;
  const rand = [...crypto.getRandomValues(new Uint8Array(2))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return new File([file], `image-${stamp}-${rand}${ext}`, { type: file.type });
}

const imageType = (file: File) => file.type.startsWith("image/");

function sameKeys(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((key) => b.has(key));
}

/**
 * Files staged in a `MarkdownEditor` until the text is sent. A pasted,
 * dropped or picked file goes into the text as a placeholder where the
 * reader put it, and the text is the record: `staged` lists the files it
 * places, deleting a placeholder takes its file out, and undo brings it
 * back. Nothing is uploaded until `resolve`, which the send calls; uploading
 * is the caller's `upload`. Leaving with a file staged counts as unsaved
 * work.
 */
export function useStagedFiles<U extends StagedUpload = StagedUpload>(
  options: UseStagedFilesOptions<U>,
): StagedFiles<U> {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  // Every file staged since mount or the last clear, placed or not: undo can
  // bring a deleted placeholder back. The ref is the record and the state
  // mirrors it for rendering, so a read straight after a write sees it.
  const [all, setAll] = useState<StagedFile<U>[]>([]);
  const allRef = useRef<StagedFile<U>[]>([]);
  const [referenced, setReferenced] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const referencedRef = useRef<ReadonlySet<string>>(new Set());
  const surfaceRef = useRef<StagingSurface | null>(null);
  // Whether the reader has pressed or typed in the editor since it bound: the
  // caret `autoFocus` leaves at 0 is not one they put there.
  const touchedRef = useRef(false);
  const unbindRef = useRef<(() => void) | null>(null);
  // The next file's `n`: counted from 1 in this editor, and past every `n`
  // its text already holds, so two files of one editor never share one.
  const nextOrdinal = useRef(1);

  const staged = useMemo(
    () => all.filter((item) => referenced.has(item.key)),
    [all, referenced],
  );

  function commit(next: StagedFile<U>[]) {
    allRef.current = next;
    setAll(next);
  }

  function setReferencedKeys(keys: ReadonlySet<string>) {
    if (sameKeys(keys, referencedRef.current)) return;
    referencedRef.current = keys;
    setReferenced(keys);
  }

  function withdraw(item: StagedFile<U>) {
    if (item.uploaded !== undefined) {
      optionsRef.current.withdraw?.(item.uploaded, item.file);
    }
  }

  function forgetUpload({ uploaded: _uploaded, ...item }: StagedFile<U>) {
    return item;
  }

  // Nothing has been sent while a file is staged, so leaving drops it.
  useDirtySource(() => staged.length > 0);

  // An editor unmounting with uploaded files is one whose text was left
  // unsent, the guard having let the reader go.
  // biome-ignore lint/correctness/useExhaustiveDependencies: unmount-only; it reads the refs.
  useEffect(
    () => () => {
      unbindRef.current?.();
      for (const item of allRef.current) {
        withdraw(item);
        pageFiles.delete(item.key);
      }
    },
    [],
  );

  function knows(key: string): boolean {
    return allRef.current.some((item) => item.key === key);
  }

  /** Move the count past every `n` that `doc` already holds. */
  function countPast(doc: string) {
    for (const { key } of stagedTokenRanges(doc, () => true)) {
      const ordinal = stagedOrdinal(key);
      if (ordinal < MAX_ORDINAL && ordinal >= nextOrdinal.current) {
        nextOrdinal.current = ordinal + 1;
      }
    }
  }

  function sync(doc: string) {
    countPast(doc);
    setReferencedKeys(new Set(stagedKeysIn(doc, knows)));
  }

  function bind(surface: StagingSurface | null) {
    unbindRef.current?.();
    unbindRef.current = null;
    surfaceRef.current = surface;
    touchedRef.current = false;
    if (surface === null) return;
    const touch = () => {
      touchedRef.current = true;
    };
    const controller = new AbortController();
    const listen = { capture: true, signal: controller.signal };
    surface.dom.addEventListener("pointerdown", touch, listen);
    surface.dom.addEventListener("keydown", touch, listen);
    unbindRef.current = () => controller.abort();
    sync(surface.doc());
  }

  /** Put `tokens` in at `at`, by the placement rules of `tokenInsertion`. */
  function place(
    surface: StagingSurface,
    tokens: string[],
    at: { from: number; to: number },
    userEvent: string,
  ) {
    const change = tokenInsertion(surface.doc(), at.from, at.to, tokens);
    surface.change({
      changes: [{ from: change.from, to: change.to, insert: change.insert }],
      cursor: change.cursor,
      userEvent,
    });
  }

  function stage(
    files: Iterable<File>,
    opts?: { fromClipboard?: boolean; at?: { from: number; to: number } },
  ): boolean {
    const surface = surfaceRef.current;
    const list = [...files].map((file) =>
      opts?.fromClipboard === true ? renameIfClipboardDefault(file) : file,
    );
    if (list.length === 0 || surface === null) return false;
    const isImage = optionsRef.current.isImage ?? imageType;
    const added = list.map((file): StagedFile<U> => {
      const key = newKey(nextOrdinal.current++);
      pageFiles.set(key, file);
      return { key, file, token: stagedToken(key, file.name, isImage(file)) };
    });
    // Before the change, whose sync has to recognise the new placeholders.
    commit([...allRef.current, ...added]);
    const end = surface.doc().length;
    place(
      surface,
      added.map((item) => item.token),
      opts?.at ??
        (touchedRef.current ? surface.selection() : { from: end, to: end }),
      opts?.fromClipboard === true
        ? "input.paste"
        : opts?.at !== undefined
          ? "input.drop"
          : "input",
    );
    return true;
  }

  function paste(event: ClipboardEvent, surface: StagingSurface) {
    const { from, to } = surface.selection();
    if (
      stage(event.clipboardData?.files ?? [], {
        fromClipboard: true,
        at: { from, to },
      })
    ) {
      event.preventDefault();
    }
  }

  function drop(event: DragEvent, surface: StagingSurface): boolean {
    const dropPoint = () => {
      const at =
        surface.posAtCoords(event.clientX, event.clientY) ??
        surface.selection().head;
      return { from: at, to: at };
    };
    const files = event.dataTransfer?.files;
    if (files !== undefined && files.length > 0) {
      event.preventDefault();
      stage(files, { at: dropPoint() });
      return true;
    }
    const data = event.dataTransfer?.getData(STAGED_FILE_TYPE) ?? "";
    // Other text is the editor's own to drop.
    if (data === "") return false;
    event.preventDefault();
    const dragged = stagedDragOf(data);
    // From another tab, whose files are not here to take: nothing.
    if (dragged === null || dragged.page !== PAGE) return true;
    const own = allRef.current.find((item) => item.key === dragged.key);
    if (own !== undefined) {
      // Placed once more where the reader let go, by the same rules as a
      // file dropped in: never inside code, a link or a word.
      place(surface, [own.token], dropPoint(), "input.drop");
      return true;
    }
    // Another editor's file: staged here too, under a key of its own.
    const file = pageFiles.get(dragged.key);
    if (file !== undefined) stage([file], { at: dropPoint() });
    return true;
  }

  function dragOver(event: DragEvent) {
    const types = event.dataTransfer?.types ?? [];
    // Without this the browser navigates to a dropped file, and refuses a
    // staged file's drag that carries only its own type.
    if (types.includes("Files") || types.includes(STAGED_FILE_TYPE)) {
      event.preventDefault();
    }
  }

  function remove(key: string) {
    const hit = allRef.current.find((item) => item.key === key);
    if (hit === undefined) return;
    // Withdrawn and forgotten together: undo can bring the placeholder back,
    // and the next resolve must then upload the file again, not link an
    // upload that is gone.
    if (hit.uploaded !== undefined) {
      withdraw(hit);
      commit(
        allRef.current.map((item) =>
          item.key === key ? forgetUpload(item) : item,
        ),
      );
    }
    const surface = surfaceRef.current;
    if (surface === null) {
      setReferencedKeys(
        new Set([...referencedRef.current].filter((k) => k !== key)),
      );
      return;
    }
    const deletions = stagedTokenDeletions(surface.doc(), knows, key);
    if (deletions.length > 0) {
      surface.change({ changes: deletions, userEvent: "delete" });
    }
  }

  function pending(text: string): boolean {
    return (
      stagedKeysIn(text, knows).length > 0 ||
      allRef.current.some((item) => item.uploaded !== undefined)
    );
  }

  async function resolve(text: string): Promise<string> {
    const keys = stagedKeysIn(text, knows);
    for (const key of keys) {
      const item = allRef.current.find((p) => p.key === key);
      if (item === undefined || item.uploaded !== undefined) continue;
      let uploaded: U;
      try {
        uploaded = await optionsRef.current.upload(item.file);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${item.file.name}: ${message}`);
      }
      commit(
        allRef.current.map((p) => (p.key === key ? { ...p, uploaded } : p)),
      );
    }
    // An upload the text no longer places, its placeholder deleted after an
    // earlier attempt got it up, would be a file nothing links.
    const orphans = allRef.current.filter(
      (item) => item.uploaded !== undefined && !keys.includes(item.key),
    );
    for (const item of orphans) withdraw(item);
    if (orphans.length > 0) {
      commit(
        allRef.current.map((item) =>
          orphans.includes(item) ? forgetUpload(item) : item,
        ),
      );
    }
    const resolved = new Map<
      string,
      { url: string; filename: string; insertedName: string }
    >();
    for (const item of allRef.current) {
      if (item.uploaded === undefined) continue;
      resolved.set(item.key, {
        url: item.uploaded.url,
        filename: item.uploaded.filename ?? item.file.name,
        insertedName: item.file.name,
      });
    }
    return resolveStagedTokens(text, resolved);
  }

  function clear() {
    // Synchronously, not at the next render: these files belong to a text
    // that was just sent, and an unmount before that render would read the
    // old list and withdraw them.
    for (const item of allRef.current) pageFiles.delete(item.key);
    commit([]);
    setReferencedKeys(new Set());
    // The next text counts its files from 1 again, past whatever the editor
    // still holds; its tags keep them apart from the ones just sent.
    nextOrdinal.current = 1;
    const surface = surfaceRef.current;
    if (surface !== null) countPast(surface.doc());
  }

  function discard() {
    for (const item of allRef.current) withdraw(item);
    clear();
  }

  // The editor keeps one object for its life; it reaches today's functions
  // through this ref.
  const latest = useRef({ bind, sync, knows, paste, drop, dragOver });
  latest.current = { bind, sync, knows, paste, drop, dragOver };
  const [editor] = useState<EditorFileStaging>(() => ({
    bind: (surface) => latest.current.bind(surface),
    sync: (doc) => latest.current.sync(doc),
    knows: (key) => latest.current.knows(key),
    paste: (event, surface) => latest.current.paste(event, surface),
    drop: (event, surface) => latest.current.drop(event, surface),
    dragOver: (event) => latest.current.dragOver(event),
  }));

  return { staged, editor, stage, remove, pending, resolve, clear, discard };
}

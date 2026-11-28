import { createEvent, fireEvent } from "@testing-library/react";

/**
 * What a drag or a paste carries, as far as a tree and a file drop read and
 * write it: strings by type, and files, one of which may be a folder.
 */
export class FakeDataTransfer {
  readonly data = new Map<string, string>();
  readonly #files: { file: File; directory: boolean }[] = [];
  effectAllowed = "uninitialized";
  dropEffect = "none";
  image: Element | undefined;

  get types() {
    const types = [...this.data.keys()];
    return this.#files.length > 0 ? [...types, "Files"] : types;
  }
  get files() {
    return this.#files.map(({ file }) => file);
  }
  /** A string item per type, then a file item per file, as a browser lists them. */
  get items() {
    return [
      ...[...this.data.keys()].map((type) => ({
        kind: "string",
        type,
        getAsFile: () => null,
        webkitGetAsEntry: () => null,
      })),
      ...this.#files.map(({ file, directory }) => ({
        kind: "file",
        type: file.type,
        getAsFile: () => file,
        webkitGetAsEntry: () => ({ isDirectory: directory }),
      })),
    ];
  }
  setData(type: string, value: string) {
    this.data.set(type, value);
  }
  getData(type: string) {
    return this.data.get(type) ?? "";
  }
  setDragImage(image: Element) {
    this.image = image;
  }
  addFile(file: File, { directory = false }: { directory?: boolean } = {}) {
    this.#files.push({ file, directory });
    return this;
  }
}

type DragType =
  | "dragStart"
  | "dragEnter"
  | "dragOver"
  | "dragLeave"
  | "drop"
  | "dragEnd";

/**
 * Fires a drag event carrying `data`, which happy-dom's own DataTransfer
 * would replace; false when a handler prevented its default.
 */
export function fireDrag(
  type: DragType,
  el: Element,
  data: FakeDataTransfer,
  init: { clientY?: number; relatedTarget?: Element | null } = {},
) {
  const event = createEvent[type](el, init);
  Object.defineProperty(event, "dataTransfer", { value: data });
  for (const [key, value] of Object.entries(init))
    Object.defineProperty(event, key, { value });
  return fireEvent(el, event);
}

/** Fires a paste of `data` at `el`; false when a handler prevented its default. */
export function firePaste(el: Element, data: FakeDataTransfer) {
  const event = createEvent.paste(el);
  Object.defineProperty(event, "clipboardData", { value: data });
  return fireEvent(el, event);
}

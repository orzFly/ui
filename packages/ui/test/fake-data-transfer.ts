import { createEvent, fireEvent } from "@testing-library/react";

/** What a drag carries, as far as a tree reads and writes it. */
export class FakeDataTransfer {
  readonly data = new Map<string, string>();
  effectAllowed = "uninitialized";
  dropEffect = "none";
  image: Element | undefined;

  get types() {
    return [...this.data.keys()];
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
}

type DragType = "dragStart" | "dragOver" | "dragLeave" | "drop" | "dragEnd";

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

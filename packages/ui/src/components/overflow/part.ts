import * as React from "react";
import {
  measureOuter,
  type OverflowResult,
  type OverflowStore,
  type PartMeasure,
  type PartMeta,
  type PartRecord,
} from "./store.ts";

export interface OverflowPartOptions<
  M extends PartMeta,
  X extends PartMeasure = PartMeasure,
> {
  store: OverflowStore<M, OverflowResult, X> | null;
  /** `false`: outside a row, drawn in the menu, or inside another part. */
  enabled: boolean;
  /** The component's own kind of part; `"unit"` by default. */
  kind?: string;
  meta: M;
  /** Its widths in a view; the element's outer width and height by default. */
  measure?(view: string, el: HTMLElement): X;
}

export interface OverflowPart {
  id: string;
  /** Written in and laid out by its row. */
  registered: boolean;
  /** `"bar"` when not registered. */
  view: string;
  ref: (el: HTMLElement | null) => void;
}

const noSubscribe = () => () => {};
const bar = () => "bar";

/** Writes a part into its row and reads back where it stands. */
export function useOverflowPart<
  M extends PartMeta,
  X extends PartMeasure = PartMeasure,
>(options: OverflowPartOptions<M, X>): OverflowPart {
  const { store } = options;
  const registered = store !== null && options.enabled;
  const id = React.useId();
  const el = React.useRef<HTMLElement | null>(null);
  const latest = React.useRef(options);
  latest.current = options;

  const record = React.useRef<PartRecord<M, X> | null>(null);
  if (record.current === null) {
    record.current = {
      id,
      kind: options.kind ?? "unit",
      el: null,
      meta: options.meta,
      measure: (view, node) =>
        latest.current.measure?.(view, node) ?? (measureOuter(view, node) as X),
    };
  }

  const view = React.useSyncExternalStore(
    registered && store ? store.subscribe : noSubscribe,
    registered && store ? () => store.viewOf(id) : bar,
    bar,
  );

  React.useLayoutEffect(() => {
    if (!registered || !store || !record.current) return;
    record.current.el = el.current;
    store.register(record.current);
    return () => store.unregister(id);
  }, [registered, store, id]);

  React.useLayoutEffect(() => {
    if (registered && store) store.update(id, options.meta);
  });

  const ref = React.useCallback(
    (node: HTMLElement | null) => {
      el.current = node;
      if (record.current) record.current.el = node;
      if (registered && store) store.setElement(id, node);
    },
    [registered, store, id],
  );

  return { id, registered, view: registered ? view : "bar", ref };
}

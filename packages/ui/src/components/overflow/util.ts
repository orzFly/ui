import * as React from "react";

/**
 * Out of the flow and out of sight, still measured: a part in the ⋯ menu, a
 * hidden label, a probe. Its width is its own, unwrapped: no `w-max`, which
 * would take a button's `size-*` with it. Nothing in it transitions: it is
 * never seen to move, and the width it is measured at is the one it ends at.
 */
export const OUT_OF_FLOW =
  "pointer-events-none invisible absolute top-0 start-0 whitespace-nowrap transition-none **:transition-none";

/** The width a part takes in its row, margins included. */
export function outerWidth(el: Element): number {
  const style = getComputedStyle(el);
  return (
    el.getBoundingClientRect().width +
    (Number.parseFloat(style.marginLeft) || 0) +
    (Number.parseFloat(style.marginRight) || 0)
  );
}

/** The height a part takes in its row, margins included. */
export function outerHeight(el: Element): number {
  const style = getComputedStyle(el);
  return (
    el.getBoundingClientRect().height +
    (Number.parseFloat(style.marginTop) || 0) +
    (Number.parseFloat(style.marginBottom) || 0)
  );
}

/** The props that hold an overflowed part's place on the bar. */
export function slotProps(overflowed: boolean) {
  return overflowed
    ? ({ inert: true, "data-overflowed": "" } as const)
    : ({} as const);
}

/** Calls every ref it is given. */
export function useComposedRef<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  // biome-ignore lint/correctness/useExhaustiveDependencies: the refs are the dependencies
  return React.useCallback(compose(refs), refs);
}

function compose<T>(refs: Array<React.Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.RefObject<T | null>).current = node;
    }
  };
}

// Only what is read here: the package builds without Node's types.
declare const process: { env: { NODE_ENV?: string } };

/** A bundler writes NODE_ENV in; a page loaded with none gets no warnings rather than an error. */
export const dev = () => {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
};

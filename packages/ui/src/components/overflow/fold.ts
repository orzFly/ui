/** One step of a fold: the parts it changes, all at once, and the view it gives them. */
export interface FoldStep<V extends string> {
  /** Sort key, compared element by element. */
  key: readonly number[];
  /** The parts this step changes, all at once. */
  ids: readonly string[];
  view: V;
}

function compareKeys(a: readonly number[], b: readonly number[]) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** The steps in their order: by key, the given order breaking ties. */
export function sortSteps<V extends string>(
  steps: readonly FoldStep<V>[],
): FoldStep<V>[] {
  return [...steps].sort((a, b) => compareKeys(a.key, b.key));
}

/**
 * Takes the steps in order until `fits` holds, and returns the views then. A step table depends
 * only on the parts, never on the width, so a wider row takes the steps back in reverse.
 */
export function foldSteps<V extends string>(
  initial: Readonly<Record<string, V>>,
  steps: readonly FoldStep<V>[],
  fits: (views: Readonly<Record<string, V>>) => boolean,
): { views: Record<string, V>; fitted: boolean } {
  const views = { ...initial };
  if (fits(views)) return { views, fitted: true };
  for (const step of steps) {
    for (const id of step.ids) views[id] = step.view;
    if (fits(views)) return { views, fitted: true };
  }
  return { views, fitted: false };
}

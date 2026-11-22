/**
 * Where a row stands: its group's id (none in a list without groups), and its
 * index there counting the other rows only.
 */
export interface ReorderPosition {
  group?: string;
  index: number;
}

/** One move, as `onMove` hears it. */
export interface ReorderMove {
  id: string;
  from: ReorderPosition;
  to: ReorderPosition;
}

/** A group as `Reorder` reads it: a list without groups is one group with no `id`. */
export interface ReorderPlaces {
  id?: string;
  items: readonly string[];
}

export type ReorderCanDrop = (id: string, to: ReorderPosition) => boolean;

const place = (group: string | undefined, index: number): ReorderPosition =>
  group === undefined ? { index } : { group, index };

export function samePlace(a: ReorderPosition, b: ReorderPosition): boolean {
  return a.group === b.group && a.index === b.index;
}

/** `id`'s position, or undefined when no group holds it. */
export function positionOf(
  groups: readonly ReorderPlaces[],
  id: string,
): ReorderPosition | undefined {
  for (const group of groups) {
    const index = group.items.indexOf(id);
    if (index >= 0) return place(group.id, index);
  }
  return undefined;
}

/**
 * Every place `id` can stand, in the order shown: each group's 0…n, n its
 * rows other than `id`; its own place once.
 */
export function placesOf(
  groups: readonly ReorderPlaces[],
  id: string,
): ReorderPosition[] {
  return groups.flatMap((group) => {
    const others = group.items.filter((item) => item !== id).length;
    return Array.from({ length: others + 1 }, (_, index) =>
      place(group.id, index),
    );
  });
}

/**
 * The first place past `id`'s own in direction `dir` that `canDrop` accepts
 * (every place when it is absent), or undefined.
 */
export function stepPlace(
  groups: readonly ReorderPlaces[],
  id: string,
  dir: -1 | 1,
  canDrop?: ReorderCanDrop,
): ReorderPosition | undefined {
  const own = positionOf(groups, id);
  if (!own) return undefined;
  const places = placesOf(groups, id);
  const start = places.findIndex((p) => samePlace(p, own));
  for (let k = start + dir; k >= 0 && k < places.length; k += dir) {
    if (!canDrop || canDrop(id, places[k])) return places[k];
  }
  return undefined;
}

/**
 * `candidate` when `canDrop` accepts it, else the accepted place nearest it in
 * `placesOf` order, the one nearer `id`'s own place on a tie; `id`'s own place
 * always counts as accepted and is never asked about.
 */
export function nearestPlace(
  groups: readonly ReorderPlaces[],
  id: string,
  candidate: ReorderPosition,
  canDrop?: ReorderCanDrop,
): ReorderPosition {
  const own = positionOf(groups, id);
  const accepts = (p: ReorderPosition) =>
    (own !== undefined && samePlace(p, own)) || !canDrop || canDrop(id, p);
  if (accepts(candidate)) return candidate;
  const places = placesOf(groups, id);
  const at = places.findIndex((p) => samePlace(p, candidate));
  const home = own ? places.findIndex((p) => samePlace(p, own)) : at;
  if (at >= 0) {
    for (let d = 1; d < places.length; d++) {
      const hits = [at - d, at + d].filter(
        (k) => k >= 0 && k < places.length && accepts(places[k]),
      );
      if (hits.length > 0) {
        hits.sort((a, b) => Math.abs(a - home) - Math.abs(b - home));
        return places[hits[0]];
      }
    }
  }
  return own ?? candidate;
}

/** A new array with the element at `from.index` moved to `to.index`; `items` is left as it is. */
export function moveItem<T>(
  items: readonly T[],
  move: Pick<ReorderMove, "from" | "to">,
): T[] {
  const next = items.slice();
  if (move.from.index < 0 || move.from.index >= items.length) return next;
  const [moved] = next.splice(move.from.index, 1);
  next.splice(move.to.index, 0, moved as T);
  return next;
}

/**
 * A new array of groups with the element at `from` moved to `to`: the one or
 * two groups the move touches are new objects with new `items`, every other
 * group is the same object.
 */
export function moveInGroups<T, G extends { id: string; items: readonly T[] }>(
  groups: readonly G[],
  move: Pick<ReorderMove, "from" | "to">,
): G[] {
  const { from, to } = move;
  const source = groups.find((g) => g.id === from.group);
  const target = groups.find((g) => g.id === to.group);
  if (!source || !target || from.index >= source.items.length)
    return groups.slice();
  if (source === target) {
    return groups.map((g) =>
      g === source ? { ...g, items: moveItem(g.items, move) } : g,
    );
  }
  const moved = source.items[from.index];
  return groups.map((g) => {
    if (g === source)
      return { ...g, items: g.items.filter((_, i) => i !== from.index) };
    if (g === target) {
      const items = g.items.slice();
      items.splice(to.index, 0, moved);
      return { ...g, items };
    }
    return g;
  });
}

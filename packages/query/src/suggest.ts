/**
 * Levenshtein distance over code points, plus adjacent transposition as one
 * edit (optimal string alignment). Plain Levenshtein counts `opne` → `open`
 * as two edits, which the threshold below rejects for a four-letter word,
 * and a swapped pair is the commonest typo there is.
 */
function editDistance(a: readonly string[], b: readonly string[]): number {
  let beforePrevious: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = a[i - 1] === b[j - 1] ? 0 : 1;
      let distance = Math.min(
        (previous[j] as number) + 1,
        (current[j - 1] as number) + 1,
        (previous[j - 1] as number) + substitution,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        distance = Math.min(distance, (beforePrevious[j - 2] as number) + 1);
      }
      current[j] = distance;
    }
    beforePrevious = previous;
    previous = current;
  }
  return previous[b.length] as number;
}

/**
 * The candidate closest to `value`, case-insensitively, within
 * `max(1, floor(length / 3))` edits; ties go to the earlier candidate.
 * Null when nothing is that close, so a wild guess is never offered.
 */
export function didYouMean(
  value: string,
  candidates: readonly string[],
): string | null {
  const typed = Array.from(value.toLowerCase());
  const threshold = Math.max(1, Math.floor(typed.length / 3));
  let best: string | null = null;
  let bestDistance = threshold + 1;
  for (const candidate of candidates) {
    const distance = editDistance(typed, Array.from(candidate.toLowerCase()));
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

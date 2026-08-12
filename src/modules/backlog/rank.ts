const ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ALPHABET_SIZE = 62;
const MAX_RANK_LENGTH = 30;

export type RankBetweenResult =
  { ok: true; rank: string } | { ok: false; code: 'RANK_PRECISION_EXHAUSTED' };

/**
 * Pure client-side mirror of the server's `backlog_rank_midpoint` SQL
 * function — same alphabet, same digit-gap walk, same length bound — so
 * optimistic UI positioning matches what the server will eventually
 * persist. The server call remains the source of truth; this is instant
 * feedback only.
 */
export function rankBetween(
  lower: string | null,
  upper: string | null,
): RankBetweenResult {
  if (lower !== null && upper !== null && lower >= upper) {
    return { ok: false, code: 'RANK_PRECISION_EXHAUSTED' };
  }

  let prefix = '';
  let position = 0;
  let upperExhausted = false;

  for (;;) {
    if (position > MAX_RANK_LENGTH) {
      return { ok: false, code: 'RANK_PRECISION_EXHAUSTED' };
    }

    const digitA =
      lower !== null && position < lower.length
        ? ALPHABET.indexOf(lower[position]!)
        : 0;
    const digitB =
      !upperExhausted && upper !== null && position < upper.length
        ? ALPHABET.indexOf(upper[position]!)
        : ALPHABET_SIZE;

    const gap = digitB - digitA;

    if (gap >= 2) {
      return {
        ok: true,
        rank: prefix + ALPHABET[digitA + Math.floor(gap / 2)],
      };
    } else if (gap === 1) {
      prefix += ALPHABET[digitA];
      upperExhausted = true;
      position += 1;
    } else {
      prefix += ALPHABET[digitA];
      position += 1;
    }
  }
}

function base62Encode(value: number, width: number): string {
  let remainder = value;
  let text = '';
  for (let i = 0; i < width; i += 1) {
    text = ALPHABET[remainder % ALPHABET_SIZE] + text;
    remainder = Math.floor(remainder / ALPHABET_SIZE);
  }
  return text;
}

/**
 * Pure client-side mirror of the server's `rebalance_backlog_siblings`
 * canonical-spacing algorithm: given a sibling count, return that many
 * strictly increasing, distinct ranks. Existing rank values are
 * irrelevant to a rebalance — every sibling gets a fresh, evenly spaced
 * rank regardless of its prior position.
 */
export function rebalancePlan(count: number): string[] {
  if (count <= 0) return [];

  let width = 1;
  let capacity = ALPHABET_SIZE;
  while (capacity <= count) {
    width += 1;
    capacity *= ALPHABET_SIZE;
  }

  const totalCapacity = ALPHABET_SIZE ** width;
  const ranks: string[] = [];
  for (let index = 1; index <= count; index += 1) {
    const code = Math.floor((index * totalCapacity) / (count + 1));
    ranks.push(base62Encode(code, width));
  }
  return ranks;
}

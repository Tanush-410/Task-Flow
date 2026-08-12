import { describe, expect, it } from 'vitest';

import { rankBetween, rebalancePlan } from '@/modules/backlog/rank';

describe('rankBetween', () => {
  it('returns the mid-alphabet rank for an empty scope', () => {
    expect(rankBetween(null, null)).toEqual({ ok: true, rank: 'V' });
  });

  it('produces a rank strictly after a lower bound with no upper bound', () => {
    const result = rankBetween('V', null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rank > 'V').toBe(true);
    }
  });

  it('produces a rank strictly before an upper bound with no lower bound', () => {
    const result = rankBetween(null, 'V');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rank < 'V').toBe(true);
    }
  });

  it('extends length when adjacent single-character bounds leave no gap', () => {
    const result = rankBetween('V', 'W');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rank > 'V').toBe(true);
      expect(result.rank < 'W').toBe(true);
      expect(result.rank.length).toBeGreaterThan(1);
    }
  });

  it('produces a rank between two multi-character bounds sharing a prefix', () => {
    const result = rankBetween('AB', 'AC');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rank > 'AB').toBe(true);
      expect(result.rank < 'AC').toBe(true);
    }
  });

  it('produces a rank when the lower bound is a prefix of the upper bound', () => {
    const result = rankBetween('A', 'AB');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rank > 'A').toBe(true);
      expect(result.rank < 'AB').toBe(true);
    }
  });

  it('produces a strictly increasing sequence when repeatedly inserted at the end', () => {
    let lower: string | null = null;
    let previous: string | null = null;

    for (let i = 0; i < 40; i += 1) {
      const result = rankBetween(lower, null);
      expect(result.ok).toBe(true);
      if (!result.ok) break;

      if (previous !== null) {
        expect(result.rank > previous).toBe(true);
      }

      previous = result.rank;
      lower = result.rank;
    }
  });

  it('exhausts precision rather than throwing when bounds are identical', () => {
    expect(rankBetween('M', 'M')).toEqual({
      ok: false,
      code: 'RANK_PRECISION_EXHAUSTED',
    });
  });

  it('exhausts precision when bounds are inverted', () => {
    expect(rankBetween('Z', 'A')).toEqual({
      ok: false,
      code: 'RANK_PRECISION_EXHAUSTED',
    });
  });

  it('exhausts precision after repeatedly bisecting the same adjacent pair', () => {
    const lower = 'M';
    let upper = 'M' + '0'.repeat(40);
    let result = rankBetween(lower, upper);
    // Repeatedly close the gap between lower and the previous midpoint
    // until the walk exceeds the maximum rank length.
    for (let i = 0; i < 45 && result.ok; i += 1) {
      upper = result.rank;
      result = rankBetween(lower, upper);
    }
    expect(result).toEqual({ ok: false, code: 'RANK_PRECISION_EXHAUSTED' });
  });
});

describe('rebalancePlan', () => {
  it('returns an empty plan for zero items', () => {
    expect(rebalancePlan(0)).toEqual([]);
  });

  it.each([1, 2, 61, 200])(
    'produces %i strictly increasing, distinct canonical ranks',
    (count) => {
      const ranks = rebalancePlan(count);
      expect(ranks).toHaveLength(count);
      expect(new Set(ranks).size).toBe(count);
      for (let i = 1; i < ranks.length; i += 1) {
        expect(ranks[i]! > ranks[i - 1]!).toBe(true);
      }
    },
  );

  it('produces ranks that all share the same width', () => {
    const ranks = rebalancePlan(200);
    const width = ranks[0]!.length;
    expect(ranks.every((rank) => rank.length === width)).toBe(true);
  });
});

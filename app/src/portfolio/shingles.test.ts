import { describe, it, expect } from 'vitest';
import { paragraphShingles, jaccard } from './shingles';

describe('paragraphShingles', () => {
  it('returns an empty array for empty input', () => {
    expect(paragraphShingles('')).toEqual([]);
  });

  it('returns an empty array when text has fewer tokens than k', () => {
    expect(paragraphShingles('one two three', 5)).toEqual([]);
  });

  it('lowercases, collapses whitespace, and strips punctuation before shingling', () => {
    const a = paragraphShingles('The Quick, Brown Fox Jumps Over!', 5);
    const b = paragraphShingles('the   quick brown fox jumps over', 5);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('produces (n - k + 1) shingles for n tokens', () => {
    // 7 tokens, k=5 -> 3 shingles
    const out = paragraphShingles('a b c d e f g', 5);
    expect(out).toHaveLength(3);
  });

  it('defaults k to 5', () => {
    const withDefault = paragraphShingles('a b c d e f g h');
    const explicit = paragraphShingles('a b c d e f g h', 5);
    expect(withDefault).toEqual(explicit);
  });
});

describe('jaccard', () => {
  it('returns 0 for two empty sets', () => {
    expect(jaccard([], [])).toBe(0);
  });

  it('returns 0 when one side is empty and the other is not', () => {
    expect(jaccard([], ['a', 'b'])).toBe(0);
    expect(jaccard(['a'], [])).toBe(0);
  });

  it('returns 1 for identical sets', () => {
    expect(jaccard(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(1);
  });

  it('returns 0 for disjoint sets', () => {
    expect(jaccard(['a', 'b'], ['c', 'd'])).toBe(0);
  });

  it('computes |intersection| / |union| for partial overlap', () => {
    // {a,b,c} ∩ {b,c,d} = {b,c}; union = {a,b,c,d}; 2/4 = 0.5
    expect(jaccard(['a', 'b', 'c'], ['b', 'c', 'd'])).toBeCloseTo(0.5, 5);
  });

  it('treats inputs as sets (duplicates do not change the score)', () => {
    expect(jaccard(['a', 'a', 'b'], ['a', 'b', 'b'])).toBe(1);
  });
});

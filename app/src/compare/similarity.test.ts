import { describe, it, expect } from 'vitest';
import { similarity } from './similarity';

describe('similarity', () => {
  it('returns 1 for identical strings', () => {
    expect(similarity('hello world', 'hello world')).toBe(1);
  });

  it('returns 0 for two non-empty strings sharing no characters', () => {
    expect(similarity('abc', 'xyz')).toBeCloseTo(0, 5);
  });

  it('returns 1 for two empty strings', () => {
    expect(similarity('', '')).toBe(1);
  });

  it('is case-insensitive and whitespace-tolerant', () => {
    expect(similarity('Hello  World', 'hello world')).toBe(1);
  });

  it('rates near-identical strings very highly', () => {
    const s = similarity('Rent is $1000 per month.', 'Rent is $1200 per month.');
    expect(s).toBeGreaterThan(0.85);
  });

  it('drops for large edits', () => {
    const s = similarity('Rent is $1000 per month.', 'Tenant must paint walls.');
    expect(s).toBeLessThan(0.4);
  });

  it('handles empty-vs-nonempty without blowing up', () => {
    expect(similarity('', 'hello')).toBe(0);
    expect(similarity('hello', '')).toBe(0);
  });

  it('handles single-character diffs', () => {
    const s = similarity('a', 'b');
    expect(s).toBe(0);
  });
});

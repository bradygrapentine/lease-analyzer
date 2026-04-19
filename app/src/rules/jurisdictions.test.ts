import { describe, it, expect } from 'vitest';
import { filterByJurisdiction } from './jurisdictions';
import type { Rule } from './types';

function rule(id: string, jurisdictions?: string[]): Rule {
  const base: Rule = {
    id,
    severity: 'low',
    category: 'general',
    title: `Title ${id}`,
    explanation: 'Explanation',
    citation: null,
    match: { type: 'regex', pattern: id, flags: 'i' },
  };
  if (jurisdictions !== undefined) base.jurisdictions = jurisdictions;
  return base;
}

describe('filterByJurisdiction', () => {
  it('keeps rules with no jurisdictions tag (applies everywhere)', () => {
    const rules = [rule('a'), rule('b', [])];
    const out = filterByJurisdiction(rules, ['US-CA']);
    expect(out.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('keeps a rule whose jurisdictions intersect the selected list', () => {
    const rules = [rule('ca-only', ['US-CA'])];
    const out = filterByJurisdiction(rules, ['US-CA', 'US-NY']);
    expect(out.map((r) => r.id)).toEqual(['ca-only']);
  });

  it('drops a rule whose jurisdictions do not intersect', () => {
    const rules = [rule('tx-only', ['US-TX'])];
    const out = filterByJurisdiction(rules, ['US-CA']);
    expect(out).toEqual([]);
  });

  it('keeps a jurisdiction-tagged rule when selected is empty (no filter applied)', () => {
    // An empty selection means "no jurisdiction filter is active" — we keep
    // every rule, including tagged ones. This matches the UI contract: users
    // who never pick a jurisdiction see everything.
    const rules = [rule('ca-only', ['US-CA']), rule('generic')];
    const out = filterByJurisdiction(rules, []);
    expect(out.map((r) => r.id)).toEqual(['ca-only', 'generic']);
  });

  it('returns a new array and does not mutate the input', () => {
    const rules = [rule('a', ['US-CA']), rule('b', ['US-TX'])];
    const out = filterByJurisdiction(rules, ['US-CA']);
    expect(out).not.toBe(rules);
    expect(rules).toHaveLength(2);
  });

  it('handles mixed tagged/untagged rules together', () => {
    const rules = [
      rule('generic'),
      rule('ca', ['US-CA']),
      rule('ny', ['US-NY']),
      rule('multi', ['US-CA', 'US-TX']),
    ];
    const out = filterByJurisdiction(rules, ['US-CA']);
    expect(out.map((r) => r.id)).toEqual(['generic', 'ca', 'multi']);
  });
});

import { describe, it, expect } from 'vitest';
import { applySeverityOverrides } from './severityOverrides';
import type { Rule, Severity } from './types';

function rule(id: string, severity: Severity = 'medium'): Rule {
  return {
    id,
    severity,
    category: 'general',
    title: `Title ${id}`,
    explanation: 'Explanation',
    citation: null,
    match: { type: 'regex', pattern: id, flags: 'i' },
  };
}

describe('applySeverityOverrides', () => {
  it('returns the same rules unchanged when no overrides are present', () => {
    const rules = [rule('a', 'high'), rule('b', 'low')];
    const out = applySeverityOverrides(rules, {});
    expect(out.map((r) => r.severity)).toEqual(['high', 'low']);
  });

  it('overrides severity for matching rule ids only', () => {
    const rules = [rule('a', 'high'), rule('b', 'low')];
    const out = applySeverityOverrides(rules, { a: 'info' });
    expect(out[0]?.severity).toBe('info');
    expect(out[1]?.severity).toBe('low');
  });

  it('returns a fresh array and does not mutate input rules', () => {
    const rules = [rule('a', 'high')];
    const out = applySeverityOverrides(rules, { a: 'low' });
    expect(out).not.toBe(rules);
    expect(rules[0]?.severity).toBe('high');
    expect(out[0]?.severity).toBe('low');
  });

  it('ignores overrides whose ruleId is not in the rule set', () => {
    const rules = [rule('a', 'high')];
    const out = applySeverityOverrides(rules, { nonexistent: 'info' });
    expect(out.map((r) => r.severity)).toEqual(['high']);
  });

  it('preserves non-severity fields on each overridden rule', () => {
    const rules = [rule('a', 'high')];
    const out = applySeverityOverrides(rules, { a: 'medium' });
    expect(out[0]).toMatchObject({
      id: 'a',
      category: 'general',
      title: 'Title a',
    });
  });

  it('supports each valid Severity value', () => {
    const rules = [rule('a', 'high')];
    const severities: Severity[] = ['high', 'medium', 'low', 'info'];
    for (const s of severities) {
      const out = applySeverityOverrides(rules, { a: s });
      expect(out[0]?.severity).toBe(s);
    }
  });
});

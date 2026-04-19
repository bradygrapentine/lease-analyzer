import { describe, it, expect } from 'vitest';
import { diffFindings } from './diffFindings';
import type { Finding } from '../rules/types';

function f(over: Partial<Finding>): Finding {
  return {
    ruleId: 'x',
    severity: 'medium',
    category: 'general',
    title: 'T',
    explanation: 'E',
    citation: null,
    page: 1,
    paragraphIndex: 0,
    snippet: 's',
    span: { start: 0, end: 1 },
    confidence: 0.9,
    negated: false,
    rulePackVersion: '1.0.0',
    ...over,
  };
}

describe('diffFindings', () => {
  it('identifies added rule hits (present in B but not A)', () => {
    const result = diffFindings([f({ ruleId: 'a' })], [f({ ruleId: 'a' }), f({ ruleId: 'b' })]);
    expect(result.added.map((x) => x.ruleId)).toEqual(['b']);
    expect(result.removed).toEqual([]);
    expect(result.unchanged.map((x) => x.ruleId)).toEqual(['a']);
  });

  it('identifies removed rule hits (in A, missing in B)', () => {
    const result = diffFindings([f({ ruleId: 'a' }), f({ ruleId: 'b' })], [f({ ruleId: 'a' })]);
    expect(result.removed.map((x) => x.ruleId)).toEqual(['b']);
    expect(result.added).toEqual([]);
    expect(result.unchanged.map((x) => x.ruleId)).toEqual(['a']);
  });

  it('flags a severity change on the same rule as "changed"', () => {
    const result = diffFindings(
      [f({ ruleId: 'c', severity: 'low' })],
      [f({ ruleId: 'c', severity: 'high' })],
    );
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0]?.from.severity).toBe('low');
    expect(result.changed[0]?.to.severity).toBe('high');
    expect(result.unchanged).toEqual([]);
  });

  it('flags a negation change as "changed"', () => {
    const result = diffFindings(
      [f({ ruleId: 'n', negated: false })],
      [f({ ruleId: 'n', negated: true })],
    );
    expect(result.changed).toHaveLength(1);
    expect(result.unchanged).toEqual([]);
  });

  it('treats findings with same rule + severity + negated as unchanged', () => {
    const result = diffFindings(
      [f({ ruleId: 'u', severity: 'low', negated: false })],
      [f({ ruleId: 'u', severity: 'low', negated: false })],
    );
    expect(result.unchanged).toHaveLength(1);
    expect(result.changed).toEqual([]);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
  });
});

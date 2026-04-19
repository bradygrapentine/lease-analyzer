import { describe, expect, it } from 'vitest';
import {
  compileRule,
  compileRules,
  isCompiledRules,
  RuleCompilationError,
} from './compileRules';
import type { Rule } from './types';

function regexRule(id: string, pattern: string, flags?: string): Rule {
  return {
    id,
    severity: 'low',
    category: 'general',
    title: id,
    explanation: '',
    citation: null,
    match: { type: 'regex', pattern, ...(flags !== undefined ? { flags } : {}) },
  };
}

function keywordRule(id: string, keywords: string[], window = 20): Rule {
  return {
    id,
    severity: 'low',
    category: 'general',
    title: id,
    explanation: '',
    citation: null,
    match: { type: 'keywordProximity', keywords, window },
  };
}

describe('compileRule', () => {
  it('compiles a regex matcher once and caches the RegExp', () => {
    const rule = regexRule('r', 'foo', 'i');
    const compiled = compileRule(rule);
    expect(compiled.__compiled?.regex).toBeInstanceOf(RegExp);
    expect(compiled.__compiled?.regex?.source).toBe('foo');
    // `g` is auto-added by the compiler because runRegex relies on exec loop semantics.
    expect(compiled.__compiled?.regex?.flags).toContain('g');
    expect(compiled.__compiled?.regex?.flags).toContain('i');
  });

  it('does not double-append the `g` flag when it is already present', () => {
    const rule = regexRule('r', 'foo', 'gi');
    const compiled = compileRule(rule);
    const flags = compiled.__compiled?.regex?.flags ?? '';
    // A valid flag string cannot contain duplicate letters, so just assert both are present.
    expect(flags.split('').sort().join('')).toBe('gi');
  });

  it('pre-lowercases keywordProximity keywords', () => {
    const rule = keywordRule('k', ['Early', 'TERMINATION']);
    const compiled = compileRule(rule);
    expect(compiled.__compiled?.keywordsLower).toEqual(['early', 'termination']);
  });

  it('recursively compiles sectionAnchored with a regex child', () => {
    const rule: Rule = {
      id: 'sa',
      severity: 'low',
      category: 'general',
      title: 'sa',
      explanation: '',
      citation: null,
      match: {
        type: 'sectionAnchored',
        headingPattern: '^Fees',
        child: { type: 'regex', pattern: 'late', flags: 'i' },
      },
    };
    const compiled = compileRule(rule);
    expect(compiled.__compiled?.headingRegex).toBeInstanceOf(RegExp);
    expect(compiled.__compiled?.headingRegex?.flags).toContain('i');
    expect(compiled.__compiled?.child?.regex).toBeInstanceOf(RegExp);
  });

  it('recursively compiles sectionAnchored with a keywordProximity child', () => {
    const rule: Rule = {
      id: 'sa2',
      severity: 'low',
      category: 'general',
      title: 'sa2',
      explanation: '',
      citation: null,
      match: {
        type: 'sectionAnchored',
        headingPattern: '^Dispute',
        child: { type: 'keywordProximity', keywords: ['JURY', 'Waive'], window: 40 },
      },
    };
    const compiled = compileRule(rule);
    expect(compiled.__compiled?.child?.keywordsLower).toEqual(['jury', 'waive']);
  });

  it('throws RuleCompilationError on bad regex with the rule id attached', () => {
    const rule = regexRule('bad', '[unterminated');
    expect(() => compileRule(rule)).toThrowError(RuleCompilationError);
    try {
      compileRule(rule);
    } catch (err) {
      expect(err).toBeInstanceOf(RuleCompilationError);
      const rcerr = err as RuleCompilationError;
      expect(rcerr.ruleId).toBe('bad');
      expect(rcerr.reason.length).toBeGreaterThan(0);
    }
  });

  it('throws with the rule id when a sectionAnchored heading pattern is invalid', () => {
    const rule: Rule = {
      id: 'sa-bad',
      severity: 'low',
      category: 'general',
      title: 'sa-bad',
      explanation: '',
      citation: null,
      match: {
        type: 'sectionAnchored',
        headingPattern: '[bad',
        child: { type: 'regex', pattern: 'ok' },
      },
    };
    expect(() => compileRule(rule)).toThrowError(/sa-bad/);
  });
});

describe('compileRules', () => {
  it('compiles every rule in order', () => {
    const rules = [regexRule('a', 'x'), keywordRule('b', ['y'])];
    const compiled = compileRules(rules);
    expect(compiled).toHaveLength(2);
    expect(compiled[0]?.id).toBe('a');
    expect(compiled[1]?.id).toBe('b');
    expect(compiled[0]?.__compiled?.regex).toBeInstanceOf(RegExp);
    expect(compiled[1]?.__compiled?.keywordsLower).toEqual(['y']);
  });

  it('short-circuits on the first failure', () => {
    const rules = [regexRule('ok', 'x'), regexRule('boom', '[bad'), regexRule('never', 'x')];
    expect(() => compileRules(rules)).toThrowError(/boom/);
  });
});

describe('isCompiledRules', () => {
  it('returns false for an empty array', () => {
    expect(isCompiledRules([])).toBe(false);
  });

  it('returns false when any rule lacks __compiled', () => {
    const r = compileRule(regexRule('a', 'x'));
    expect(isCompiledRules([r, regexRule('b', 'y')])).toBe(false);
  });

  it('returns true when every rule has __compiled', () => {
    const rs = compileRules([regexRule('a', 'x'), keywordRule('b', ['y'])]);
    expect(isCompiledRules(rs)).toBe(true);
  });
});

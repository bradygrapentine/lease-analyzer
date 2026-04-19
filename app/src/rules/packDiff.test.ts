import { describe, it, expect } from 'vitest';
import { diffPack } from './packDiff';
import type { Rule } from './types';
import { RULE_PACK_SCHEMA_VERSION, type RulePackFile } from './packSchema';

function rule(id: string, over: Partial<Rule> = {}): Rule {
  return {
    id,
    severity: 'medium',
    category: 'general',
    title: `Title ${id}`,
    explanation: `Explain ${id}`,
    citation: null,
    match: { type: 'regex', pattern: id, flags: 'i' },
    ...over,
  };
}

function pack(rules: Rule[], over: Partial<RulePackFile> = {}): RulePackFile {
  return {
    schema: RULE_PACK_SCHEMA_VERSION,
    id: 'p1',
    name: 'Test Pack',
    version: '1.0.0',
    description: 'Test',
    rules,
    ...over,
  };
}

describe('diffPack', () => {
  it('classifies wholly-new rule ids as added', () => {
    const current = [rule('a')];
    const incoming = pack([rule('a'), rule('b')]);
    const d = diffPack(current, incoming);
    expect(d.added.map((r) => r.id)).toEqual(['b']);
    expect(d.removed).toEqual([]);
    expect(d.changed).toEqual([]);
  });

  it('classifies missing rule ids as removed', () => {
    const current = [rule('a'), rule('b')];
    const incoming = pack([rule('a')]);
    const d = diffPack(current, incoming);
    expect(d.removed.map((r) => r.id)).toEqual(['b']);
    expect(d.added).toEqual([]);
  });

  it('classifies same-id rules with different severity as changed', () => {
    const current = [rule('a', { severity: 'high' })];
    const incoming = pack([rule('a', { severity: 'low' })]);
    const d = diffPack(current, incoming);
    expect(d.changed).toHaveLength(1);
    expect(d.changed[0]?.ruleId).toBe('a');
    expect(d.changed[0]?.fields).toContain('severity');
  });

  it('classifies same-id rules with different title as changed', () => {
    const current = [rule('a', { title: 'Old' })];
    const incoming = pack([rule('a', { title: 'New' })]);
    const d = diffPack(current, incoming);
    expect(d.changed).toHaveLength(1);
    expect(d.changed[0]?.fields).toContain('title');
  });

  it('classifies same-id rules with different explanation as changed', () => {
    const current = [rule('a', { explanation: 'old' })];
    const incoming = pack([rule('a', { explanation: 'new' })]);
    const d = diffPack(current, incoming);
    expect(d.changed).toHaveLength(1);
    expect(d.changed[0]?.fields).toContain('explanation');
  });

  it('classifies same-id rules with different category as changed', () => {
    const current = [rule('a', { category: 'fees' })];
    const incoming = pack([rule('a', { category: 'dispute' })]);
    const d = diffPack(current, incoming);
    expect(d.changed).toHaveLength(1);
    expect(d.changed[0]?.fields).toContain('category');
  });

  it('classifies same-id rules with different match as changed', () => {
    const current = [
      rule('a', { match: { type: 'regex', pattern: 'old', flags: 'i' } }),
    ];
    const incoming = pack([
      rule('a', { match: { type: 'regex', pattern: 'new', flags: 'i' } }),
    ]);
    const d = diffPack(current, incoming);
    expect(d.changed).toHaveLength(1);
    expect(d.changed[0]?.fields).toContain('match');
  });

  it('treats identical rules as neither added, removed, nor changed', () => {
    const r = rule('a');
    const current = [r];
    const incoming = pack([rule('a')]);
    const d = diffPack(current, incoming);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
    expect(d.changed).toEqual([]);
  });

  it('composes adds + removes + changes in one diff', () => {
    const current = [rule('a', { severity: 'high' }), rule('gone')];
    const incoming = pack([
      rule('a', { severity: 'low' }),
      rule('new'),
    ]);
    const d = diffPack(current, incoming);
    expect(d.added.map((r) => r.id)).toEqual(['new']);
    expect(d.removed.map((r) => r.id)).toEqual(['gone']);
    expect(d.changed.map((c) => c.ruleId)).toEqual(['a']);
  });
});

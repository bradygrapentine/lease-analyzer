import { describe, it, expect } from 'vitest';
import { resolveActiveRules } from './activePack';
import type { Rule } from './types';
import { RULE_PACK_SCHEMA_VERSION, type RulePackFile } from './packSchema';

function rule(id: string, overrides: Partial<Rule> = {}): Rule {
  return {
    id,
    severity: 'low',
    category: 'general',
    title: `Title ${id}`,
    explanation: 'Explanation',
    citation: null,
    match: { type: 'regex', pattern: id, flags: 'i' },
    ...overrides,
  };
}

function pack(id: string, rules: Rule[]): RulePackFile {
  return {
    schema: RULE_PACK_SCHEMA_VERSION,
    id,
    name: `Pack ${id}`,
    version: '1.0.0',
    description: 'test',
    rules,
  };
}

describe('resolveActiveRules', () => {
  it('returns built-in rules when no packs are installed', () => {
    const builtIn = [rule('a'), rule('b')];
    const result = resolveActiveRules(builtIn, [], new Set());
    expect(result.rules.map((r) => r.id)).toEqual(['a', 'b']);
    expect(result.collisions).toEqual([]);
  });

  it('merges enabled installed packs with the built-in pack', () => {
    const builtIn = [rule('a')];
    const installed = [pack('p1', [rule('c'), rule('d')])];
    const result = resolveActiveRules(builtIn, installed, new Set(['p1']));
    expect(result.rules.map((r) => r.id).sort()).toEqual(['a', 'c', 'd']);
  });

  it('ignores installed packs that are not enabled', () => {
    const builtIn = [rule('a')];
    const installed = [pack('p1', [rule('c')])];
    const result = resolveActiveRules(builtIn, installed, new Set());
    expect(result.rules.map((r) => r.id)).toEqual(['a']);
  });

  it('installed pack wins when a rule id collides with built-in', () => {
    const builtIn = [rule('a', { title: 'built-in A' })];
    const installed = [pack('p1', [rule('a', { title: 'override A' })])];
    const result = resolveActiveRules(builtIn, installed, new Set(['p1']));
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]?.title).toBe('override A');
    expect(result.collisions).toHaveLength(1);
    expect(result.collisions[0]).toMatchObject({ ruleId: 'a', winner: 'p1' });
  });

  it('the last enabled pack wins when two installed packs collide', () => {
    const builtIn: Rule[] = [];
    const installed = [
      pack('p1', [rule('x', { title: 'from p1' })]),
      pack('p2', [rule('x', { title: 'from p2' })]),
    ];
    const result = resolveActiveRules(builtIn, installed, new Set(['p1', 'p2']));
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]?.title).toBe('from p2');
    expect(result.collisions[0]).toMatchObject({ ruleId: 'x', winner: 'p2' });
  });

  it('does not mutate the input pack arrays', () => {
    const builtIn = [rule('a')];
    const installedRules = [rule('a', { title: 'override' })];
    const installed = [pack('p1', installedRules)];
    resolveActiveRules(builtIn, installed, new Set(['p1']));
    expect(builtIn[0]?.title).toBe('Title a');
    expect(installedRules[0]?.title).toBe('override');
  });
});

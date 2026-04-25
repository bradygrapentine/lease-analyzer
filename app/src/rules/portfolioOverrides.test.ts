import { describe, it, expect } from 'vitest';
import {
  migrateLegacyOverrides,
  resolveSeverity,
  type ScopedOverrideEntry,
} from './portfolioOverrides';

describe('resolveSeverity (lease > portfolio > pack default)', () => {
  it('returns the pack default when no overrides exist', () => {
    expect(
      resolveSeverity('r1', 'high', [], { leaseId: 'L1' }),
    ).toBe('high');
  });

  it('applies a portfolio-scope override when no lease-scope override exists', () => {
    const entries: ScopedOverrideEntry[] = [
      { ruleId: 'r1', severity: 'low', scope: 'portfolio' },
    ];
    expect(resolveSeverity('r1', 'high', entries, { leaseId: 'L1' })).toBe(
      'low',
    );
  });

  it('lease-scope override wins over portfolio-scope override on the same lease', () => {
    const entries: ScopedOverrideEntry[] = [
      { ruleId: 'r1', severity: 'low', scope: 'portfolio' },
      { ruleId: 'r1', severity: 'medium', scope: 'lease', leaseId: 'L1' },
    ];
    expect(resolveSeverity('r1', 'high', entries, { leaseId: 'L1' })).toBe(
      'medium',
    );
  });

  it('lease-scope override on a different lease does not affect this lease', () => {
    const entries: ScopedOverrideEntry[] = [
      { ruleId: 'r1', severity: 'low', scope: 'portfolio' },
      { ruleId: 'r1', severity: 'medium', scope: 'lease', leaseId: 'L2' },
    ];
    // Portfolio still applies on L1.
    expect(resolveSeverity('r1', 'high', entries, { leaseId: 'L1' })).toBe(
      'low',
    );
  });

  it('falls back to pack default when neither scope has an entry for this ruleId', () => {
    const entries: ScopedOverrideEntry[] = [
      { ruleId: 'other', severity: 'low', scope: 'portfolio' },
    ];
    expect(resolveSeverity('r1', 'info', entries, { leaseId: 'L1' })).toBe(
      'info',
    );
  });

  it('removing the portfolio override falls back to the pack default', () => {
    const before: ScopedOverrideEntry[] = [
      { ruleId: 'r1', severity: 'low', scope: 'portfolio' },
    ];
    const after: ScopedOverrideEntry[] = [];
    expect(resolveSeverity('r1', 'high', before, { leaseId: 'L1' })).toBe(
      'low',
    );
    expect(resolveSeverity('r1', 'high', after, { leaseId: 'L1' })).toBe(
      'high',
    );
  });
});

describe('migrateLegacyOverrides', () => {
  it('returns an empty array when given an empty legacy map', () => {
    expect(migrateLegacyOverrides({})).toEqual([]);
  });

  it('migrates pre-existing user severity overrides to portfolio-scope entries', () => {
    // Pre-Wave-10 overrides were per-user / global with no scope; treat them
    // as portfolio-scope so behavior carries over.
    const legacy: Record<string, 'high' | 'medium' | 'low' | 'info'> = {
      'auto-renewal': 'high',
      'late-fee': 'low',
    };
    const out = migrateLegacyOverrides(legacy);
    expect(out).toHaveLength(2);
    for (const entry of out) {
      expect(entry.scope).toBe('portfolio');
    }
    const auto = out.find((e) => e.ruleId === 'auto-renewal');
    const late = out.find((e) => e.ruleId === 'late-fee');
    expect(auto?.severity).toBe('high');
    expect(late?.severity).toBe('low');
  });
});

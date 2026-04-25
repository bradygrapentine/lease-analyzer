import { describe, it, expect } from 'vitest';
// Wave 8 Part B — module under test does not yet exist; failing import
// is the expected red signal until the implementer creates
// `src/rules/packBaseline.ts`. Expected exports:
//   - resolveBaselineDeviations(packId, currentRules, baseline?) =>
//       BaselineDeviation[]
//   - hashRuleBody(rule): Promise<string>     // canonical sha256 hex
//   - type BaselineDeviation = { id, baselineFingerprint, currentFingerprint, deviates }
import {
  resolveBaselineDeviations,
  hashRuleBody,
  type BaselineDeviation,
} from './packBaseline';
import type { Rule } from './types';

function rule(over: Partial<Rule> = {}): Rule {
  return {
    id: 'auto-renewal',
    severity: 'medium',
    category: 'termination',
    title: 'Auto-renewal',
    explanation: 'Lease auto-renews.',
    citation: null,
    match: { type: 'regex', pattern: 'auto[- ]?renew' },
    ...over,
  };
}

describe('packBaseline.resolveBaselineDeviations', () => {
  it('returns deviates=false when the rule body is unchanged from a signed baseline', async () => {
    const r = rule();
    const fp = await hashRuleBody(r);
    const result: BaselineDeviation[] = await resolveBaselineDeviations(
      'pack-x',
      [r],
      { rules: [{ id: r.id, fingerprint: fp }] },
    );
    expect(result).toHaveLength(1);
    const first = result[0];
    expect(first?.deviates).toBe(false);
    expect(first?.baselineFingerprint).toBe(fp);
    expect(first?.currentFingerprint).toBe(fp);
  });

  it('returns deviates=true when an active rule was edited locally vs its signed baseline', async () => {
    const original = rule();
    const baselineFp = await hashRuleBody(original);
    const edited: Rule = { ...original, explanation: 'Edited locally.' };
    const result = await resolveBaselineDeviations('pack-x', [edited], {
      rules: [{ id: original.id, fingerprint: baselineFp }],
    });
    expect(result).toHaveLength(1);
    const first = result[0];
    expect(first?.deviates).toBe(true);
    expect(first?.baselineFingerprint).toBe(baselineFp);
    expect(first?.currentFingerprint).not.toBe(baselineFp);
  });

  it('returns deviates=true when an unsigned pack derives from a signed one (hash mismatch)', async () => {
    const original = rule({ id: 'late-fee', title: 'Late fee' });
    const baselineFp = await hashRuleBody(original);
    // "Derived" pack has the same id but a different matcher body.
    const derived: Rule = {
      ...original,
      match: { type: 'regex', pattern: 'late\\s+payment' },
    };
    const result = await resolveBaselineDeviations('pack-x', [derived], {
      rules: [{ id: original.id, fingerprint: baselineFp }],
    });
    expect(result[0]?.deviates).toBe(true);
  });

  it('returns deviates=false when the pack never had a signed baseline (no entries)', async () => {
    const result = await resolveBaselineDeviations('pack-x', [rule()], undefined);
    // No baseline => no deviations to report.
    expect(result).toEqual([]);
  });

  it('returns deviates=false when the rule has no matching baseline entry', async () => {
    const r = rule({ id: 'novel-rule' });
    const result = await resolveBaselineDeviations('pack-x', [r], {
      rules: [{ id: 'something-else', fingerprint: 'a'.repeat(64) }],
    });
    // Rule id missing from baseline => not a deviation, just absent.
    expect(result.find((d) => d.id === 'novel-rule')?.deviates ?? false).toBe(false);
  });
});

describe('packBaseline.hashRuleBody', () => {
  it('produces a deterministic 64-char hex digest', async () => {
    const r = rule();
    const a = await hashRuleBody(r);
    const b = await hashRuleBody(r);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when the matcher pattern changes', async () => {
    const a = await hashRuleBody(rule());
    const b = await hashRuleBody(
      rule({ match: { type: 'regex', pattern: 'different' } }),
    );
    expect(a).not.toBe(b);
  });
});

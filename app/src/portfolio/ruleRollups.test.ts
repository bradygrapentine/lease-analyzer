import { describe, it, expect } from 'vitest';
import { aggregateFindings } from './ruleRollups';
import { applySeverityOverrides } from '../rules/severityOverrides';
import type { LeaseRecord } from '../storage/storage';
import type { Finding, Rule, Severity } from '../rules/types';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'rule-a',
    severity: 'medium',
    category: 'general',
    title: 'Title',
    explanation: 'Explanation',
    citation: null,
    page: 1,
    paragraphIndex: 0,
    snippet: 'snippet',
    span: { start: 0, end: 7 },
    confidence: 0.9,
    negated: false,
    rulePackVersion: '1.0.0',
    ...overrides,
  };
}

function makeLease(id: string, findings: Finding[]): LeaseRecord {
  return {
    id,
    name: `${id}.pdf`,
    createdAt: 1000,
    updatedAt: 1000,
    rulePackVersion: '1.0.0',
    pageCount: 1,
    findingCount: findings.length,
    doc: {
      pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
      paragraphs: [{ text: 'Hello', page: 1 }],
      sections: [],
      raw: 'Hello',
    },
    findings,
  };
}

describe('aggregateFindings (rule rollups)', () => {
  it('returns an empty array when the library is empty', () => {
    expect(aggregateFindings([])).toEqual([]);
  });

  it('rolls up a single lease with one rule', () => {
    const leases = [makeLease('L1', [makeFinding({ ruleId: 'r1' })])];
    const out = aggregateFindings(leases);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      ruleId: 'r1',
      leaseCount: 1,
      leaseIds: ['L1'],
    });
  });

  it('counts each rule once per lease even if it fires multiple times in that lease', () => {
    const leases = [
      makeLease('L1', [
        makeFinding({ ruleId: 'r1', paragraphIndex: 0 }),
        makeFinding({ ruleId: 'r1', paragraphIndex: 1 }),
      ]),
    ];
    const out = aggregateFindings(leases);
    const r1 = out.find((r) => r.ruleId === 'r1');
    expect(r1?.leaseCount).toBe(1);
    expect(r1?.leaseIds).toEqual(['L1']);
  });

  it('aggregates the same rule across multiple leases', () => {
    const leases = [
      makeLease('L1', [makeFinding({ ruleId: 'r1' })]),
      makeLease('L2', [makeFinding({ ruleId: 'r1' })]),
      makeLease('L3', [makeFinding({ ruleId: 'r2' })]),
    ];
    const out = aggregateFindings(leases);
    const r1 = out.find((r) => r.ruleId === 'r1');
    const r2 = out.find((r) => r.ruleId === 'r2');
    expect(r1?.leaseCount).toBe(2);
    expect(r1?.leaseIds.sort()).toEqual(['L1', 'L2']);
    expect(r2?.leaseCount).toBe(1);
  });

  it('reports per-severity counts per rule', () => {
    const leases = [
      makeLease('L1', [makeFinding({ ruleId: 'r1', severity: 'high' })]),
      makeLease('L2', [makeFinding({ ruleId: 'r1', severity: 'low' })]),
      makeLease('L3', [makeFinding({ ruleId: 'r1', severity: 'high' })]),
    ];
    const out = aggregateFindings(leases);
    const r1 = out.find((r) => r.ruleId === 'r1');
    expect(r1?.severityCounts.high).toBe(2);
    expect(r1?.severityCounts.low).toBe(1);
  });

  it('orders deterministically: leaseCount desc, ruleId asc on ties', () => {
    const leases = [
      makeLease('L1', [
        makeFinding({ ruleId: 'b-rule' }),
        makeFinding({ ruleId: 'a-rule' }),
        makeFinding({ ruleId: 'c-rule' }),
      ]),
      makeLease('L2', [makeFinding({ ruleId: 'b-rule' })]),
    ];
    const out = aggregateFindings(leases);
    // b-rule has count=2 (first); a-rule and c-rule both count=1, so alpha
    expect(out.map((r) => r.ruleId)).toEqual(['b-rule', 'a-rule', 'c-rule']);
  });

  it('produces stable ordering across runs (deterministic across leaseId order)', () => {
    const leasesA = [
      makeLease('L1', [makeFinding({ ruleId: 'r1' })]),
      makeLease('L2', [makeFinding({ ruleId: 'r1' })]),
    ];
    const leasesB = [
      makeLease('L2', [makeFinding({ ruleId: 'r1' })]),
      makeLease('L1', [makeFinding({ ruleId: 'r1' })]),
    ];
    const a = aggregateFindings(leasesA);
    const b = aggregateFindings(leasesB);
    expect(a[0]?.leaseIds).toEqual(b[0]?.leaseIds);
  });

  it('respects severity overrides applied via applySeverityOverrides', () => {
    // Author intent: rollups consume findings whose severity has already been
    // resolved through the same path FindingsPanel uses. Verify the helper is
    // composable with applySeverityOverrides.
    const baseRule: Rule = {
      id: 'r1',
      severity: 'high',
      category: 'general',
      title: 'r1',
      explanation: '',
      citation: null,
      match: { type: 'regex', pattern: 'r1', flags: 'i' },
    };
    const override: Record<string, Severity> = { r1: 'low' };
    const resolved = applySeverityOverrides([baseRule], override);
    const resolvedSeverity = resolved[0]?.severity ?? 'medium';
    const leases = [
      makeLease('L1', [
        makeFinding({ ruleId: 'r1', severity: resolvedSeverity }),
      ]),
    ];
    const out = aggregateFindings(leases);
    expect(out[0]?.severityCounts.low).toBe(1);
    expect(out[0]?.severityCounts.high ?? 0).toBe(0);
  });
});

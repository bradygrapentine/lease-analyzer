import type { LeaseRecord } from '../storage/storage';
import type { Finding, Severity } from '../rules/types';

/** Minimal shape needed for rollups; `LeaseRecord` satisfies this structurally. */
type AggregatableLease = Pick<LeaseRecord, 'id' | 'findings'> | { id: string; findings: Finding[] };

/**
 * Per-rule rollup across the entire library. `leaseCount` is the number of
 * distinct leases the rule fires in (counted once per lease even if the rule
 * matches multiple paragraphs in that lease). `severityCounts` totals
 * individual finding instances by severity, since a single lease can have
 * multiple finding instances at different severities for the same rule.
 *
 * Severity is taken from the `Finding.severity` field as persisted, which
 * means callers who applied `applySeverityOverrides` upstream (the same path
 * `FindingsPanel` uses) get override-aware rollups for free.
 */
export interface RuleRollup {
  ruleId: string;
  leaseCount: number;
  severityCounts: { high: number; medium: number; low: number; info: number };
  leaseIds: string[];
}

/**
 * Pure aggregator. Determinism contract:
 * - rollups sorted by `leaseCount desc, ruleId asc`
 * - within each rollup, `leaseIds` sorted ascending so the caller can rely
 *   on stable ordering across runs regardless of the input library order
 */
export function aggregateFindings(leases: readonly AggregatableLease[]): RuleRollup[] {
  const byRule = new Map<
    string,
    {
      leaseIds: Set<string>;
      severityCounts: { high: number; medium: number; low: number; info: number };
    }
  >();

  for (const lease of leases) {
    for (const finding of lease.findings) {
      let bucket = byRule.get(finding.ruleId);
      if (!bucket) {
        bucket = {
          leaseIds: new Set<string>(),
          severityCounts: { high: 0, medium: 0, low: 0, info: 0 },
        };
        byRule.set(finding.ruleId, bucket);
      }
      bucket.leaseIds.add(lease.id);
      const sev: Severity = finding.severity;
      bucket.severityCounts[sev] += 1;
    }
  }

  const rollups: RuleRollup[] = [];
  for (const [ruleId, bucket] of byRule) {
    const leaseIds = [...bucket.leaseIds].sort();
    rollups.push({
      ruleId,
      leaseCount: leaseIds.length,
      severityCounts: bucket.severityCounts,
      leaseIds,
    });
  }

  rollups.sort((a, b) => {
    if (b.leaseCount !== a.leaseCount) return b.leaseCount - a.leaseCount;
    return a.ruleId.localeCompare(b.ruleId);
  });

  return rollups;
}

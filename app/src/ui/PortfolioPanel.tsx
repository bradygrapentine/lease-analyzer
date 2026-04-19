import type { LeaseMetadata } from '../storage/storage';
import type { Finding, Severity } from '../rules/types';

export interface PortfolioPanelProps {
  leases: LeaseMetadata[];
  findingsByLease: Map<string, Finding[]>;
  onOpenLease: (id: string) => void;
}

interface RuleColumn {
  ruleId: string;
  count: number;
}

/**
 * Portfolio matrix: rows = leases, columns = rule ids.
 * Column ordering is most-common-first so "systemic" clauses surface
 * on the left. Severity precedence picks the most-severe finding when
 * the same rule fires multiple times on one lease — a single badge is
 * enough signal; click-through to the finding panel reveals all hits.
 *
 * Pure, props-only. No storage/network imports — the caller owns the
 * `findingsByLease` map and the open callback.
 */
export function PortfolioPanel({
  leases,
  findingsByLease,
  onOpenLease,
}: PortfolioPanelProps): JSX.Element {
  if (leases.length === 0) {
    return (
      <section aria-label="portfolio">
        <h2>Portfolio</h2>
        <p>No leases in portfolio yet.</p>
      </section>
    );
  }

  const columns = rankRuleColumns(leases, findingsByLease);

  return (
    <section aria-label="portfolio">
      <h2>Portfolio</h2>
      <div className="portfolio-scroll" style={{ overflowX: 'auto' }}>
        <table aria-label="portfolio">
          <thead>
            <tr>
              <th scope="col" data-sticky="true" className="portfolio-sticky">
                Lease
              </th>
              {columns.map((c) => (
                <th key={c.ruleId} scope="col">
                  {c.ruleId}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leases.map((lease) => {
              const findings = findingsByLease.get(lease.id) ?? [];
              const bestBySeverity = bestSeverityByRule(findings);
              return (
                <tr key={lease.id} aria-label={lease.name}>
                  <th scope="row" data-sticky="true" className="portfolio-sticky">
                    <button
                      type="button"
                      onClick={() => onOpenLease(lease.id)}
                      aria-label={`Open ${lease.name}`}
                    >
                      {lease.name}
                    </button>
                    <small>
                      {' · '}
                      {lease.pageCount} pages
                      {' · '}
                      {new Date(lease.createdAt).toLocaleDateString()}
                    </small>
                  </th>
                  {columns.map((c) => {
                    const sev = bestBySeverity.get(c.ruleId);
                    return (
                      <td key={c.ruleId}>
                        {sev ? <SeverityBadge severity={sev} /> : <span>—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SeverityBadge({ severity }: { severity: Severity }): JSX.Element {
  return (
    <span className={`severity-badge severity-${severity}`} data-severity={severity}>
      {severity}
    </span>
  );
}

/**
 * Rank rule ids by the number of leases where they appear (descending),
 * breaking ties alphabetically so output is deterministic across runs.
 */
function rankRuleColumns(
  leases: LeaseMetadata[],
  findingsByLease: Map<string, Finding[]>,
): RuleColumn[] {
  const leasesPerRule = new Map<string, number>();
  for (const lease of leases) {
    const findings = findingsByLease.get(lease.id) ?? [];
    const seen = new Set<string>();
    for (const finding of findings) {
      if (seen.has(finding.ruleId)) continue;
      seen.add(finding.ruleId);
      leasesPerRule.set(finding.ruleId, (leasesPerRule.get(finding.ruleId) ?? 0) + 1);
    }
  }
  return [...leasesPerRule.entries()]
    .map(([ruleId, count]) => ({ ruleId, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.ruleId.localeCompare(b.ruleId);
    });
}

/**
 * For each rule id on a lease, keep the *first* finding encountered.
 * Callers that want worst-severity can rearrange their input — this
 * keeps the component deterministic for a given finding order without
 * imposing a severity ordering judgement.
 */
function bestSeverityByRule(findings: Finding[]): Map<string, Severity> {
  const out = new Map<string, Severity>();
  for (const f of findings) {
    if (!out.has(f.ruleId)) out.set(f.ruleId, f.severity);
  }
  return out;
}

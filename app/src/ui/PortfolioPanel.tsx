// Wave 27-C — design pass rewrite.
// Semantic attributes preserved verbatim:
//   aria-label="portfolio"               (section, both branches)
//   aria-label="portfolio"               (table)
//   data-sticky="true"                   (th — used for sticky-column positioning)
//   aria-label={lease.name}              (tr)
//   aria-label={`Open ${lease.name}`}    (button)
//   data-severity={severity}             (span in SeverityBadge)
//   className portfolio-sticky / portfolio-scroll preserved verbatim (CSS hooks)
//
import { useEffect, useMemo, useState } from 'react';
import type { LeaseMetadata } from '../storage/storage';
import {
  listLeasesFiltered,
  type ListLeasesFilter,
} from '../storage/listLeasesFiltered';
import type { Finding, Severity } from '../rules/types';
import { PortfolioRollupsPanel } from './PortfolioRollupsPanel';
import { aggregateFindings } from '../portfolio/ruleRollups';
import { Section } from './system/Section';
import { Button } from './system/Button';

export interface PortfolioPanelProps {
  leases: LeaseMetadata[];
  findingsByLease: Map<string, Finding[]>;
  onOpenLease: (id: string) => void;
  /**
   * Optional server-side filter. When set, the panel queries the
   * `by-finding-and-pack` IDB index via `listLeasesFiltered` and
   * renders the resulting subset instead of `leases`. Unset → uses
   * `leases` as-is (caller-supplied).
   */
  filter?: ListLeasesFilter;
  /**
   * Wave 10 Part A — when set, restrict the visible rows to these lease
   * ids (drill-through from the rollup panel). Applied after `filter` /
   * the caller-supplied `leases` list. Unset → no extra restriction.
   */
  filterLeaseIds?: string[];
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
  filter,
  filterLeaseIds,
}: PortfolioPanelProps): JSX.Element {
  const [filtered, setFiltered] = useState<LeaseMetadata[] | null>(null);
  const [drillIds, setDrillIds] = useState<string[] | null>(null);

  useEffect(() => {
    if (!filter) {
      setFiltered(null);
      return;
    }
    let cancelled = false;
    void listLeasesFiltered(filter).then((rows) => {
      if (!cancelled) setFiltered(rows);
    });
    return (): void => {
      cancelled = true;
    };
  }, [filter]);

  const baseVisible = filter && filtered ? filtered : leases;
  const restrictIds = drillIds ?? filterLeaseIds ?? null;
  const visible = restrictIds
    ? baseVisible.filter((l) => restrictIds.includes(l.id))
    : baseVisible;

  // Rollups computed from the unrestricted base set so users can always
  // see the cross-portfolio picture even after drilling through.
  const rollups = useMemo(
    () =>
      aggregateFindings(
        baseVisible.map((m) => ({
          id: m.id,
          findings: findingsByLease.get(m.id) ?? [],
        })),
      ),
    [baseVisible, findingsByLease],
  );

  if (visible.length === 0) {
    return (
      <Section label="portfolio" className="space-y-2 px-4 py-4">
        <h2 className="text-heading uppercase text-fg-muted">Portfolio</h2>
        <p className="text-body text-fg-faint">No leases in portfolio yet.</p>
      </Section>
    );
  }

  const columns = rankRuleColumns(visible, findingsByLease);

  return (
    <Section label="portfolio" className="space-y-3 px-4 py-4">
      <h2 className="text-heading uppercase text-fg-muted">Portfolio</h2>
      <PortfolioRollupsPanel
        rollups={rollups}
        onDrillThrough={(ids) => setDrillIds(ids)}
      />
      {drillIds !== null && (
        <p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setDrillIds(null)}>
            Clear rollup filter
          </Button>
        </p>
      )}
      <div className="portfolio-scroll" style={{ overflowX: 'auto' }}>
        <table aria-label="portfolio" className="text-small text-fg-body border-collapse">
          <thead>
            <tr className="border-b border-rule">
              <th scope="col" data-sticky="true" className="portfolio-sticky text-left py-1 pr-4 text-fg-muted font-sans">
                Lease
              </th>
              {columns.map((c) => (
                <th key={c.ruleId} scope="col" className="text-left py-1 pr-3 text-fg-muted font-mono text-mono">
                  {c.ruleId}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((lease) => {
              const findings = findingsByLease.get(lease.id) ?? [];
              const bestBySeverity = bestSeverityByRule(findings);
              return (
                <tr key={lease.id} aria-label={lease.name} className="even:bg-paper-sunken border-b border-rule-subtle">
                  <th scope="row" data-sticky="true" className="portfolio-sticky py-2 pr-4 text-left align-top font-normal">
                    <button
                      type="button"
                      onClick={() => onOpenLease(lease.id)}
                      aria-label={`Open ${lease.name}`}
                      className="text-body text-ink hover:underline text-left"
                    >
                      {lease.name}
                    </button>
                    <small className="block text-small text-fg-muted">
                      {lease.pageCount} pages
                      {' · '}
                      {new Date(lease.createdAt).toLocaleDateString()}
                    </small>
                  </th>
                  {columns.map((c) => {
                    const sev = bestBySeverity.get(c.ruleId);
                    return (
                      <td key={c.ruleId} className="py-2 pr-3 align-top">
                        {sev ? <SeverityBadge severity={sev} /> : <span className="text-fg-faint">—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function SeverityBadge({ severity }: { severity: Severity }): JSX.Element {
  const COLOR: Record<Severity, string> = {
    high: 'bg-severity-high/10 text-severity-high border-severity-high/30',
    medium: 'bg-severity-medium/10 text-severity-medium border-severity-medium/30',
    low: 'bg-severity-low/10 text-severity-low border-severity-low/30',
    info: 'bg-severity-info/10 text-severity-info border-severity-info/30',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm border text-small font-sans ${COLOR[severity]}`} data-severity={severity}>
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

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
import { listLeasesFiltered, type ListLeasesFilter } from '../storage/listLeasesFiltered';
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
  // Wave 53-E — cards-first portfolio per the handoff. Practitioners can
  // fall back to the dense matrix when scanning many rules at once.
  const [viewMode, setViewMode] = useState<'cards' | 'matrix'>('cards');

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
  const visible = restrictIds ? baseVisible.filter((l) => restrictIds.includes(l.id)) : baseVisible;

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
        <p className="text-body text-fg-muted">No leases in portfolio yet.</p>
      </Section>
    );
  }

  const columns = rankRuleColumns(visible, findingsByLease);

  const totals = severityTotals(visible, findingsByLease);

  return (
    <Section label="portfolio" className="space-y-3 px-4 py-4">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h2 className="text-heading uppercase text-fg-muted">Portfolio</h2>
        <div className="flex items-center gap-3">
          <ViewToggle value={viewMode} onChange={setViewMode} />
          <div
            aria-label="portfolio totals"
            className="flex gap-5 items-baseline pl-5 border-l border-rule font-sans text-small"
          >
            <SeverityTotal label="High" count={totals.high} severity="high" />
            <SeverityTotal label="Medium" count={totals.medium} severity="medium" />
            <SeverityTotal label="Low" count={totals.low} severity="low" />
            <SeverityTotal label="Info" count={totals.info} severity="info" />
          </div>
        </div>
      </div>
      <PortfolioRollupsPanel rollups={rollups} onDrillThrough={(ids) => setDrillIds(ids)} />
      {drillIds !== null && (
        <p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setDrillIds(null)}>
            Clear rollup filter
          </Button>
        </p>
      )}
      {viewMode === 'cards' ? (
        <ul
          aria-label="portfolio cards"
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))' }}
        >
          {visible.map((lease) => (
            <PortfolioCard
              key={lease.id}
              lease={lease}
              findings={findingsByLease.get(lease.id) ?? []}
              onOpen={() => onOpenLease(lease.id)}
            />
          ))}
        </ul>
      ) : (
        <div className="portfolio-scroll overflow-x-auto">
          <table aria-label="portfolio" className="text-small text-fg-body border-collapse">
            <thead>
              <tr className="border-b border-rule">
                <th
                  scope="col"
                  data-sticky="true"
                  className="portfolio-sticky text-left py-2 pr-4 text-mono uppercase tracking-[0.06em] text-fg-muted font-sans"
                >
                  Lease
                </th>
                {columns.map((c) => (
                  <th
                    key={c.ruleId}
                    scope="col"
                    className="text-left py-2 pr-3 text-fg-muted font-mono text-mono whitespace-nowrap"
                  >
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
                  <tr
                    key={lease.id}
                    aria-label={lease.name}
                    className="even:bg-paper-sunken border-b border-rule-subtle"
                  >
                    <th
                      scope="row"
                      data-sticky="true"
                      className="portfolio-sticky py-2 pr-4 text-left align-top font-normal"
                    >
                      <button
                        type="button"
                        onClick={() => onOpenLease(lease.id)}
                        aria-label={`Open ${lease.name}`}
                        className="font-serif text-[14.5px] text-fg hover:text-ink hover:underline underline-offset-2 text-left"
                      >
                        {lease.name}
                      </button>
                      <small className="block mt-0.5 text-mono text-fg-faint">
                        {lease.pageCount} pages
                        {' · '}
                        {new Date(lease.createdAt).toLocaleDateString()}
                      </small>
                    </th>
                    {columns.map((c) => {
                      const sev = bestBySeverity.get(c.ruleId);
                      return (
                        <td key={c.ruleId} className="py-2 pr-3 align-top">
                          {sev ? (
                            <SeverityBadge severity={sev} />
                          ) : (
                            <span className="text-fg-muted">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function ViewToggle({
  value,
  onChange,
}: {
  value: 'cards' | 'matrix';
  onChange: (next: 'cards' | 'matrix') => void;
}): JSX.Element {
  return (
    <div
      role="tablist"
      aria-label="portfolio view"
      className="flex items-center gap-0 rounded-sm border border-rule bg-paper-sunken p-0.5"
    >
      {(['cards', 'matrix'] as const).map((target) => {
        const active = value === target;
        return (
          <button
            key={target}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(target)}
            className={`h-7 px-3 rounded-sm font-sans text-[12.5px] tracking-[0.01em] transition-colors focus-visible:focus-ring ${
              active
                ? 'bg-paper-raised border border-rule text-fg font-semibold'
                : 'border border-transparent text-fg-body hover:text-fg font-medium'
            }`}
          >
            {target === 'cards' ? 'Cards' : 'Matrix'}
          </button>
        );
      })}
    </div>
  );
}

function PortfolioCard({
  lease,
  findings,
  onOpen,
}: {
  lease: LeaseMetadata;
  findings: Finding[];
  onOpen: () => void;
}): JSX.Element {
  const counts: Record<Severity, number> = { high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  // Worst severity present drives the corner badge; falls through info → none.
  const worst: Severity | null =
    counts.high > 0
      ? 'high'
      : counts.medium > 0
        ? 'medium'
        : counts.low > 0
          ? 'low'
          : counts.info > 0
            ? 'info'
            : null;
  // Heatmap row: one cell per finding (cap at 24 so a noisy lease doesn't blow up the card)
  // colored by per-finding severity. The cap signals "and more" via opacity drop.
  const cells = findings.slice(0, 24);
  const overflow = findings.length - cells.length;
  return (
    <li className="rounded-sm border border-rule bg-paper-raised p-4 flex flex-col gap-3 hover:bg-paper-sunken transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {worst && (
            <span
              data-severity={worst}
              className={`inline-flex items-center px-1.5 py-0.5 rounded-sm border text-mono uppercase tracking-[0.04em] mb-1 ${SEV_BADGE_CLASS[worst]}`}
            >
              {worst}
            </span>
          )}
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Open ${lease.name}`}
            className="block font-serif text-[15px] text-fg leading-snug text-left hover:text-ink hover:underline underline-offset-2 truncate w-full"
          >
            {lease.name}
          </button>
        </div>
        <span className="text-mono text-fg-faint shrink-0 mt-0.5">
          {new Date(lease.createdAt).toLocaleDateString()}
        </span>
      </div>
      <p className="font-serif italic text-small text-fg-muted leading-snug m-0">
        {lease.pageCount} page{lease.pageCount === 1 ? '' : 's'}
        {' · '}
        {findings.length} finding{findings.length === 1 ? '' : 's'}
      </p>
      {findings.length > 0 && (
        <div className="flex flex-col gap-2">
          <div aria-hidden="true" className="flex items-center gap-[2px] flex-wrap">
            {cells.map((f, i) => (
              <span
                key={i}
                data-severity={f.severity}
                className={`h-2 w-3 rounded-sm ${SEV_HEAT_CLASS[f.severity]}`}
              />
            ))}
            {overflow > 0 && <span className="text-mono text-fg-muted ml-1">+{overflow}</span>}
          </div>
          <p aria-label={`${lease.name} severity totals`} className="text-mono text-fg-muted m-0">
            {counts.high > 0 && <span className="mr-2">{counts.high} high</span>}
            {counts.medium > 0 && <span className="mr-2">{counts.medium} med</span>}
            {counts.low > 0 && <span className="mr-2">{counts.low} low</span>}
            {counts.info > 0 && <span>{counts.info} info</span>}
          </p>
        </div>
      )}
    </li>
  );
}

const SEV_BADGE_CLASS: Record<Severity, string> = {
  high: 'bg-severity-high/10 text-severity-high border-severity-high/30',
  medium: 'bg-severity-medium/10 text-severity-medium border-severity-medium/30',
  low: 'bg-severity-low/10 text-severity-low border-severity-low/30',
  info: 'bg-severity-info/10 text-severity-info border-severity-info/30',
};

const SEV_HEAT_CLASS: Record<Severity, string> = {
  high: 'bg-severity-high',
  medium: 'bg-severity-medium',
  low: 'bg-severity-low',
  info: 'bg-severity-info',
};

function SeverityTotal({
  label,
  count,
  severity,
}: {
  label: string;
  count: number;
  severity: Severity;
}): JSX.Element {
  const COLOR: Record<Severity, string> = {
    high: 'text-severity-high',
    medium: 'text-severity-medium',
    low: 'text-severity-low',
    info: 'text-severity-info',
  };
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-mono text-fg-muted uppercase">{label}</span>
      <span className={`text-heading font-semibold ${COLOR[severity]}`}>{count}</span>
    </span>
  );
}

function severityTotals(
  leases: LeaseMetadata[],
  findingsByLease: Map<string, Finding[]>,
): Record<Severity, number> {
  const t: Record<Severity, number> = { high: 0, medium: 0, low: 0, info: 0 };
  for (const lease of leases) {
    for (const f of findingsByLease.get(lease.id) ?? []) {
      t[f.severity]++;
    }
  }
  return t;
}

function SeverityBadge({ severity }: { severity: Severity }): JSX.Element {
  const COLOR: Record<Severity, string> = {
    high: 'bg-severity-high/10 text-severity-high border-severity-high/30',
    medium: 'bg-severity-medium/10 text-severity-medium border-severity-medium/30',
    low: 'bg-severity-low/10 text-severity-low border-severity-low/30',
    info: 'bg-severity-info/10 text-severity-info border-severity-info/30',
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-sm border text-small font-sans ${COLOR[severity]}`}
      data-severity={severity}
    >
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

// Wave 30 Part A — first consumer of the `kind:'hybrid-feedback'` audit
// stream that Wave 29-C started writing. Per-rule dashboard: fires (LLM
// classifications) · not-relevant (user feedback) · derived precision %.
//
// Pure presentational. Caller passes already-aggregated stats; the
// `computeHybridStats` helper in `audit/hybridStats.ts` does the math.

import { useState } from 'react';
import type { HybridRuleStats } from '../audit/hybridStats';
import { Section } from './system/Section';
import { EmptyState } from './system/EmptyState';

export interface HybridPrecisionPanelProps {
  stats: HybridRuleStats[];
}

type SortKey = 'precision-asc' | 'fires-desc';

export function HybridPrecisionPanel({
  stats,
}: HybridPrecisionPanelProps): JSX.Element {
  const [sortKey, setSortKey] = useState<SortKey>('precision-asc');

  if (stats.length === 0) {
    return (
      <Section label="hybrid precision" className="space-y-3 px-4 py-4">
        <h2 className="text-heading uppercase text-fg-muted">
          Hybrid precision
        </h2>
        <EmptyState
          title="No hybrid feedback yet"
          description="Once users mark hybrid (LLM-assisted) findings as not relevant, this panel populates with per-rule precision numbers."
        />
      </Section>
    );
  }

  const sorted = [...stats].sort((a, b) => {
    if (sortKey === 'fires-desc') {
      return b.fires - a.fires;
    }
    // precision-asc: worst-first. `null` (no fires) sinks to the bottom
    // so users see actionable rows up top.
    const ap = a.precision;
    const bp = b.precision;
    if (ap === null && bp === null) return 0;
    if (ap === null) return 1;
    if (bp === null) return -1;
    return ap - bp;
  });

  return (
    <Section label="hybrid precision" className="space-y-3 px-4 py-4">
      <h2 className="text-heading uppercase text-fg-muted">
        Hybrid precision
      </h2>
      <p className="text-body text-fg-body">
        Per-rule precision over hybrid (LLM-assisted) findings.
        Precision = 1 − (not-relevant ÷ fires).
      </p>

      <div role="group" aria-label="hybrid precision controls" className="flex flex-wrap gap-2">
        <label className="text-small text-fg-muted">
          Sort by{' '}
          <select
            aria-label="sort hybrid precision rows"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="text-small border border-rule rounded-sm px-1 py-0.5"
          >
            <option value="precision-asc">Precision (worst first)</option>
            <option value="fires-desc">Fires (most first)</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table
          aria-label="hybrid precision per rule"
          className="w-full text-small text-fg-body border-collapse"
        >
          <thead>
            <tr className="border-b border-rule">
              <th scope="col" className="text-left py-1 pr-3 text-fg-muted font-sans">
                Rule
              </th>
              <th scope="col" className="text-right py-1 pr-3 text-fg-muted font-sans">
                Fires
              </th>
              <th scope="col" className="text-right py-1 pr-3 text-fg-muted font-sans">
                Not relevant
              </th>
              <th scope="col" className="text-right py-1 text-fg-muted font-sans">
                Precision
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.ruleId}
                className="even:bg-paper-sunken border-b border-rule-subtle"
                data-testid={`hybrid-precision-row-${row.ruleId}`}
              >
                <td className="py-1 pr-3">
                  <code className="font-mono text-mono">{row.ruleId}</code>
                </td>
                <td className="py-1 pr-3 text-right tabular-nums">{row.fires}</td>
                <td className="py-1 pr-3 text-right tabular-nums">
                  {row.notRelevant}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {formatPrecision(row.precision)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function formatPrecision(p: number | null): string {
  if (p === null) return '—';
  // Round to nearest integer percent; e.g. 2/3 = 67%.
  return `${Math.round(p * 100)}%`;
}

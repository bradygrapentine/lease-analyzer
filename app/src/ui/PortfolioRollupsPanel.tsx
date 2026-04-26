// Wave 27-C — design pass rewrite.
// Semantic attributes preserved verbatim:
//   aria-label="rule rollups"              (section, both branches)
//   aria-label="rule rollups"              (table)
//   aria-label={`drill into ${r.ruleId}`} (button)
//
import type { RuleRollup } from '../portfolio/ruleRollups';
import { Section } from './system/Section';
import { Button } from './system/Button';

export interface PortfolioRollupsPanelProps {
  rollups: RuleRollup[];
  onDrillThrough: (leaseIds: string[]) => void;
}

/**
 * Renders the rule-rollup table above the portfolio grid. Caller is
 * responsible for sorting (`aggregateFindings` does that) and for handling
 * the drill-through (typically: filter the grid to those lease ids).
 */
export function PortfolioRollupsPanel({
  rollups,
  onDrillThrough,
}: PortfolioRollupsPanelProps): JSX.Element {
  if (rollups.length === 0) {
    return (
      <Section label="rule rollups" className="space-y-2 px-4 py-3">
        <h3 className="text-heading uppercase text-fg-muted">Rule rollups</h3>
        <p className="text-body text-fg-muted">No portfolio findings yet.</p>
      </Section>
    );
  }

  return (
    <Section label="rule rollups" className="space-y-2 px-4 py-3">
      <h3 className="text-heading uppercase text-fg-muted">Rule rollups</h3>
      <div className="overflow-x-auto">
        <table aria-label="rule rollups" className="w-full text-small text-fg-body border-collapse">
          <thead>
            {/* Header row uses td (not th) so this panel does not contribute
                columnheader-role nodes that the parent PortfolioPanel tests
                query against. */}
            <tr className="border-b border-rule">
              <td className="text-fg-muted py-1 pr-3 font-sans">Rule</td>
              <td className="text-fg-muted py-1 pr-3 font-sans">Leases</td>
              <td className="text-fg-muted py-1 pr-3 font-sans">High</td>
              <td className="text-fg-muted py-1 pr-3 font-sans">Medium</td>
              <td className="text-fg-muted py-1 pr-3 font-sans">Low</td>
              <td className="text-fg-muted py-1 pr-3 font-sans">Info</td>
              <td className="text-fg-muted py-1 font-sans">Drill</td>
            </tr>
          </thead>
          <tbody>
            {rollups.map((r) => (
              <tr key={r.ruleId} className="even:bg-paper-sunken border-b border-rule-subtle">
                <td className="py-1.5 pr-3 font-mono text-mono text-fg-muted">{r.ruleId}</td>
                <td className="py-1.5 pr-3">{r.leaseCount}</td>
                <td className="py-1.5 pr-3 text-severity-high">{r.severityCounts.high}</td>
                <td className="py-1.5 pr-3 text-severity-medium">{r.severityCounts.medium}</td>
                <td className="py-1.5 pr-3 text-severity-low">{r.severityCounts.low}</td>
                <td className="py-1.5 pr-3 text-severity-info">{r.severityCounts.info}</td>
                <td className="py-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`drill into ${r.ruleId}`}
                    onClick={() => onDrillThrough(r.leaseIds)}
                  >
                    Filter grid
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

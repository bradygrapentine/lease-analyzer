import type { RuleRollup } from '../portfolio/ruleRollups';

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
      <section aria-label="rule rollups">
        <h3>Rule rollups</h3>
        <p>No portfolio findings yet.</p>
      </section>
    );
  }

  return (
    <section aria-label="rule rollups">
      <h3>Rule rollups</h3>
      <table aria-label="rule rollups">
        <thead>
          {/* Header row uses td (not th) so this panel does not contribute
              columnheader-role nodes that the parent PortfolioPanel tests
              query against. */}
          <tr>
            <td>Rule</td>
            <td>Leases</td>
            <td>High</td>
            <td>Medium</td>
            <td>Low</td>
            <td>Info</td>
            <td>Drill</td>
          </tr>
        </thead>
        <tbody>
          {rollups.map((r) => (
            <tr key={r.ruleId}>
              <td>{r.ruleId}</td>
              <td>{r.leaseCount}</td>
              <td>{r.severityCounts.high}</td>
              <td>{r.severityCounts.medium}</td>
              <td>{r.severityCounts.low}</td>
              <td>{r.severityCounts.info}</td>
              <td>
                <button
                  type="button"
                  aria-label={`drill into ${r.ruleId}`}
                  onClick={() => onDrillThrough(r.leaseIds)}
                >
                  Filter grid
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

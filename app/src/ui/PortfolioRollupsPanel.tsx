// Wave 10 Part A — implementation pending. Tests import from this module.
import type { RuleRollup } from '../portfolio/ruleRollups';

export interface PortfolioRollupsPanelProps {
  rollups: RuleRollup[];
  onDrillThrough: (leaseIds: string[]) => void;
}

export function PortfolioRollupsPanel(
  _props: PortfolioRollupsPanelProps,
): JSX.Element {
  throw new Error('PortfolioRollupsPanel: not implemented');
}

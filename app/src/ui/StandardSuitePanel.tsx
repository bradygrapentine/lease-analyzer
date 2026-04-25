// Wave 10 Part C — implementation pending.
import type { StandardClause } from '../clauseStandard/standardSuite';

export interface StandardSuitePanelProps {
  standards: StandardClause[];
  onDelete: (id: string) => void;
}

export function StandardSuitePanel(
  _props: StandardSuitePanelProps,
): JSX.Element {
  throw new Error('StandardSuitePanel: not implemented');
}

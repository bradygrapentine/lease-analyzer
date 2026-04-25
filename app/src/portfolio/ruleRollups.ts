// Wave 10 Part A — implementation pending. Tests import from this module.
export interface RuleRollup {
  ruleId: string;
  leaseCount: number;
  severityCounts: { high: number; medium: number; low: number; info: number };
  leaseIds: string[];
}
export const aggregateFindings = (..._args: unknown[]): RuleRollup[] => {
  throw new Error('aggregateFindings: not implemented');
};

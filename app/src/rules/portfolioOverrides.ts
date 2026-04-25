// Wave 10 Part D — implementation pending.
// Resolution order: lease-scope > portfolio-scope > pack default.
import type { Severity } from './types';

export type OverrideScope = 'lease' | 'portfolio';

export interface ScopedOverrideEntry {
  ruleId: string;
  severity: Severity;
  scope: OverrideScope;
  /** Required when scope === 'lease'; ignored when 'portfolio'. */
  leaseId?: string;
}

export const resolveSeverity = (
  _ruleId: string,
  _packDefault: Severity,
  _entries: ScopedOverrideEntry[],
  _opts: { leaseId: string },
): Severity => {
  throw new Error('resolveSeverity: not implemented');
};

export const migrateLegacyOverrides = (
  _legacy: Record<string, Severity>,
): ScopedOverrideEntry[] => {
  throw new Error('migrateLegacyOverrides: not implemented');
};

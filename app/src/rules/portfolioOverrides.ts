// Wave 10 Part D — portfolio-scope severity overrides.
//
// Resolution order (highest → lowest priority):
//   1. lease-scope override matching (ruleId, leaseId)
//   2. portfolio-scope override matching ruleId (any lease)
//   3. pack default severity
//
// Storage encoding (see `packStorage.getSeverityOverrides` extension):
//   The pre-Wave-10 record stored at SETTINGS[KEY_SEVERITY_OVERRIDES] is a
//   flat `Record<ruleId, Severity>`. To avoid an IDB schema bump we keep that
//   record as the *portfolio-scope* map (legacy rows are implicitly portfolio-
//   scope per `migrateLegacyOverrides`), and store lease-scope rows under a
//   sibling key whose value is `Record<leaseId, Record<ruleId, Severity>>`.
//   The schema version stays at v4; new keys live in the existing SETTINGS
//   store. Reads of legacy data treat absent scope as portfolio.
import type { Severity } from './types';

export type OverrideScope = 'lease' | 'portfolio';

export interface ScopedOverrideEntry {
  ruleId: string;
  severity: Severity;
  scope: OverrideScope;
  /** Required when scope === 'lease'; ignored when 'portfolio'. */
  leaseId?: string;
}

/**
 * Resolve the effective severity for a rule given a flat list of scoped
 * override entries plus the pack-default severity. Pure function, no I/O.
 */
export const resolveSeverity = (
  ruleId: string,
  packDefault: Severity,
  entries: readonly ScopedOverrideEntry[],
  opts: { leaseId: string },
): Severity => {
  let portfolioHit: Severity | undefined;
  for (const e of entries) {
    if (e.ruleId !== ruleId) continue;
    if (e.scope === 'lease' && e.leaseId === opts.leaseId) {
      // Lease-scope is highest priority — short-circuit.
      return e.severity;
    }
    if (e.scope === 'portfolio') {
      portfolioHit = e.severity;
    }
  }
  return portfolioHit ?? packDefault;
};

/**
 * Migrate the pre-Wave-10 flat override map (no scope concept) into scoped
 * entries. Pre-existing user overrides were effectively global / cross-lease,
 * so they map to portfolio-scope.
 */
export const migrateLegacyOverrides = (
  legacy: Readonly<Record<string, Severity>>,
): ScopedOverrideEntry[] => {
  const out: ScopedOverrideEntry[] = [];
  for (const [ruleId, severity] of Object.entries(legacy)) {
    out.push({ ruleId, severity, scope: 'portfolio' });
  }
  return out;
};

/**
 * Build a `Record<ruleId, Severity>` resolver map for a single lease, suitable
 * for handing to `applySeverityOverrides`. Lease-scope wins over portfolio-
 * scope; rules with no entry are omitted (caller falls back to pack default).
 */
export const buildResolverMapForLease = (
  entries: readonly ScopedOverrideEntry[],
  leaseId: string,
): Record<string, Severity> => {
  const portfolio: Record<string, Severity> = {};
  const lease: Record<string, Severity> = {};
  for (const e of entries) {
    if (e.scope === 'portfolio') {
      portfolio[e.ruleId] = e.severity;
    } else if (e.scope === 'lease' && e.leaseId === leaseId) {
      lease[e.ruleId] = e.severity;
    }
  }
  return { ...portfolio, ...lease };
};

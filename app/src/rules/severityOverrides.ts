import type { Rule, Severity } from './types';

/**
 * Apply per-user severity overrides. Each `overrides[ruleId]` replaces the
 * `severity` on the rule with matching id; every other field is preserved.
 *
 * Returns a fresh array; input rules are not mutated. Overrides whose id
 * does not appear in the rule set are silently ignored — that's a valid
 * state after a pack is uninstalled.
 */
export function applySeverityOverrides(
  rules: readonly Rule[],
  overrides: Readonly<Record<string, Severity>>,
): Rule[] {
  return rules.map((r) => {
    const next = overrides[r.id];
    if (next === undefined) return r;
    return { ...r, severity: next };
  });
}

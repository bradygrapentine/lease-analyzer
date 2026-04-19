import type { Severity } from '../rules/types';
import type { OverrideSeverity } from './SeverityOverridesPanel';

/**
 * `SeverityOverridesPanel` speaks a 3-bucket severity union (`info|warn|error`)
 * because it was designed against a generic "severity" concept, while the real
 * `Rule.severity` union is 4-bucket (`high|medium|low|info`). Rather than
 * widen the panel's types, we bridge at the edge in App.
 *
 * Mapping (Rule → Panel):
 *   high   → error
 *   medium → warn
 *   low    → warn   (low/medium both collapse to "warn" in the coarser UI)
 *   info   → info
 *
 * Mapping (Panel → Rule) is the natural inverse:
 *   error → high
 *   warn  → medium
 *   info  → info
 *
 * This is lossy by design: low-severity rules, when overridden via the UI,
 * round-trip to `medium`. That's acceptable because the override explicitly
 * expresses the user's new intent, not the original built-in level.
 */
export function severityToOverride(severity: Severity): OverrideSeverity {
  switch (severity) {
    case 'high':
      return 'error';
    case 'medium':
      return 'warn';
    case 'low':
      return 'warn';
    case 'info':
      return 'info';
  }
}

export function overrideToSeverity(override: OverrideSeverity): Severity {
  switch (override) {
    case 'error':
      return 'high';
    case 'warn':
      return 'medium';
    case 'info':
      return 'info';
  }
}

/** Bulk-convert a persisted overrides map (Severity) into panel shape. */
export function overridesToPanel(
  overrides: Readonly<Record<string, Severity>>,
): Record<string, OverrideSeverity> {
  const out: Record<string, OverrideSeverity> = {};
  for (const [id, sev] of Object.entries(overrides)) {
    out[id] = severityToOverride(sev);
  }
  return out;
}

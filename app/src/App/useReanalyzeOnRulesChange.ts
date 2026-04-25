import { useEffect, useRef } from 'react';
import type { Severity } from '../rules/types';
import type { RulePackFile } from '../rules/packSchema';

export interface UseReanalyzeOnRulesChangeArgs {
  /** Pipeline status — used so we no-op while no document is loaded. */
  statusKind: 'idle' | 'loading' | 'analyzed' | 'error';
  /** Imperative reanalyze trigger from `usePipeline`. */
  reanalyze: () => void;
  /** Inputs that determine the active rule set. Order-insensitive. */
  installedPacks: RulePackFile[];
  enabledPackIds: ReadonlySet<string>;
  selectedJurisdictions: readonly string[];
  severityOverrides: Readonly<Record<string, Severity>>;
}

/**
 * Auto-reanalyze the currently-loaded lease whenever the inputs to
 * `resolveActiveRules` change. Replaces the three manual `pipeline.reanalyze()`
 * call sites that previously had to be remembered after every rule-affecting
 * mutation (jurisdiction toggle, severity override, custom rule save).
 *
 * Why a content-fingerprint instead of `[activeRules]` itself: `activeRules`
 * is a new array each render (the upstream `useMemo` keys partially on a
 * non-memoized base list), so a direct dependency would loop forever once
 * `reanalyze` runs and bumps state.
 */
export function useReanalyzeOnRulesChange({
  statusKind,
  reanalyze,
  installedPacks,
  enabledPackIds,
  selectedJurisdictions,
  severityOverrides,
}: UseReanalyzeOnRulesChangeArgs): void {
  const fingerprint = fingerprintRuleInputs({
    installedPacks,
    enabledPackIds,
    selectedJurisdictions,
    severityOverrides,
  });
  const lastFingerprint = useRef<string | null>(null);

  useEffect(() => {
    const previous = lastFingerprint.current;
    lastFingerprint.current = fingerprint;
    if (previous === null) return; // first run — skip
    if (previous === fingerprint) return; // statusKind changed but rules didn't
    if (statusKind !== 'analyzed') return; // nothing to reanalyze yet
    reanalyze();
  }, [fingerprint, statusKind, reanalyze]);
}

interface FingerprintArgs {
  installedPacks: RulePackFile[];
  enabledPackIds: ReadonlySet<string>;
  selectedJurisdictions: readonly string[];
  severityOverrides: Readonly<Record<string, Severity>>;
}

function fingerprintRuleInputs(args: FingerprintArgs): string {
  const packIds = args.installedPacks
    .map((p) => `${p.id}@${p.version}`)
    .sort()
    .join(',');
  const enabled = Array.from(args.enabledPackIds).sort().join(',');
  const jurisdictions = [...args.selectedJurisdictions].sort().join(',');
  const overrideEntries = Object.entries(args.severityOverrides)
    .map(([k, v]) => `${k}:${v}`)
    .sort()
    .join(',');
  return `${packIds}|${enabled}|${jurisdictions}|${overrideEntries}`;
}

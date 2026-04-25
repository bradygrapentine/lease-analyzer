import { useEffect, useRef } from 'react';
import type { Rule } from '../rules/types';

export interface UseReanalyzeOnRulesChangeDeps {
  /** Currently active rule array. Identity changes drive reanalysis. */
  activeRules: Rule[];
  /** Reanalyze trigger — typically `pipeline.reanalyze` from `usePipeline`. */
  reanalyze: () => void;
}

/**
 * Auto-trigger pipeline reanalysis when the active rule set changes.
 *
 * Replaces every manual `pipeline.reanalyze()` call site (jurisdiction
 * picker, severity overrides, custom-rule save). The skip-first-mount
 * guard avoids a redundant analyze right after `usePipeline.upload`
 * already produced findings against the same rule set.
 *
 * Identity, not deep equality, is the trigger — `activeRules` should be
 * memoized in `usePackManager` so unrelated re-renders don't churn the
 * analysis worker.
 */
export function useReanalyzeOnRulesChange(
  deps: UseReanalyzeOnRulesChangeDeps,
): void {
  const { activeRules, reanalyze } = deps;
  const previousRef = useRef<Rule[] | null>(null);

  useEffect(() => {
    if (previousRef.current === null) {
      // Initial mount: record the rules but do NOT trigger reanalyze. The
      // pipeline already analyzed against this exact rule set on upload.
      previousRef.current = activeRules;
      return;
    }
    if (previousRef.current === activeRules) return;
    previousRef.current = activeRules;
    reanalyze();
  }, [activeRules, reanalyze]);
}

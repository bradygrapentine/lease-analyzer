import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReanalyzeOnRulesChange } from './useReanalyzeOnRulesChange';
import type { Rule } from '../rules/types';

function rule(id: string): Rule {
  return {
    id,
    severity: 'low',
    category: 'general',
    title: id,
    explanation: '',
    citation: null,
    match: { type: 'keywordProximity', keywords: [id], window: 10 },
  };
}

describe('useReanalyzeOnRulesChange', () => {
  it('does not call reanalyze on initial mount', () => {
    const reanalyze = vi.fn();
    const initialRules = [rule('a'), rule('b')];
    renderHook(
      ({ rules }: { rules: Rule[] }) =>
        useReanalyzeOnRulesChange({ activeRules: rules, reanalyze }),
      { initialProps: { rules: initialRules } },
    );
    expect(reanalyze).not.toHaveBeenCalled();
  });

  it('fires exactly once when the rules array identity changes (jurisdiction toggle)', () => {
    const reanalyze = vi.fn();
    const initialRules = [rule('a')];
    const { rerender } = renderHook(
      ({ rules }: { rules: Rule[] }) =>
        useReanalyzeOnRulesChange({ activeRules: rules, reanalyze }),
      { initialProps: { rules: initialRules } },
    );
    expect(reanalyze).not.toHaveBeenCalled();
    // Re-render with a fresh array (simulates jurisdictions filter producing new identity).
    rerender({ rules: [rule('a'), rule('b')] });
    expect(reanalyze).toHaveBeenCalledTimes(1);
    // Re-rendering with the SAME identity must not re-fire.
    const stable = [rule('a'), rule('b')];
    rerender({ rules: stable });
    rerender({ rules: stable });
    expect(reanalyze).toHaveBeenCalledTimes(2);
  });

  it('unmounting between rule changes is safe and does not throw', () => {
    const reanalyze = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ rules }: { rules: Rule[] }) =>
        useReanalyzeOnRulesChange({ activeRules: rules, reanalyze }),
      { initialProps: { rules: [rule('a')] } },
    );
    rerender({ rules: [rule('a'), rule('b')] });
    expect(reanalyze).toHaveBeenCalledTimes(1);
    expect(() => unmount()).not.toThrow();
    // After unmount, no further calls.
    expect(reanalyze).toHaveBeenCalledTimes(1);
  });
});

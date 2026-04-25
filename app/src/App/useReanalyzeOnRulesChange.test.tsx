import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useReanalyzeOnRulesChange } from './useReanalyzeOnRulesChange';
import type { RulePackFile } from '../rules/packSchema';

function harness(initial: {
  statusKind: 'idle' | 'analyzed';
  installedPacks?: RulePackFile[];
  enabledPackIds?: Set<string>;
  selectedJurisdictions?: string[];
  severityOverrides?: Record<string, 'low' | 'medium' | 'high'>;
}) {
  const reanalyze = vi.fn();
  const { rerender, unmount } = renderHook(
    (args: typeof initial) =>
      useReanalyzeOnRulesChange({
        statusKind: args.statusKind,
        reanalyze,
        installedPacks: args.installedPacks ?? [],
        enabledPackIds: args.enabledPackIds ?? new Set(),
        selectedJurisdictions: args.selectedJurisdictions ?? [],
        severityOverrides: args.severityOverrides ?? {},
      }),
    { initialProps: initial },
  );
  return { reanalyze, rerender, unmount };
}

describe('useReanalyzeOnRulesChange', () => {
  it('does not reanalyze on initial mount (idle)', () => {
    const { reanalyze } = harness({ statusKind: 'idle' });
    expect(reanalyze).not.toHaveBeenCalled();
  });

  it('does not reanalyze on initial mount (already analyzed)', () => {
    // Edge case: hook mounts in an analyzed state (e.g. lease opened from
    // library before this guard existed). First-run skip prevents redundant
    // analyze on mount.
    const { reanalyze } = harness({ statusKind: 'analyzed' });
    expect(reanalyze).not.toHaveBeenCalled();
  });

  it('reanalyzes once when jurisdictions change while analyzed', () => {
    const { reanalyze, rerender } = harness({ statusKind: 'analyzed' });
    expect(reanalyze).not.toHaveBeenCalled();
    act(() => {
      rerender({ statusKind: 'analyzed', selectedJurisdictions: ['US-CA'] });
    });
    expect(reanalyze).toHaveBeenCalledTimes(1);
  });

  it('reanalyzes when severity overrides change', () => {
    const { reanalyze, rerender } = harness({ statusKind: 'analyzed' });
    act(() => {
      rerender({
        statusKind: 'analyzed',
        severityOverrides: { 'rule-1': 'high' },
      });
    });
    expect(reanalyze).toHaveBeenCalledTimes(1);
  });

  it('reanalyzes when an installed pack is toggled', () => {
    const pack: RulePackFile = {
      schema: 'leaseguard.rulepack.v1',
      id: 'pack-a',
      name: 'A',
      version: '1.0.0',
      description: 'test',
      rules: [],
    };
    const { reanalyze, rerender } = harness({
      statusKind: 'analyzed',
      installedPacks: [pack],
      enabledPackIds: new Set(),
    });
    act(() => {
      rerender({
        statusKind: 'analyzed',
        installedPacks: [pack],
        enabledPackIds: new Set(['pack-a']),
      });
    });
    expect(reanalyze).toHaveBeenCalledTimes(1);
  });

  it('does not reanalyze when status is not analyzed', () => {
    const { reanalyze, rerender } = harness({ statusKind: 'idle' });
    act(() => {
      rerender({ statusKind: 'idle', selectedJurisdictions: ['US-CA'] });
    });
    expect(reanalyze).not.toHaveBeenCalled();
  });

  it('coalesces unrelated re-renders (no churn)', () => {
    const { reanalyze, rerender } = harness({
      statusKind: 'analyzed',
      selectedJurisdictions: ['US-CA'],
    });
    // Re-render with same args (different object identity, same content)
    act(() => {
      rerender({
        statusKind: 'analyzed',
        selectedJurisdictions: ['US-CA'],
      });
    });
    act(() => {
      rerender({
        statusKind: 'analyzed',
        selectedJurisdictions: ['US-CA'],
      });
    });
    expect(reanalyze).not.toHaveBeenCalled();
  });

  it('is order-insensitive on inputs', () => {
    const { reanalyze, rerender } = harness({
      statusKind: 'analyzed',
      selectedJurisdictions: ['US-CA', 'US-NY'],
    });
    act(() => {
      rerender({
        statusKind: 'analyzed',
        selectedJurisdictions: ['US-NY', 'US-CA'],
      });
    });
    expect(reanalyze).not.toHaveBeenCalled();
  });

  it('survives unmount between rule changes', () => {
    const { unmount } = harness({ statusKind: 'analyzed' });
    expect(() => unmount()).not.toThrow();
  });
});

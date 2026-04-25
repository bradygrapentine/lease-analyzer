import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { usePackManager } from './usePackManager';
import { _resetPacksDbForTests, openPacksDb } from '../rules/packStorage';

beforeEach(async () => {
  try {
    (await openPacksDb()).close();
  } catch {
    // ignore
  }
  _resetPacksDbForTests();
  await new Promise<void>((r) => setTimeout(r, 0));
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('leaseguard-packs');
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => resolve();
    req.onblocked = (): void => resolve();
  });
});

function makePackFile(text: string): File {
  return new File([text], 'pack.lgpack.json', { type: 'application/json' });
}

describe('usePackManager', () => {
  it('initial state has no installed packs and resolves the built-in rules', async () => {
    const { result } = renderHook(() => usePackManager());
    await waitFor(() => {
      expect(result.current.installedPacks).toEqual([]);
    });
    expect(result.current.enabledPacks.size).toBe(0);
    expect(result.current.activeRules.length).toBeGreaterThan(0);
    expect(result.current.existingRuleIds.length).toBeGreaterThan(0);
    expect(result.current.packDiff).toBeNull();
  });

  it('importPackFile rejects an invalid pack and surfaces the error', async () => {
    const audit = vi.fn(async () => undefined);
    const onAuditMutation = vi.fn();
    const { result } = renderHook(() =>
      usePackManager({ audit, onAuditMutation }),
    );
    await waitFor(() => {
      expect(result.current.installedPacks).toEqual([]);
    });
    const bad = makePackFile(JSON.stringify({ not: 'a pack' }));
    await expect(
      act(async () => {
        await result.current.importPackFile(bad);
      }),
    ).rejects.toThrow(/Invalid pack/);
  });

  it('saveCustomRule installs and enables a derived pack and audits', async () => {
    const audit = vi.fn(async () => undefined);
    const { result } = renderHook(() => usePackManager({ audit }));
    await waitFor(() => {
      expect(result.current.installedPacks).toEqual([]);
    });
    await act(async () => {
      await result.current.saveCustomRule({
        id: 'custom-rule-1',
        title: 'Custom 1',
        severity: 'medium',
        category: 'general',
        explanation: 'why',
        citation: null,
        match: { type: 'keywordProximity', keywords: ['foo'], window: 10 },
      });
    });
    expect(result.current.installedPacks).toHaveLength(1);
    expect(result.current.enabledPacks.has('custom-custom-rule-1')).toBe(true);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'custom-rule-save' }),
    );
  });
});

import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { useCounterOffers } from './useCounterOffers';
import {
  _resetCountersDbForTests,
  openCountersDb,
} from '../negotiation/counterOffers';

async function wipe(): Promise<void> {
  try {
    const db = await openCountersDb();
    db.close();
  } catch {
    // ignore
  }
  _resetCountersDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('leaseguard-counters');
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => resolve();
    req.onblocked = (): void => resolve();
  });
}

beforeEach(async () => {
  await wipe();
});

describe('useCounterOffers', () => {
  it('starts empty and loads from storage', async () => {
    const { result } = renderHook(() => useCounterOffers());
    await waitFor(() => {
      expect(result.current.counterOffers).toEqual([]);
    });
    expect(result.current.latestTextByRuleId).toEqual({});
  });

  it('saves and exposes the entry', async () => {
    const { result } = renderHook(() => useCounterOffers());
    await act(async () => {
      await result.current.save('rule-1', 'My version', 'replacement text');
    });
    expect(result.current.counterOffers).toHaveLength(1);
    expect(result.current.latestTextByRuleId['rule-1']).toBe('replacement text');
  });

  it('latestTextByRuleId picks the most recently saved entry per ruleId', async () => {
    const { result } = renderHook(() => useCounterOffers());
    await act(async () => {
      await result.current.save('rule-1', 'first', 'old text');
    });
    // Force a strictly-later updatedAt so the timestamp tiebreak is deterministic
    await new Promise((r) => setTimeout(r, 5));
    await act(async () => {
      await result.current.save('rule-1', 'second', 'new text');
    });
    expect(result.current.latestTextByRuleId['rule-1']).toBe('new text');
  });

  it('removes an entry', async () => {
    const { result } = renderHook(() => useCounterOffers());
    await act(async () => {
      await result.current.save('rule-1', 'doomed', 'goodbye');
    });
    const id = result.current.counterOffers[0]?.id;
    expect(id).toBeDefined();
    await act(async () => {
      await result.current.remove(id!);
    });
    expect(result.current.counterOffers).toHaveLength(0);
    expect(result.current.latestTextByRuleId).toEqual({});
  });
});

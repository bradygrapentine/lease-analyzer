import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useCounterOffers } from './useCounterOffers';
import { _resetCountersDbForTests, openCountersDb } from '../negotiation/counterOffers';
import { at } from '../test/assert';

beforeEach(async () => {
  try {
    (await openCountersDb()).close();
  } catch {
    // ignore
  }
  _resetCountersDbForTests();
  await new Promise<void>((r) => setTimeout(r, 0));
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('leaseguard-counters');
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => resolve();
    req.onblocked = (): void => resolve();
  });
});

describe('useCounterOffers', () => {
  it('initial mount loads empty list, save adds an entry', async () => {
    const { result } = renderHook(() => useCounterOffers());
    await waitFor(() => {
      expect(result.current.counterOffers).toEqual([]);
    });
    await act(async () => {
      await result.current.save('rule-1', 'My counter', 'Some text');
    });
    expect(result.current.counterOffers).toHaveLength(1);
    expect(at(result.current.counterOffers, 0).ruleId).toBe('rule-1');
  });

  it('remove deletes the saved counter offer', async () => {
    const { result } = renderHook(() => useCounterOffers());
    await waitFor(() => {
      expect(result.current.counterOffers).toEqual([]);
    });
    await act(async () => {
      await result.current.save('rule-x', 'A', 'aa');
    });
    await waitFor(() => {
      expect(result.current.counterOffers).toHaveLength(1);
    });
    const id = at(result.current.counterOffers, 0).id;
    await act(async () => {
      await result.current.remove(id);
    });
    expect(result.current.counterOffers).toEqual([]);
  });
});

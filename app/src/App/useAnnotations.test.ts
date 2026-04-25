import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAnnotations } from './useAnnotations';
import { _resetAnnotationsDbForTests, openAnnotationsDb } from '../annotations/annotations';
import { at } from '../test/assert';

beforeEach(async () => {
  try {
    (await openAnnotationsDb()).close();
  } catch {
    // ignore
  }
  _resetAnnotationsDbForTests();
  await new Promise<void>((r) => setTimeout(r, 0));
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('leaseguard-annotations');
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => resolve();
    req.onblocked = (): void => resolve();
  });
});

describe('useAnnotations', () => {
  it('saves and lists annotations for a lease', async () => {
    const { result } = renderHook(() => useAnnotations('lease-1'));
    await waitFor(() => {
      expect(result.current.annotations).toEqual([]);
    });
    await act(async () => {
      await result.current.save({
        leaseId: 'lease-1',
        paragraphIndex: 3,
        text: 'note one',
      });
    });
    expect(result.current.annotations).toHaveLength(1);
    expect(at(result.current.annotations, 0).text).toBe('note one');
  });

  it('clears annotations when leaseId becomes null', async () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useAnnotations(id),
      { initialProps: { id: 'lease-A' as string | null } },
    );
    await waitFor(() => {
      expect(result.current.annotations).toEqual([]);
    });
    await act(async () => {
      await result.current.save({
        leaseId: 'lease-A',
        paragraphIndex: 0,
        text: 'x',
      });
    });
    expect(result.current.annotations).toHaveLength(1);
    rerender({ id: null });
    await waitFor(() => {
      expect(result.current.annotations).toEqual([]);
    });
  });
});

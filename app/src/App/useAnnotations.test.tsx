import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { useAnnotations } from './useAnnotations';
import {
  _resetAnnotationsDbForTests,
  listAnnotations,
  openAnnotationsDb,
} from '../annotations/annotations';

async function wipe(): Promise<void> {
  try {
    const db = await openAnnotationsDb();
    db.close();
  } catch {
    // ignore
  }
  _resetAnnotationsDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('leaseguard-annotations');
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => resolve();
    req.onblocked = (): void => resolve();
  });
}

beforeEach(async () => {
  await wipe();
});

describe('useAnnotations', () => {
  it('returns empty list when leaseId is null', async () => {
    const { result } = renderHook(() => useAnnotations(null));
    await waitFor(() => {
      expect(result.current.annotations).toEqual([]);
    });
  });

  it('loads annotations when leaseId is provided', async () => {
    const { result } = renderHook(() => useAnnotations('lease-1'));
    await act(async () => {
      await result.current.saveForParagraph(0, 'first note');
    });
    await waitFor(() => {
      expect(result.current.annotations).toHaveLength(1);
    });
    expect(result.current.annotations[0]?.text).toBe('first note');
  });

  it('updates an annotation in place', async () => {
    const { result } = renderHook(() => useAnnotations('lease-1'));
    await act(async () => {
      await result.current.saveForParagraph(0, 'before');
    });
    const id = result.current.annotations[0]?.id;
    expect(id).toBeDefined();
    await act(async () => {
      await result.current.update(id!, 'after');
    });
    expect(result.current.annotations[0]?.text).toBe('after');
  });

  it('removes an annotation', async () => {
    const { result } = renderHook(() => useAnnotations('lease-1'));
    await act(async () => {
      await result.current.saveForParagraph(0, 'will be deleted');
    });
    const id = result.current.annotations[0]?.id;
    await act(async () => {
      await result.current.remove(id!);
    });
    expect(result.current.annotations).toHaveLength(0);
  });

  it('saveForParagraph is a no-op when leaseId is null', async () => {
    const { result } = renderHook(() => useAnnotations(null));
    await act(async () => {
      await result.current.saveForParagraph(0, 'orphan');
    });
    // Storage should not have received the write
    expect(await listAnnotations('lease-anything')).toEqual([]);
  });

  it('clears annotations when leaseId becomes null', async () => {
    const { result, rerender } = renderHook(
      (id: string | null) => useAnnotations(id),
      { initialProps: 'lease-1' as string | null },
    );
    await act(async () => {
      await result.current.saveForParagraph(0, 'note');
    });
    expect(result.current.annotations).toHaveLength(1);
    rerender(null);
    await waitFor(() => {
      expect(result.current.annotations).toEqual([]);
    });
  });
});

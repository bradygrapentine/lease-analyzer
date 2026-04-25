import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useRedlineState } from './useRedlineState';
import { _resetRedlineDbForTests, openRedlineDb } from '../redline/redlineStorage';
import { at } from '../test/assert';

beforeEach(async () => {
  try {
    (await openRedlineDb()).close();
  } catch {
    // ignore
  }
  _resetRedlineDbForTests();
  await new Promise<void>((r) => setTimeout(r, 0));
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('leaseguard-redlines');
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => resolve();
    req.onblocked = (): void => resolve();
  });
});

describe('useRedlineState', () => {
  it('editParagraph saves and audits, deleteParagraphEdit removes', async () => {
    const audit = vi.fn(async () => undefined);
    const onAuditMutation = vi.fn();
    const { result } = renderHook(() =>
      useRedlineState({ leaseId: 'lease-1', audit, onAuditMutation }),
    );
    await waitFor(() => {
      expect(result.current.redlineEdits).toEqual([]);
    });
    await act(async () => {
      await result.current.editParagraph({
        paragraphIndex: 5,
        before: 'old',
        after: 'new',
        ruleId: 'r',
      });
    });
    expect(result.current.redlineEdits).toHaveLength(1);
    expect(at(result.current.redlineEdits, 0).after).toBe('new');
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'redline-edit' }),
    );
    expect(onAuditMutation).toHaveBeenCalled();

    await act(async () => {
      await result.current.deleteParagraphEdit(5);
    });
    expect(result.current.redlineEdits).toEqual([]);
  });

  it('clears edits when leaseId becomes null', async () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useRedlineState({ leaseId: id }),
      { initialProps: { id: 'L' as string | null } },
    );
    await waitFor(() => {
      expect(result.current.redlineEdits).toEqual([]);
    });
    await act(async () => {
      await result.current.editParagraph({
        paragraphIndex: 1,
        before: 'a',
        after: 'b',
      });
    });
    expect(result.current.redlineEdits).toHaveLength(1);
    rerender({ id: null });
    await waitFor(() => {
      expect(result.current.redlineEdits).toEqual([]);
    });
  });
});

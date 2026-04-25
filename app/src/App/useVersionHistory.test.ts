import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useVersionHistory } from './useVersionHistory';
import {
  _resetVersionsDbForTests,
  openVersionsDb,
} from '../negotiation/versionHistory';
import {
  _resetRedlineDbForTests,
  openRedlineDb,
  saveEdit,
} from '../redline/redlineStorage';
import { at } from '../test/assert';

beforeEach(async () => {
  try {
    (await openVersionsDb()).close();
  } catch {
    // ignore
  }
  try {
    (await openRedlineDb()).close();
  } catch {
    // ignore
  }
  _resetVersionsDbForTests();
  _resetRedlineDbForTests();
  await new Promise<void>((r) => setTimeout(r, 0));
  for (const name of ['leaseguard-versions', 'leaseguard-redlines']) {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = (): void => resolve();
      req.onerror = (): void => resolve();
      req.onblocked = (): void => resolve();
    });
  }
});

describe('useVersionHistory', () => {
  it('createVersion snapshots current edits and audits', async () => {
    await saveEdit({
      leaseId: 'lease-1',
      paragraphIndex: 1,
      before: 'a',
      after: 'b',
      updatedAt: new Date().toISOString(),
    });
    const audit = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      useVersionHistory({ leaseId: 'lease-1', audit }),
    );
    await waitFor(() => {
      expect(result.current.versions).toEqual([]);
    });
    let saved;
    await act(async () => {
      saved = await result.current.createVersion('label-A', 'note-A');
    });
    expect(saved).not.toBeNull();
    expect(result.current.versions).toHaveLength(1);
    expect(at(result.current.versions, 0).label).toBe('label-A');
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'version-save' }),
    );
  });

  it('getVersionById returns null when versionId belongs to another lease', async () => {
    const { result } = renderHook(() =>
      useVersionHistory({ leaseId: 'lease-other' }),
    );
    await waitFor(() => {
      expect(result.current.versions).toEqual([]);
    });
    const got = await result.current.getVersionById('does-not-exist');
    expect(got).toBeNull();
  });
});

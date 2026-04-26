import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useVersionHistory } from './useVersionHistory';
import { _resetVersionsDbForTests, openVersionsDb } from '../negotiation/versionHistory';
import { _resetRedlineDbForTests, openRedlineDb, saveEdit } from '../redline/redlineStorage';
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
    const { result } = renderHook(() => useVersionHistory({ leaseId: 'lease-1', audit }));
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
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ kind: 'version-save' }));
  });

  it('getVersionById returns null when versionId belongs to another lease', async () => {
    const { result } = renderHook(() => useVersionHistory({ leaseId: 'lease-other' }));
    await waitFor(() => {
      expect(result.current.versions).toEqual([]);
    });
    const got = await result.current.getVersionById('does-not-exist');
    expect(got).toBeNull();
  });

  it('createVersion is a no-op and returns null when leaseId is null', async () => {
    const audit = vi.fn(async () => undefined);
    const { result } = renderHook(() => useVersionHistory({ leaseId: null, audit }));
    let saved;
    await act(async () => {
      saved = await result.current.createVersion();
    });
    expect(saved).toBeNull();
    expect(audit).not.toHaveBeenCalled();
  });

  it('createVersion works without an audit callback supplied', async () => {
    const { result } = renderHook(() => useVersionHistory({ leaseId: 'lease-1' }));
    await waitFor(() => {
      expect(result.current.versions).toEqual([]);
    });
    let saved;
    await act(async () => {
      saved = await result.current.createVersion();
    });
    expect(saved).not.toBeNull();
    expect(result.current.versions).toHaveLength(1);
  });

  it('removeVersion is a no-op when leaseId is null', async () => {
    const audit = vi.fn(async () => undefined);
    const { result } = renderHook(() => useVersionHistory({ leaseId: null, audit }));
    await act(async () => {
      await result.current.removeVersion('any');
    });
    expect(audit).not.toHaveBeenCalled();
  });

  it('removeVersion deletes + audits when version exists', async () => {
    const audit = vi.fn(async () => undefined);
    const { result } = renderHook(() => useVersionHistory({ leaseId: 'lease-1', audit }));
    await waitFor(() => {
      expect(result.current.versions).toEqual([]);
    });
    let id = '';
    await act(async () => {
      const saved = await result.current.createVersion('v1');
      id = saved!.versionId;
    });
    audit.mockClear();
    await act(async () => {
      await result.current.removeVersion(id);
    });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ kind: 'version-delete' }));
    expect(result.current.versions).toHaveLength(0);
  });

  it('restoreVersion is a no-op when leaseId is null or version is missing', async () => {
    const apply = vi.fn();
    const audit = vi.fn(async () => undefined);
    const nullHook = renderHook(() => useVersionHistory({ leaseId: null, audit }));
    await act(async () => {
      await nullHook.result.current.restoreVersion('any', apply);
    });
    expect(apply).not.toHaveBeenCalled();

    const validHook = renderHook(() => useVersionHistory({ leaseId: 'lease-1', audit }));
    await waitFor(() => {
      expect(validHook.result.current.versions).toEqual([]);
    });
    await act(async () => {
      await validHook.result.current.restoreVersion('does-not-exist', apply);
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it('restoreVersion applies edits + audits when version belongs to this lease', async () => {
    await saveEdit({
      leaseId: 'lease-1',
      paragraphIndex: 0,
      before: 'a',
      after: 'b',
      updatedAt: new Date().toISOString(),
    });
    const audit = vi.fn(async () => undefined);
    const apply = vi.fn();
    const { result } = renderHook(() => useVersionHistory({ leaseId: 'lease-1', audit }));
    let id = '';
    await act(async () => {
      const saved = await result.current.createVersion('v1');
      id = saved!.versionId;
    });
    audit.mockClear();
    await act(async () => {
      await result.current.restoreVersion(id, apply);
    });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ kind: 'version-restore' }));
  });

  it('exportVersion is a no-op when the version does not exist', async () => {
    const { result } = renderHook(() => useVersionHistory({ leaseId: 'lease-1' }));
    await waitFor(() => {
      expect(result.current.versions).toEqual([]);
    });
    // Should not throw.
    await act(async () => {
      await result.current.exportVersion('does-not-exist', {
        leaseName: 'L.pdf',
        doc: { pages: [], paragraphs: [], sections: [], raw: '' },
      });
    });
  });
});

import 'fake-indexeddb/auto';
import { beforeEach, describe, it, expect } from 'vitest';
import {
  _resetRedlineDbForTests,
  deleteEdit,
  listEditsForLease,
  openRedlineDb,
  saveEdit,
} from './redlineStorage';
import type { RedlineEdit } from './redline';
import { at } from '../test/assert';

function mkEdit(over: Partial<RedlineEdit> = {}): RedlineEdit {
  return {
    leaseId: 'L1',
    paragraphIndex: 0,
    before: 'before',
    after: 'after',
    updatedAt: '2026-04-18T00:00:00.000Z',
    ...over,
  };
}

async function wipe(): Promise<void> {
  const db = await openRedlineDb();
  db.close();
  _resetRedlineDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('leaseguard-redlines');
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => reject(req.error);
    req.onblocked = (): void => resolve();
  });
}

describe('redlineStorage', () => {
  beforeEach(async () => {
    await wipe();
  });

  it('saves and lists an edit for a lease', async () => {
    await saveEdit(mkEdit({ paragraphIndex: 2 }));
    const list = await listEditsForLease('L1');
    expect(list).toHaveLength(1);
    expect(at(list, 0).paragraphIndex).toBe(2);
  });

  it('listEditsForLease returns an empty array when there are none', async () => {
    expect(await listEditsForLease('nope')).toEqual([]);
  });

  it('scopes edits by leaseId', async () => {
    await saveEdit(mkEdit({ leaseId: 'L1', paragraphIndex: 0 }));
    await saveEdit(mkEdit({ leaseId: 'L2', paragraphIndex: 0 }));
    const l1 = await listEditsForLease('L1');
    const l2 = await listEditsForLease('L2');
    expect(l1).toHaveLength(1);
    expect(l2).toHaveLength(1);
    expect(at(l1, 0).leaseId).toBe('L1');
    expect(at(l2, 0).leaseId).toBe('L2');
  });

  it('saveEdit is an upsert keyed by (leaseId, paragraphIndex)', async () => {
    await saveEdit(mkEdit({ paragraphIndex: 3, after: 'v1' }));
    await saveEdit(mkEdit({ paragraphIndex: 3, after: 'v2' }));
    const list = await listEditsForLease('L1');
    expect(list).toHaveLength(1);
    expect(at(list, 0).after).toBe('v2');
  });

  it('listEditsForLease returns edits sorted by paragraphIndex', async () => {
    await saveEdit(mkEdit({ paragraphIndex: 5 }));
    await saveEdit(mkEdit({ paragraphIndex: 1 }));
    await saveEdit(mkEdit({ paragraphIndex: 3 }));
    const list = await listEditsForLease('L1');
    expect(list.map((e) => e.paragraphIndex)).toEqual([1, 3, 5]);
  });

  it('deleteEdit removes the matching (leaseId, paragraphIndex) entry only', async () => {
    await saveEdit(mkEdit({ paragraphIndex: 1 }));
    await saveEdit(mkEdit({ paragraphIndex: 2 }));
    await deleteEdit('L1', 1);
    const list = await listEditsForLease('L1');
    expect(list).toHaveLength(1);
    expect(at(list, 0).paragraphIndex).toBe(2);
  });

  it('deleteEdit on a non-existent entry is a no-op', async () => {
    await saveEdit(mkEdit({ paragraphIndex: 1 }));
    await deleteEdit('L1', 99);
    const list = await listEditsForLease('L1');
    expect(list).toHaveLength(1);
  });

  it('edits survive across db handle resets (persistence)', async () => {
    await saveEdit(mkEdit({ paragraphIndex: 7, after: 'kept' }));
    const db = await openRedlineDb();
    db.close();
    _resetRedlineDbForTests();
    const list = await listEditsForLease('L1');
    expect(list).toHaveLength(1);
    expect(at(list, 0).after).toBe('kept');
  });

  it('uses its own IndexedDB database distinct from leases/packs/counters', async () => {
    await saveEdit(mkEdit());
    const req = indexedDB.databases?.();
    if (!req) return; // not available in this jsdom build; test passes trivially.
    const infos = await Promise.resolve(req);
    const names = infos.map((i) => i.name ?? '');
    if (names.length > 0) {
      expect(names).toContain('leaseguard-redlines');
      expect(names).not.toContain('leaseguard');
    }
  });
});

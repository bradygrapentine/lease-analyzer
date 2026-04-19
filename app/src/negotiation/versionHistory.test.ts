import 'fake-indexeddb/auto';
import { beforeEach, describe, it, expect } from 'vitest';
import {
  _resetVersionsDbForTests,
  deleteVersion,
  getVersion,
  listVersionsForLease,
  openVersionsDb,
  saveVersion,
  type LeaseVersion,
} from './versionHistory';
import type { RedlineEdit } from '../redline/redline';
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
  const db = await openVersionsDb();
  db.close();
  _resetVersionsDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('leaseguard-versions');
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => reject(req.error);
    req.onblocked = (): void => resolve();
  });
}

describe('versionHistory', () => {
  beforeEach(async () => {
    await wipe();
  });

  it('saveVersion returns a persisted record with generated id + timestamp', async () => {
    const v = await saveVersion({ leaseId: 'L1', edits: [mkEdit()] });
    expect(v.versionId).toMatch(/^L1-/);
    expect(v.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(v.edits).toHaveLength(1);
    const round = await getVersion(v.versionId);
    expect(round?.versionId).toBe(v.versionId);
  });

  it('saveVersion accepts a caller-supplied versionId and createdAt', async () => {
    const v = await saveVersion({
      leaseId: 'L1',
      edits: [],
      versionId: 'custom-id',
      createdAt: '2026-04-01T12:00:00.000Z',
      label: 'draft',
      note: 'first pass',
    });
    expect(v.versionId).toBe('custom-id');
    expect(v.createdAt).toBe('2026-04-01T12:00:00.000Z');
    expect(v.label).toBe('draft');
    expect(v.note).toBe('first pass');
  });

  it('listVersionsForLease returns empty when there are none', async () => {
    expect(await listVersionsForLease('none')).toEqual([]);
  });

  it('listVersionsForLease returns newest-first', async () => {
    await saveVersion({
      leaseId: 'L1',
      edits: [],
      versionId: 'a',
      createdAt: '2026-04-01T00:00:00.000Z',
    });
    await saveVersion({
      leaseId: 'L1',
      edits: [],
      versionId: 'c',
      createdAt: '2026-04-03T00:00:00.000Z',
    });
    await saveVersion({
      leaseId: 'L1',
      edits: [],
      versionId: 'b',
      createdAt: '2026-04-02T00:00:00.000Z',
    });
    const list = await listVersionsForLease('L1');
    expect(list.map((v: LeaseVersion) => v.versionId)).toEqual(['c', 'b', 'a']);
  });

  it('listVersionsForLease scopes by leaseId', async () => {
    await saveVersion({ leaseId: 'L1', edits: [], versionId: '1' });
    await saveVersion({ leaseId: 'L2', edits: [], versionId: '2' });
    const l1 = await listVersionsForLease('L1');
    const l2 = await listVersionsForLease('L2');
    expect(l1).toHaveLength(1);
    expect(l2).toHaveLength(1);
    expect(at(l1, 0).leaseId).toBe('L1');
    expect(at(l2, 0).leaseId).toBe('L2');
  });

  it('saveVersion snapshots edits (mutating the caller array after save does not change the stored version)', async () => {
    const edits = [mkEdit({ paragraphIndex: 0, after: 'v1' })];
    const saved = await saveVersion({ leaseId: 'L1', edits, versionId: 'snap' });
    // Mutate the caller's array AND an element.
    edits.push(mkEdit({ paragraphIndex: 1, after: 'v2' }));
    const firstEdit = edits[0];
    if (firstEdit) firstEdit.after = 'mutated';
    const reloaded = await getVersion('snap');
    expect(reloaded?.edits).toHaveLength(1);
    expect(at(reloaded?.edits ?? [], 0).after).toBe('v1');
    // The returned record from saveVersion is also a snapshot.
    expect(at(saved.edits, 0).after).toBe('v1');
  });

  it('deleteVersion removes the matching record', async () => {
    await saveVersion({ leaseId: 'L1', edits: [], versionId: 'x' });
    await saveVersion({ leaseId: 'L1', edits: [], versionId: 'y' });
    await deleteVersion('x');
    const list = await listVersionsForLease('L1');
    expect(list).toHaveLength(1);
    expect(at(list, 0).versionId).toBe('y');
  });

  it('deleteVersion on a non-existent id is a no-op', async () => {
    await saveVersion({ leaseId: 'L1', edits: [], versionId: 'x' });
    await deleteVersion('nope');
    expect(await listVersionsForLease('L1')).toHaveLength(1);
  });

  it('saveVersion upserts by versionId (same id overwrites)', async () => {
    await saveVersion({ leaseId: 'L1', edits: [], versionId: 'same', label: 'v1' });
    await saveVersion({ leaseId: 'L1', edits: [], versionId: 'same', label: 'v2' });
    const list = await listVersionsForLease('L1');
    expect(list).toHaveLength(1);
    expect(at(list, 0).label).toBe('v2');
  });

  it('versions persist across db handle resets', async () => {
    await saveVersion({ leaseId: 'L1', edits: [], versionId: 'persist', label: 'kept' });
    const db = await openVersionsDb();
    db.close();
    _resetVersionsDbForTests();
    const list = await listVersionsForLease('L1');
    expect(list).toHaveLength(1);
    expect(at(list, 0).label).toBe('kept');
  });

  it('uses its own IndexedDB database distinct from leases/redlines/packs', async () => {
    await saveVersion({ leaseId: 'L1', edits: [] });
    const req = indexedDB.databases?.();
    if (!req) return;
    const infos = await Promise.resolve(req);
    const names = infos.map((i) => i.name ?? '');
    if (names.length > 0) {
      expect(names).toContain('leaseguard-versions');
      expect(names).not.toContain('leaseguard');
      expect(names).not.toContain('leaseguard-redlines');
    }
  });

  it('auto-generated versionIds are unique even with colliding createdAt', async () => {
    // Two saves that would collide on createdAt still get distinct ids.
    const a = await saveVersion({
      leaseId: 'L1',
      edits: [],
      createdAt: '2026-04-18T00:00:00.000Z',
    });
    const b = await saveVersion({
      leaseId: 'L1',
      edits: [],
      createdAt: '2026-04-18T00:00:00.000Z',
    });
    expect(a.versionId).not.toBe(b.versionId);
    expect(await listVersionsForLease('L1')).toHaveLength(2);
  });
});

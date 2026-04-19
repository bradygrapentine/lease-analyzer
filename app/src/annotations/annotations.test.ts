import 'fake-indexeddb/auto';
import { beforeEach, describe, it, expect } from 'vitest';
import {
  _resetAnnotationsDbForTests,
  openAnnotationsDb,
  saveAnnotation,
  listAnnotations,
  updateAnnotation,
  deleteAnnotation,
  deleteAllForLease,
} from './annotations';
import { at } from '../test/assert';

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

describe('annotations storage', () => {
  beforeEach(async () => {
    await wipe();
  });

  it('saves an annotation and returns an id; reads it back via listAnnotations', async () => {
    const id = await saveAnnotation({ leaseId: 'L1', paragraphIndex: 3, text: 'Ask about renewal' });
    expect(id).toMatch(/[0-9a-f-]+/i);
    const list = await listAnnotations('L1');
    expect(list).toHaveLength(1);
    const only = at(list, 0);
    expect(only.id).toBe(id);
    expect(only.leaseId).toBe('L1');
    expect(only.paragraphIndex).toBe(3);
    expect(only.text).toBe('Ask about renewal');
    expect(only.createdAt).toBeTypeOf('number');
    expect(only.updatedAt).toBe(only.createdAt);
  });

  it('listAnnotations scopes by leaseId and sorts by createdAt ascending', async () => {
    await saveAnnotation({ leaseId: 'L1', paragraphIndex: 0, text: 'first' });
    await new Promise((r) => setTimeout(r, 2));
    await saveAnnotation({ leaseId: 'L1', paragraphIndex: 1, text: 'second' });
    await saveAnnotation({ leaseId: 'L2', paragraphIndex: 0, text: 'other-lease' });
    const l1 = await listAnnotations('L1');
    expect(l1.map((a) => a.text)).toEqual(['first', 'second']);
    const l2 = await listAnnotations('L2');
    expect(l2).toHaveLength(1);
    expect(at(l2, 0).text).toBe('other-lease');
  });

  it('updateAnnotation patches text and bumps updatedAt', async () => {
    const id = await saveAnnotation({ leaseId: 'L1', paragraphIndex: 0, text: 'old' });
    const before = at(await listAnnotations('L1'), 0);
    await new Promise((r) => setTimeout(r, 2));
    await updateAnnotation(id, 'new');
    const after = at(await listAnnotations('L1'), 0);
    expect(after.text).toBe('new');
    expect(after.updatedAt).toBeGreaterThan(before.updatedAt);
    expect(after.createdAt).toBe(before.createdAt);
  });

  it('updateAnnotation throws when the id is unknown', async () => {
    await expect(updateAnnotation('missing', 'x')).rejects.toThrow(/not found/);
  });

  it('deleteAnnotation removes a single annotation', async () => {
    const a = await saveAnnotation({ leaseId: 'L1', paragraphIndex: 0, text: 'a' });
    const b = await saveAnnotation({ leaseId: 'L1', paragraphIndex: 1, text: 'b' });
    await deleteAnnotation(a);
    const list = await listAnnotations('L1');
    expect(list).toHaveLength(1);
    expect(at(list, 0).id).toBe(b);
  });

  it('deleteAllForLease wipes every annotation for that lease only', async () => {
    await saveAnnotation({ leaseId: 'L1', paragraphIndex: 0, text: 'x' });
    await saveAnnotation({ leaseId: 'L1', paragraphIndex: 1, text: 'y' });
    await saveAnnotation({ leaseId: 'L2', paragraphIndex: 0, text: 'keep me' });
    await deleteAllForLease('L1');
    expect(await listAnnotations('L1')).toEqual([]);
    expect(await listAnnotations('L2')).toHaveLength(1);
  });

  it('listAnnotations returns [] for an unknown leaseId', async () => {
    expect(await listAnnotations('ghost')).toEqual([]);
  });

  it('uses its own IndexedDB database distinct from the leases one', async () => {
    await saveAnnotation({ leaseId: 'L1', paragraphIndex: 0, text: 'x' });
    const names = await new Promise<string[]>((resolve) => {
      const req = indexedDB.databases?.();
      if (!req) return resolve([]);
      Promise.resolve(req).then((infos) => resolve(infos.map((i) => i.name ?? '')));
    });
    if (names.length > 0) {
      expect(names).toContain('leaseguard-annotations');
      expect(names).not.toContain('leaseguard');
    }
  });
});

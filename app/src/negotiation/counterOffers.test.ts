import 'fake-indexeddb/auto';
import { beforeEach, describe, it, expect } from 'vitest';
import {
  _resetCountersDbForTests,
  openCountersDb,
  saveCounterOffer,
  listCounterOffers,
  updateCounterOffer,
  deleteCounterOffer,
} from './counterOffers';
import { at } from '../test/assert';

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

describe('counter-offer storage', () => {
  beforeEach(async () => {
    await wipe();
  });

  it('saves a counter-offer and returns an id; reads it back', async () => {
    const id = await saveCounterOffer({
      ruleId: 'r-auto-renew',
      name: 'Strike auto-renewal',
      text: 'Section 4 is deleted in its entirety.',
    });
    expect(id).toMatch(/[0-9a-f-]+/i);
    const list = await listCounterOffers({ ruleId: 'r-auto-renew' });
    expect(list).toHaveLength(1);
    const only = at(list, 0);
    expect(only.id).toBe(id);
    expect(only.ruleId).toBe('r-auto-renew');
    expect(only.name).toBe('Strike auto-renewal');
    expect(only.text).toBe('Section 4 is deleted in its entirety.');
    expect(only.createdAt).toBeTypeOf('number');
    expect(only.updatedAt).toBe(only.createdAt);
  });

  it('listCounterOffers with no filter returns every counter, sorted by createdAt ascending', async () => {
    await saveCounterOffer({ ruleId: 'r-a', name: 'A', text: 'a' });
    await new Promise((r) => setTimeout(r, 2));
    await saveCounterOffer({ ruleId: 'r-b', name: 'B', text: 'b' });
    const list = await listCounterOffers();
    expect(list.map((c) => c.name)).toEqual(['A', 'B']);
  });

  it('listCounterOffers filters by ruleId when provided', async () => {
    await saveCounterOffer({ ruleId: 'r-a', name: 'one', text: 'x' });
    await saveCounterOffer({ ruleId: 'r-a', name: 'two', text: 'x' });
    await saveCounterOffer({ ruleId: 'r-b', name: 'other', text: 'x' });
    const onlyA = await listCounterOffers({ ruleId: 'r-a' });
    expect(onlyA.map((c) => c.name).sort()).toEqual(['one', 'two']);
    const onlyB = await listCounterOffers({ ruleId: 'r-b' });
    expect(onlyB.map((c) => c.name)).toEqual(['other']);
  });

  it('supports multiple counters per rule (not keyed by ruleId)', async () => {
    await saveCounterOffer({ ruleId: 'r-a', name: 'first', text: '1' });
    await saveCounterOffer({ ruleId: 'r-a', name: 'second', text: '2' });
    const list = await listCounterOffers({ ruleId: 'r-a' });
    expect(list).toHaveLength(2);
  });

  it('updateCounterOffer patches name and/or text and bumps updatedAt', async () => {
    const id = await saveCounterOffer({ ruleId: 'r', name: 'old', text: 'old' });
    const before = at(await listCounterOffers({ ruleId: 'r' }), 0);
    await new Promise((r) => setTimeout(r, 2));
    await updateCounterOffer(id, { name: 'new', text: 'newer' });
    const after = at(await listCounterOffers({ ruleId: 'r' }), 0);
    expect(after.name).toBe('new');
    expect(after.text).toBe('newer');
    expect(after.updatedAt).toBeGreaterThan(before.updatedAt);
    expect(after.createdAt).toBe(before.createdAt);
  });

  it('updateCounterOffer can patch only name', async () => {
    const id = await saveCounterOffer({ ruleId: 'r', name: 'old', text: 'body' });
    await updateCounterOffer(id, { name: 'renamed' });
    const after = at(await listCounterOffers({ ruleId: 'r' }), 0);
    expect(after.name).toBe('renamed');
    expect(after.text).toBe('body');
  });

  it('updateCounterOffer throws when the id is unknown', async () => {
    await expect(updateCounterOffer('missing', { name: 'x' })).rejects.toThrow(/not found/);
  });

  it('deleteCounterOffer removes a single counter-offer', async () => {
    const a = await saveCounterOffer({ ruleId: 'r', name: 'a', text: 'a' });
    const b = await saveCounterOffer({ ruleId: 'r', name: 'b', text: 'b' });
    await deleteCounterOffer(a);
    const list = await listCounterOffers({ ruleId: 'r' });
    expect(list).toHaveLength(1);
    expect(at(list, 0).id).toBe(b);
  });

  it('listCounterOffers returns [] for an unknown ruleId', async () => {
    expect(await listCounterOffers({ ruleId: 'ghost' })).toEqual([]);
  });

  it('uses its own IndexedDB database distinct from leases/templates', async () => {
    await saveCounterOffer({ ruleId: 'r', name: 'x', text: 'x' });
    const names = await new Promise<string[]>((resolve) => {
      const req = indexedDB.databases?.();
      if (!req) return resolve([]);
      Promise.resolve(req).then((infos) => resolve(infos.map((i) => i.name ?? '')));
    });
    if (names.length > 0) {
      expect(names).toContain('leaseguard-counters');
      expect(names).not.toContain('leaseguard');
    }
  });
});

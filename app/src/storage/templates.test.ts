import { beforeEach, describe, it, expect } from 'vitest';
import {
  _resetDbForTests,
  openLeaseDb,
  saveLease,
  setStandardId,
  getStandardId,
  listLeases,
  clearAll,
} from './storage';
import {
  saveTemplate,
  listTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
} from './templates';
import type { LeaseDocument } from '../parser/types';
import { at } from '../test/assert';

function doc(): LeaseDocument {
  return { pages: [], paragraphs: [], sections: [], raw: '' };
}

async function wipe(): Promise<void> {
  try {
    const db = await openLeaseDb();
    db.close();
  } catch {
    // ignore
  }
  _resetDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('leaseguard');
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => resolve();
    req.onblocked = (): void => resolve();
  });
}

describe('clause templates storage', () => {
  beforeEach(async () => {
    await wipe();
  });

  it('saves a template and returns an id, then reads it back', async () => {
    const id = await saveTemplate({ name: 'Arbitration', text: 'Any dispute shall be arbitrated.' });
    expect(id).toMatch(/^[0-9a-f-]+$/i);
    const loaded = await getTemplate(id);
    expect(loaded?.name).toBe('Arbitration');
    expect(loaded?.text).toBe('Any dispute shall be arbitrated.');
    expect(loaded?.createdAt).toBeTypeOf('number');
    expect(loaded?.updatedAt).toBe(loaded?.createdAt);
  });

  it('listTemplates returns all saved templates, sorted by createdAt ascending', async () => {
    const first = await saveTemplate({ name: 'A', text: 'a' });
    await new Promise((r) => setTimeout(r, 2));
    const second = await saveTemplate({ name: 'B', text: 'b' });
    const list = await listTemplates();
    expect(list).toHaveLength(2);
    expect(at(list, 0).id).toBe(first);
    expect(at(list, 1).id).toBe(second);
  });

  it('updateTemplate patches name and/or text and bumps updatedAt', async () => {
    const id = await saveTemplate({ name: 'Old', text: 'old text' });
    const original = await getTemplate(id);
    await new Promise((r) => setTimeout(r, 2));
    await updateTemplate(id, { name: 'New', text: 'new text' });
    const updated = await getTemplate(id);
    expect(updated?.name).toBe('New');
    expect(updated?.text).toBe('new text');
    expect(updated?.updatedAt).toBeGreaterThan(original?.updatedAt ?? 0);
    expect(updated?.createdAt).toBe(original?.createdAt);
  });

  it('updateTemplate can patch only name', async () => {
    const id = await saveTemplate({ name: 'Old', text: 'body' });
    await updateTemplate(id, { name: 'Renamed' });
    const updated = await getTemplate(id);
    expect(updated?.name).toBe('Renamed');
    expect(updated?.text).toBe('body');
  });

  it('updateTemplate throws when the id is unknown', async () => {
    await expect(updateTemplate('missing', { name: 'x' })).rejects.toThrow(/not found/);
  });

  it('deleteTemplate removes a single template', async () => {
    const id = await saveTemplate({ name: 'Gone', text: 'bye' });
    await deleteTemplate(id);
    expect(await getTemplate(id)).toBeUndefined();
  });

  it('getTemplate returns undefined for a missing id', async () => {
    expect(await getTemplate('nope')).toBeUndefined();
  });

  it('clearAll also wipes templates', async () => {
    await saveTemplate({ name: 'T', text: 't' });
    await clearAll();
    expect(await listTemplates()).toEqual([]);
  });

  it('templates coexist with the whole-lease standardLeaseId mechanism', async () => {
    const leaseId = await saveLease({ name: 'L.pdf', doc: doc(), findings: [] });
    await setStandardId(leaseId);
    await saveTemplate({ name: 'T', text: 'body' });
    expect(await getStandardId()).toBe(leaseId);
    expect(await listTemplates()).toHaveLength(1);
    expect(await listLeases()).toHaveLength(1);
  });
});

describe('db migration v2 → v3', () => {
  beforeEach(async () => {
    await wipe();
  });

  it('opens a pre-existing v2 database and preserves leases + settings, then makes clauseTemplates usable', async () => {
    // Simulate a v2-era database with data already in it: leases store + settings store,
    // but NO clauseTemplates store.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('leaseguard', 2);
      req.onupgradeneeded = (): void => {
        const db = req.result;
        if (!db.objectStoreNames.contains('leases')) {
          const store = db.createObjectStore('leases', { keyPath: 'id' });
          store.createIndex('by-createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      };
      req.onsuccess = (): void => {
        const db = req.result;
        const tx = db.transaction(['leases', 'settings'], 'readwrite');
        tx.objectStore('leases').put({
          id: 'v2-lease',
          name: 'legacy.pdf',
          createdAt: 111,
          updatedAt: 111,
          rulePackVersion: '1.0.0',
          pageCount: 1,
          findingCount: 0,
          doc: { pages: [], paragraphs: [], sections: [], raw: '' },
          findings: [],
        });
        tx.objectStore('settings').put('v2-lease', 'standardLeaseId');
        tx.oncomplete = (): void => {
          db.close();
          resolve();
        };
        tx.onerror = (): void => reject(tx.error);
      };
      req.onerror = (): void => reject(req.error);
    });

    // Now open via our wrapper — this should upgrade v2 → v3 non-destructively and
    // add the clauseTemplates store. Existing lease + standard pointer must survive.
    _resetDbForTests();
    const list = await listLeases();
    expect(list).toHaveLength(1);
    expect(at(list, 0).id).toBe('v2-lease');
    expect(await getStandardId()).toBe('v2-lease');

    const templateId = await saveTemplate({ name: 'after-migrate', text: 'x' });
    expect(await getTemplate(templateId)).toBeDefined();
  });
});

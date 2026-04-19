import { beforeEach, describe, it, expect } from 'vitest';
import {
  _resetDbForTests,
  clearStandardId,
  getStandardId,
  openLeaseDb,
  saveLease,
  setStandardId,
} from './storage';
import type { LeaseDocument } from '../parser/types';

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

describe('standard lease', () => {
  beforeEach(async () => {
    await wipe();
  });

  it('returns undefined when no standard is set', async () => {
    expect(await getStandardId()).toBeUndefined();
  });

  it('persists the standard id across calls', async () => {
    const id = await saveLease({ name: 'std.pdf', doc: doc(), findings: [] });
    await setStandardId(id);
    expect(await getStandardId()).toBe(id);
  });

  it('clearStandardId removes the pointer', async () => {
    const id = await saveLease({ name: 'std.pdf', doc: doc(), findings: [] });
    await setStandardId(id);
    await clearStandardId();
    expect(await getStandardId()).toBeUndefined();
  });
});

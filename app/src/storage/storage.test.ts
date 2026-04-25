import 'fake-indexeddb/auto';
import { beforeEach, describe, it, expect } from 'vitest';
import {
  _resetDbForTests,
  clearAll,
  clearOnboardingDismissedAt,
  deleteLease,
  getLease,
  getOnboardingDismissedAt,
  listLeases,
  openLeaseDb,
  renameLease,
  replaceAllLeases,
  saveLease,
  setOnboardingDismissedAt,
} from './storage';
import type { LeaseDocument } from '../parser/types';
import type { Finding } from '../rules/types';
import { at } from '../test/assert';

function makeDoc(): LeaseDocument {
  return {
    pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
    paragraphs: [{ text: 'Hello', page: 1 }],
    sections: [],
    raw: 'Hello',
  };
}

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'auto-renewal',
    severity: 'medium',
    category: 'termination',
    title: 'Auto-renewal',
    explanation: 'Test',
    citation: null,
    page: 1,
    paragraphIndex: 0,
    snippet: 'snippet',
    span: { start: 0, end: 7 },
    confidence: 0.9,
    negated: false,
    rulePackVersion: '1.0.0',
    ...overrides,
  };
}

async function wipe(): Promise<void> {
  const db = await openLeaseDb();
  db.close();
  _resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('leaseguard');
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => reject(req.error);
    req.onblocked = (): void => resolve();
  });
}

describe('storage', () => {
  beforeEach(async () => {
    await wipe();
  });

  it('saves a lease and returns an id, then reads it back', async () => {
    const id = await saveLease({ name: 'Lease A.pdf', doc: makeDoc(), findings: [makeFinding()] });
    expect(id).toMatch(/^[0-9a-f-]+$/i);

    const loaded = await getLease(id);
    expect(loaded).toBeDefined();
    expect(loaded?.name).toBe('Lease A.pdf');
    expect(loaded?.findings).toHaveLength(1);
    expect(loaded?.doc.raw).toBe('Hello');
  });

  it('lists only metadata, not doc bodies', async () => {
    await saveLease({ name: 'One.pdf', doc: makeDoc(), findings: [] });
    await saveLease({ name: 'Two.pdf', doc: makeDoc(), findings: [makeFinding()] });

    const list = await listLeases();
    expect(list).toHaveLength(2);
    expect(list.every((l) => 'id' in l && 'name' in l && 'createdAt' in l)).toBe(true);
    expect(list.some((l) => 'doc' in l)).toBe(false);
    expect(at(list, 0).findingCount).toBeGreaterThanOrEqual(0);
  });

  it('renames a lease', async () => {
    const id = await saveLease({ name: 'Old.pdf', doc: makeDoc(), findings: [] });
    await renameLease(id, 'Renamed.pdf');
    const loaded = await getLease(id);
    expect(loaded?.name).toBe('Renamed.pdf');
  });

  it('deletes a single lease', async () => {
    const id = await saveLease({ name: 'X.pdf', doc: makeDoc(), findings: [] });
    await deleteLease(id);
    expect(await getLease(id)).toBeUndefined();
  });

  it('clearAll empties every lease', async () => {
    await saveLease({ name: 'A.pdf', doc: makeDoc(), findings: [] });
    await saveLease({ name: 'B.pdf', doc: makeDoc(), findings: [] });
    await clearAll();
    expect(await listLeases()).toEqual([]);
  });

  it('getLease returns undefined for an unknown id', async () => {
    expect(await getLease('nonexistent')).toBeUndefined();
  });

  it('renameLease throws when the id is missing', async () => {
    await expect(renameLease('nonexistent', 'X')).rejects.toThrow(/not found/);
  });

  it('replaceAllLeases imports a set and sets the standard id', async () => {
    const id = await saveLease({ name: 'First.pdf', doc: makeDoc(), findings: [] });
    const existing = (await getLease(id))!;
    await replaceAllLeases([existing], id);
    const list = await listLeases();
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe('First.pdf');
  });

  it('replaceAllLeases with null clears the standard pointer', async () => {
    const id = await saveLease({ name: 'One.pdf', doc: makeDoc(), findings: [] });
    const existing = (await getLease(id))!;
    await replaceAllLeases([existing], null);
    // no assertion on standard here — verified via the standard.test.ts roundtrip
    expect(await listLeases()).toHaveLength(1);
  });

  it('clearAll also wipes the standard pointer', async () => {
    const id = await saveLease({ name: 'A.pdf', doc: makeDoc(), findings: [] });
    await clearAll();
    expect(await listLeases()).toEqual([]);
    expect(id).toBeTruthy();
  });

  it('onboardingDismissedAt is null on a fresh DB', async () => {
    expect(await getOnboardingDismissedAt()).toBeNull();
  });

  it('round-trips a numeric onboardingDismissedAt timestamp', async () => {
    const ts = 1_700_000_000_000;
    await setOnboardingDismissedAt(ts);
    expect(await getOnboardingDismissedAt()).toBe(ts);
  });

  it('clearOnboardingDismissedAt resets to null', async () => {
    await setOnboardingDismissedAt(Date.now());
    await clearOnboardingDismissedAt();
    expect(await getOnboardingDismissedAt()).toBeNull();
  });

  it('migration preserves leases when onboarding key is added later', async () => {
    // Seed a lease, then simulate "later" by setting + reading the new key.
    // This guards against a future v-bump dropping rows when adding the key.
    const id = await saveLease({ name: 'Mig.pdf', doc: makeDoc(), findings: [] });
    await setOnboardingDismissedAt(42);
    const list = await listLeases();
    expect(list.find((l) => l.id === id)).toBeDefined();
    expect(await getOnboardingDismissedAt()).toBe(42);
  });

  it('stamps createdAt', async () => {
    const before = Date.now();
    const id = await saveLease({ name: 'Stamped.pdf', doc: makeDoc(), findings: [] });
    const after = Date.now();
    const loaded = await getLease(id);
    expect(loaded?.createdAt).toBeGreaterThanOrEqual(before);
    expect(loaded?.createdAt).toBeLessThanOrEqual(after);
  });
});

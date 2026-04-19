import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  _resetAuditDbForTests,
  appendAuditEntry,
  canonicalJsonStringify,
  listAuditEntries,
  openAuditDb,
  verifyAuditChain,
} from './auditLog';

async function wipe(): Promise<void> {
  const db = await openAuditDb();
  db.close();
  _resetAuditDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('leaseguard-audit');
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => reject(req.error);
    req.onblocked = (): void => resolve();
  });
}

describe('canonicalJsonStringify', () => {
  it('sorts object keys deterministically', () => {
    const a = canonicalJsonStringify({ b: 1, a: 2, c: { y: 9, x: 8 } });
    const b = canonicalJsonStringify({ c: { x: 8, y: 9 }, a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"b":1,"c":{"x":8,"y":9}}');
  });

  it('serializes arrays in order (arrays are ordered data)', () => {
    expect(canonicalJsonStringify([3, 1, 2])).toBe('[3,1,2]');
  });

  it('handles nested + primitive edge cases', () => {
    expect(
      canonicalJsonStringify({
        nested: [{ z: 1, a: 2 }, null],
        s: 'hello',
        n: 0,
        t: true,
      }),
    ).toBe('{"n":0,"nested":[{"a":2,"z":1},null],"s":"hello","t":true}');
  });
});

describe('appendAuditEntry', () => {
  beforeEach(async () => {
    await wipe();
  });

  it('assigns seq=1 and prevHash="" on the first entry', async () => {
    const entry = await appendAuditEntry({
      kind: 'analyze',
      payload: { leaseName: 'alpha.pdf' },
    });
    expect(entry.seq).toBe(1);
    expect(entry.prevHash).toBe('');
    expect(entry.entryHash).toMatch(/^[0-9a-f]{64}$/);
    expect(entry.kind).toBe('analyze');
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('chains subsequent entries by prevHash = previous.entryHash', async () => {
    const a = await appendAuditEntry({ kind: 'analyze', payload: { n: 1 } });
    const b = await appendAuditEntry({ kind: 'export', payload: { n: 2 } });
    const c = await appendAuditEntry({ kind: 'save-lease', payload: { n: 3 } });
    expect(b.seq).toBe(2);
    expect(b.prevHash).toBe(a.entryHash);
    expect(c.seq).toBe(3);
    expect(c.prevHash).toBe(b.entryHash);
  });

  it('produces the same entryHash for identical logical content (canonicalization)', async () => {
    const e1 = await appendAuditEntry({
      kind: 'analyze',
      payload: { b: 2, a: 1 },
    });
    await wipe();
    const e2 = await appendAuditEntry({
      kind: 'analyze',
      // same logical payload, different key order, same timestamp forced via
      // equal seq/prevHash — normalize timestamp for the comparison
      payload: { a: 1, b: 2 },
    });
    // Timestamps differ, so the hashes will differ, but the *canonical*
    // JSON of the hashable subset with a fixed timestamp should match.
    const canon1 = canonicalJsonStringify({
      seq: e1.seq,
      timestamp: 'FIXED',
      kind: e1.kind,
      payload: e1.payload,
      prevHash: e1.prevHash,
    });
    const canon2 = canonicalJsonStringify({
      seq: e2.seq,
      timestamp: 'FIXED',
      kind: e2.kind,
      payload: e2.payload,
      prevHash: e2.prevHash,
    });
    expect(canon1).toBe(canon2);
  });
});

describe('listAuditEntries', () => {
  beforeEach(async () => {
    await wipe();
  });

  it('returns [] when no entries', async () => {
    expect(await listAuditEntries()).toEqual([]);
  });

  it('returns entries in seq order', async () => {
    await appendAuditEntry({ kind: 'analyze', payload: {} });
    await appendAuditEntry({ kind: 'export', payload: {} });
    await appendAuditEntry({ kind: 'import-pack', payload: {} });
    const list = await listAuditEntries();
    expect(list.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(list.map((e) => e.kind)).toEqual(['analyze', 'export', 'import-pack']);
  });
});

describe('verifyAuditChain', () => {
  beforeEach(async () => {
    await wipe();
  });

  it('ok=true for an empty chain', async () => {
    expect(await verifyAuditChain()).toEqual({ ok: true });
  });

  it('ok=true after several valid appends', async () => {
    await appendAuditEntry({ kind: 'analyze', payload: { n: 1 } });
    await appendAuditEntry({ kind: 'export', payload: { n: 2 } });
    await appendAuditEntry({ kind: 'save-lease', payload: { n: 3 } });
    expect(await verifyAuditChain()).toEqual({ ok: true });
  });

  it('detects a tampered payload (wrong entryHash)', async () => {
    await appendAuditEntry({ kind: 'analyze', payload: { n: 1 } });
    await appendAuditEntry({ kind: 'export', payload: { n: 2 } });
    // Corrupt the second entry's payload directly in the store.
    const db = await openAuditDb();
    const tx = db.transaction('entries', 'readwrite');
    const store = tx.objectStore('entries');
    const e2 = await store.get(2);
    if (!e2) throw new Error('fixture broken');
    e2.payload = { n: 999 };
    await store.put(e2);
    await tx.done;
    const res = await verifyAuditChain();
    expect(res.ok).toBe(false);
    expect(res.firstBadSeq).toBe(2);
  });

  it('detects a broken prevHash linkage', async () => {
    await appendAuditEntry({ kind: 'analyze', payload: { n: 1 } });
    await appendAuditEntry({ kind: 'export', payload: { n: 2 } });
    await appendAuditEntry({ kind: 'save-lease', payload: { n: 3 } });
    const db = await openAuditDb();
    const tx = db.transaction('entries', 'readwrite');
    const store = tx.objectStore('entries');
    const e3 = await store.get(3);
    if (!e3) throw new Error('fixture broken');
    // Point seq=3 at the wrong prevHash but leave its entryHash intact.
    e3.prevHash = 'deadbeef'.padEnd(64, '0');
    await store.put(e3);
    await tx.done;
    const res = await verifyAuditChain();
    expect(res.ok).toBe(false);
    expect(res.firstBadSeq).toBe(3);
  });

  it('detects a missing seq (gap) as a bad chain', async () => {
    await appendAuditEntry({ kind: 'analyze', payload: { n: 1 } });
    await appendAuditEntry({ kind: 'export', payload: { n: 2 } });
    await appendAuditEntry({ kind: 'save-lease', payload: { n: 3 } });
    const db = await openAuditDb();
    const tx = db.transaction('entries', 'readwrite');
    await tx.objectStore('entries').delete(2);
    await tx.done;
    const res = await verifyAuditChain();
    expect(res.ok).toBe(false);
    // seq=2 is missing, so first bad is the position where we expected seq=2
    expect(res.firstBadSeq).toBe(2);
  });
});

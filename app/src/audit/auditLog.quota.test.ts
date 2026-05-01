import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import {
  _resetAuditDbForTests,
  appendAuditEntry,
  listAuditEntries,
  openAuditDb,
  verifyAuditChain,
  AUDIT_DB_NAME,
  CHAIN_TRUNCATED_KIND,
  QUOTA_ROTATION_DROP_COUNT,
} from './auditLog';

async function wipe(): Promise<void> {
  _resetAuditDbForTests();
  await Promise.resolve();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(AUDIT_DB_NAME);
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => reject(req.error);
    req.onblocked = (): void => resolve();
  });
}

function makeQuotaError(): DOMException {
  // jsdom + fake-indexeddb don't actually throw QuotaExceededError, so
  // we forge one with the name the spec mandates.
  const e = new Error('quota exceeded');
  (e as { name: string }).name = 'QuotaExceededError';
  return e as unknown as DOMException;
}

describe('appendAuditEntry: quota rotation policy (Wave 59 Slice 3)', () => {
  beforeEach(async () => {
    await wipe();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rotates oldest entries and writes a chain-truncated sentinel when QuotaExceededError fires', async () => {
    // Seed enough entries that we have some to drop.
    const totalSeed = QUOTA_ROTATION_DROP_COUNT + 5;
    for (let i = 0; i < totalSeed; i++) {
      await appendAuditEntry({ kind: 'analyze', payload: { i } });
    }
    expect((await listAuditEntries()).length).toBe(totalSeed);

    // Force the next put to throw QuotaExceededError once. The implementation
    // should catch it, drop QUOTA_ROTATION_DROP_COUNT oldest entries, write
    // a `chain-truncated` sentinel, then retry the original put.
    const db = await openAuditDb();
    let throws = 1;
    const realPut = db.put.bind(db);
    const spy = vi.spyOn(db, 'put').mockImplementation(async (...args: Parameters<typeof db.put>) => {
      if (throws > 0) {
        throws--;
        throw makeQuotaError();
      }
      return realPut(...args);
    });

    const final = await appendAuditEntry({ kind: 'export', payload: { final: true } });
    spy.mockRestore();

    const entries = await listAuditEntries();
    // Policy is "drop all + sentinel + retried entry" — see rotateOnQuota.
    expect(entries.length).toBe(2);

    const sentinel = entries[0];
    expect(sentinel?.kind).toBe(CHAIN_TRUNCATED_KIND);
    expect(sentinel?.prevHash).toBe('');
    const droppedMeta = sentinel?.payload as {
      droppedCount: number;
      firstDroppedSeq: number;
      lastDroppedSeq: number;
    };
    expect(droppedMeta.droppedCount).toBe(totalSeed);
    expect(droppedMeta.firstDroppedSeq).toBe(1);
    expect(droppedMeta.lastDroppedSeq).toBe(totalSeed);

    // The retried put landed and is the chain tail.
    expect(entries[entries.length - 1]).toEqual(final);
    expect(final.kind).toBe('export');
    // Sanity: QUOTA_ROTATION_DROP_COUNT is still exported as a hint; we
    // seeded above it to ensure rotation has work to do.
    expect(totalSeed).toBeGreaterThan(QUOTA_ROTATION_DROP_COUNT);

    // Chain verifies — a chain-truncated entry with empty prevHash is
    // treated as a legitimate restart point.
    const v = await verifyAuditChain();
    expect(v.ok).toBe(true);
  });

  it('does NOT rotate on non-quota errors (re-throws)', async () => {
    await appendAuditEntry({ kind: 'analyze', payload: {} });

    const db = await openAuditDb();
    const spy = vi.spyOn(db, 'put').mockImplementationOnce(async () => {
      throw new Error('some other failure');
    });

    await expect(
      appendAuditEntry({ kind: 'export', payload: {} }),
    ).rejects.toThrow('some other failure');
    spy.mockRestore();

    // No sentinel written.
    const entries = await listAuditEntries();
    expect(entries.length).toBe(1);
    expect(entries[0]?.kind).toBe('analyze');
  });

  it('if rotation cannot free space (still QuotaExceededError after retry), surfaces the error', async () => {
    // Seed minimal entries.
    for (let i = 0; i < QUOTA_ROTATION_DROP_COUNT + 2; i++) {
      await appendAuditEntry({ kind: 'analyze', payload: { i } });
    }

    const db = await openAuditDb();
    // Throw on every put — rotation can't help; implementation should give up
    // after one retry rather than spin forever.
    const spy = vi.spyOn(db, 'put').mockImplementation(async () => {
      throw makeQuotaError();
    });

    await expect(
      appendAuditEntry({ kind: 'export', payload: {} }),
    ).rejects.toMatchObject({ name: 'QuotaExceededError' });
    spy.mockRestore();
  });
});

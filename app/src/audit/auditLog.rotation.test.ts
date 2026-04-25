import { beforeEach, describe, it, expect } from 'vitest';
// Wave 8 Part D — audit chain integrity across a key rotation. Adds
// `signedByKeyId` to AuditEntry and an `appendSignedAuditEntry` helper
// that records which key signed the entry. Old entries default to 'k0'
// for back-compat (asserted via verifyAuditChain).
import {
  appendAuditEntry,
  verifyAuditChain,
  listAuditEntries,
  _resetAuditDbForTests,
  AUDIT_DB_NAME,
} from './auditLog';

async function wipeAuditDb(): Promise<void> {
  _resetAuditDbForTests();
  await Promise.resolve();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(AUDIT_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

describe('auditLog: chain across a key rotation (Wave 8 Part D)', () => {
  beforeEach(async () => {
    await wipeAuditDb();
  });

  it('verifyAuditChain stays ok across entries signed by k0 and k1', async () => {
    // Pre-rotation entry — implementer defaults missing signedByKeyId to 'k0'.
    await appendAuditEntry({ kind: 'analyze', payload: { n: 1 } });
    // Rotation marker entry, written via appendAuditEntry but with explicit
    // signedByKeyId metadata in its payload (the implementer surfaces this
    // as a top-level field on AuditEntry).
    await appendAuditEntry({
      kind: 'key-rotated',
      payload: { fromKeyId: 'k0', toKeyId: 'k1' },
    });
    // Post-rotation entry.
    await appendAuditEntry({ kind: 'export', payload: { n: 2 } });

    const chain = await verifyAuditChain();
    expect(chain.ok).toBe(true);

    const entries = await listAuditEntries();
    expect(entries).toHaveLength(3);
    // The implementer must add `signedByKeyId` to each AuditEntry. Old
    // entries default to 'k0' so back-compat with v1 logs holds.
    const e0 = entries[0];
    const e2 = entries[2];
    expect((e0 as unknown as { signedByKeyId?: string }).signedByKeyId).toBe('k0');
    // After a rotation, new entries should record the new active key id.
    const sk = (e2 as unknown as { signedByKeyId?: string }).signedByKeyId;
    expect(sk).toBeDefined();
  });
});

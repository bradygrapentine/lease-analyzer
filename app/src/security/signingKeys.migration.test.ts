import { beforeEach, describe, it, expect } from 'vitest';
// Wave 8 Part D — v1 → v2 storage migration. The implementer bumps
// SIGNING_DB_VERSION to 2 and adds an upgrade path that reshapes the
// single-record `keypair` store into the multi-key v2 layout (default
// id "k0", retiredAt null).
import {
  listKeys,
  getActiveKey,
  exportPublicKey,
  _resetSigningDbForTests,
  SIGNING_DB_NAME,
} from './signingKeys';
import { at } from '../test/assert';

const V1_STORE = 'keypair';
const V1_KEY_ID = 'active';

async function wipe(): Promise<void> {
  _resetSigningDbForTests();
  await Promise.resolve();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(SIGNING_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

/**
 * Seed a v1-shaped database directly via raw indexedDB so the
 * v2 migration runs on next open via the module under test.
 */
async function seedV1Record(): Promise<{ publicKeyB64: string }> {
  const publicKeyB64 = btoa('x'.repeat(32));
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(SIGNING_DB_NAME, 1);
    req.onupgradeneeded = (): void => {
      const db = req.result;
      if (!db.objectStoreNames.contains(V1_STORE)) {
        db.createObjectStore(V1_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = (): void => {
      const db = req.result;
      const tx = db.transaction(V1_STORE, 'readwrite');
      tx.objectStore(V1_STORE).put({
        id: V1_KEY_ID,
        publicKeyB64,
        salt: new Uint8Array(16),
        iv: new Uint8Array(12),
        wrappedPrivate: new Uint8Array(64),
        createdAt: 1_700_000_000_000,
      });
      tx.oncomplete = (): void => {
        db.close();
        resolve();
      };
      tx.onerror = (): void => reject(tx.error);
    };
    req.onerror = (): void => reject(req.error);
  });
  return { publicKeyB64 };
}

describe('signingKeys: v1 -> v2 migration (Wave 8 Part D)', () => {
  beforeEach(async () => {
    await wipe();
  });

  it('preserves the existing keypair as a single key in the v2 layout, defaulted to id "k0"', async () => {
    const { publicKeyB64 } = await seedV1Record();
    // Force the module to re-open the db so its v2 upgrade path runs.
    _resetSigningDbForTests();

    const all = await listKeys();
    expect(all).toHaveLength(1);
    const only = at(all, 0);
    expect(only.id).toBe('k0');
    expect(only.retiredAt).toBeNull();
    expect(only.publicKey).toBe(publicKeyB64);

    const active = await getActiveKey();
    expect(active?.id).toBe('k0');
    expect(await exportPublicKey()).toBe(publicKeyB64);
  });
});

import { beforeEach, describe, it, expect } from 'vitest';
// Wave 8 Part D — extends signingKeys with rotation. New exports
// expected from `./signingKeys`:
//   - rotateKey(passphrase): Promise<{ id: string; publicKey: string }>
//   - listKeys(): Promise<KeyRecord[]>
//   - getActiveKey(): Promise<KeyRecord | null>
//   - signWithKey(payload, passphrase, keyId): Promise<{ signature, publicKey }>
//   - type KeyRecord = { id, createdAt, retiredAt, publicKey }
import {
  createSigningKey,
  rotateKey,
  listKeys,
  getActiveKey,
  signPayload,
  signWithKey,
  _resetSigningDbForTests,
  SIGNING_DB_NAME,
} from './signingKeys';
import { at } from '../test/assert';

async function wipeSigningDb(): Promise<void> {
  _resetSigningDbForTests();
  await Promise.resolve();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(SIGNING_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

async function verifyB64(
  publicKey: string,
  signature: string,
  payload: Uint8Array,
): Promise<boolean> {
  const pubRaw = Uint8Array.from(atob(publicKey), (c) => c.charCodeAt(0));
  const pubKey = await crypto.subtle.importKey(
    'raw',
    pubRaw as BufferSource,
    { name: 'Ed25519' },
    false,
    ['verify'],
  );
  const sigBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
  return crypto.subtle.verify(
    'Ed25519',
    pubKey,
    sigBytes as BufferSource,
    payload as BufferSource,
  );
}

describe('signingKeys: key rotation (Wave 8 Part D)', () => {
  beforeEach(async () => {
    await wipeSigningDb();
  });

  it('rotateKey produces a new active key; the previous key is retired but listed', async () => {
    await createSigningKey('p1');
    const before = await listKeys();
    expect(before).toHaveLength(1);
    expect(at(before, 0).retiredAt).toBeNull();

    await rotateKey('p2');

    const after = await listKeys();
    expect(after).toHaveLength(2);
    const active = await getActiveKey();
    expect(active).not.toBeNull();
    expect(active?.retiredAt).toBeNull();
    const retired = after.find((k) => k.id !== active?.id);
    expect(retired).toBeDefined();
    expect(typeof retired?.retiredAt).toBe('number');
  });

  it('signs new payloads with the active (post-rotation) key', async () => {
    await createSigningKey('p1');
    const initial = await getActiveKey();
    await rotateKey('p2');
    const active = await getActiveKey();
    expect(active?.publicKey).not.toBe(initial?.publicKey);

    const payload = new TextEncoder().encode('after rotation');
    const sig = await signPayload(payload, 'p2');
    expect(sig.publicKey).toBe(active?.publicKey);
    expect(await verifyB64(sig.publicKey, sig.signature, payload)).toBe(true);
  });

  it('signWithKey can re-sign / verify with a retired key (still in store)', async () => {
    await createSigningKey('p1');
    const original = await getActiveKey();
    expect(original).not.toBeNull();
    await rotateKey('p2');

    const payload = new TextEncoder().encode('historical');
    const oldId = original?.id ?? '';
    const sig = await signWithKey(payload, 'p1', oldId);
    expect(sig.publicKey).toBe(original?.publicKey);
    expect(await verifyB64(sig.publicKey, sig.signature, payload)).toBe(true);
  });

  it('three-key rotation: oldest key still verifies a signature it produced', async () => {
    await createSigningKey('p1');
    const k1 = await getActiveKey();
    expect(k1).not.toBeNull();
    const payload = new TextEncoder().encode('signed-with-k1');
    const sigFromK1 = await signPayload(payload, 'p1');

    await rotateKey('p2');
    await rotateKey('p3');

    const all = await listKeys();
    expect(all).toHaveLength(3);
    // The oldest key's public key is still present and still verifies.
    expect(await verifyB64(sigFromK1.publicKey, sigFromK1.signature, payload)).toBe(
      true,
    );
  });
});

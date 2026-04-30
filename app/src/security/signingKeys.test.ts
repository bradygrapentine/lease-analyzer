import { beforeEach, describe, it, expect } from 'vitest';
// fake-indexeddb is loaded globally via src/test/setup.ts.
import {
  hasSigningKey,
  createSigningKey,
  signPayload,
  exportPublicKey,
  _resetSigningDbForTests,
  SIGNING_DB_NAME,
} from './signingKeys';
import { WrongPassphraseError } from '../storage/archive';

// Helper to wipe the signing DB between tests so we always start clean.
async function wipeSigningDb(): Promise<void> {
  await _resetSigningDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(SIGNING_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

describe('signingKeys (Ed25519, passphrase-wrapped, IndexedDB)', () => {
  beforeEach(async () => {
    await wipeSigningDb();
  });

  it('reports no signing key before createSigningKey runs', async () => {
    expect(await hasSigningKey()).toBe(false);
    expect(await exportPublicKey()).toBeNull();
  });

  it('creates a keypair, then reports hasSigningKey=true and a base64 public key', async () => {
    await createSigningKey('hunter2');
    expect(await hasSigningKey()).toBe(true);
    const pub = await exportPublicKey();
    expect(typeof pub).toBe('string');
    // Ed25519 raw public keys are 32 bytes => 44 chars base64 (with padding).
    expect((pub ?? '').length).toBeGreaterThan(0);
    expect(pub).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it('refuses to create a key when one already exists', async () => {
    await createSigningKey('first');
    await expect(createSigningKey('second')).rejects.toThrow(/already exists/i);
  });

  it('signPayload produces a base64 signature that verifies against the stored public key', async () => {
    await createSigningKey('correct horse');
    const payload = new TextEncoder().encode('important document');
    const { signature, publicKey } = await signPayload(payload, 'correct horse');
    expect(signature).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(publicKey).toMatch(/^[A-Za-z0-9+/=]+$/);

    // Verify the signature with WebCrypto directly.
    const pubRaw = Uint8Array.from(atob(publicKey), (c) => c.charCodeAt(0));
    const pubKey = await crypto.subtle.importKey(
      'raw',
      pubRaw as BufferSource,
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    const sigBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
    const ok = await crypto.subtle.verify(
      'Ed25519',
      pubKey,
      sigBytes as BufferSource,
      payload as BufferSource,
    );
    expect(ok).toBe(true);
  });

  it('throws WrongPassphraseError on a bad passphrase', async () => {
    await createSigningKey('right');
    const payload = new TextEncoder().encode('payload');
    await expect(signPayload(payload, 'wrong')).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it('throws a clear error when no key exists and signPayload is called', async () => {
    const payload = new TextEncoder().encode('x');
    await expect(signPayload(payload, 'any')).rejects.toThrow(/no signing key/i);
  });

  it('exportPublicKey is stable and matches signPayload.publicKey', async () => {
    await createSigningKey('p');
    const pubA = await exportPublicKey();
    const pubB = await exportPublicKey();
    expect(pubA).toBe(pubB);
    const { publicKey } = await signPayload(new TextEncoder().encode('z'), 'p');
    expect(publicKey).toBe(pubA);
  });
});

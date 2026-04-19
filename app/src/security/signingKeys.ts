import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { WrongPassphraseError } from '../storage/archive';

/**
 * Local Ed25519 signing keypair, stored in a *separate* IndexedDB from the
 * main lease store. The private key is encrypted at rest with AES-GCM using
 * a key derived from the user's passphrase (PBKDF2 / SHA-256 / 200k).
 *
 * Threat model (kept tight on purpose):
 *   - Protects against a drive-by/offline reader of the IndexedDB files.
 *   - Does NOT protect against a live attacker who can modify the running
 *     app, install a keylogger, or read memory. This is a local-first
 *     signing key, not an HSM.
 */

export const SIGNING_DB_NAME = 'leaseguard-signing';
const SIGNING_DB_VERSION = 1;
const STORE = 'keypair';
const KEY_ID = 'active';

const SALT_LEN = 16;
const IV_LEN = 12;
const PBKDF2_ITERATIONS = 200_000;

interface StoredKeypair {
  id: string;
  // Raw Ed25519 public key (32 bytes), base64url-ish ordinary base64.
  publicKeyB64: string;
  // PBKDF2 salt used to derive the wrapping key.
  salt: Uint8Array;
  // AES-GCM IV used when wrapping the private key.
  iv: Uint8Array;
  // AES-GCM-encrypted PKCS#8 Ed25519 private key.
  wrappedPrivate: Uint8Array;
  createdAt: number;
}

interface SigningSchema extends DBSchema {
  [STORE]: {
    key: string;
    value: StoredKeypair;
  };
}

let dbPromise: Promise<IDBPDatabase<SigningSchema>> | null = null;

export function _resetSigningDbForTests(): void {
  // Close the cached handle so fake-indexeddb's deleteDatabase isn't blocked.
  if (dbPromise) {
    void dbPromise.then((db) => {
      db.close();
    });
  }
  dbPromise = null;
}

async function openSigningDb(): Promise<IDBPDatabase<SigningSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<SigningSchema>(SIGNING_DB_NAME, SIGNING_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function hasSigningKey(): Promise<boolean> {
  const db = await openSigningDb();
  const existing = await db.get(STORE, KEY_ID);
  return !!existing;
}

export async function exportPublicKey(): Promise<string | null> {
  const db = await openSigningDb();
  const existing = await db.get(STORE, KEY_ID);
  return existing ? existing.publicKeyB64 : null;
}

export async function createSigningKey(passphrase: string): Promise<void> {
  const db = await openSigningDb();
  const existing = await db.get(STORE, KEY_ID);
  if (existing) {
    throw new Error('Signing key already exists; delete it before creating a new one.');
  }
  const kp = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const pubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const privPkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey));
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const wrapKey = await deriveWrapKey(passphrase, salt);
  const wrapped = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      wrapKey,
      privPkcs8 as BufferSource,
    ),
  );
  const record: StoredKeypair = {
    id: KEY_ID,
    publicKeyB64: bytesToBase64(pubRaw),
    salt,
    iv,
    wrappedPrivate: wrapped,
    createdAt: Date.now(),
  };
  await db.put(STORE, record);
}

export async function signPayload(
  payload: Uint8Array,
  passphrase: string,
): Promise<{ signature: string; publicKey: string }> {
  const db = await openSigningDb();
  const existing = await db.get(STORE, KEY_ID);
  if (!existing) {
    throw new Error('No signing key present. Call createSigningKey first.');
  }
  const wrapKey = await deriveWrapKey(passphrase, existing.salt);
  let privPkcs8: ArrayBuffer;
  try {
    privPkcs8 = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: existing.iv as BufferSource },
      wrapKey,
      existing.wrappedPrivate as BufferSource,
    );
  } catch {
    throw new WrongPassphraseError();
  }
  const privKey = await crypto.subtle.importKey(
    'pkcs8',
    privPkcs8,
    { name: 'Ed25519' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign('Ed25519', privKey, payload as BufferSource),
  );
  return {
    signature: bytesToBase64(sig),
    publicKey: existing.publicKeyB64,
  };
}

async function deriveWrapKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase) as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(bin);
}

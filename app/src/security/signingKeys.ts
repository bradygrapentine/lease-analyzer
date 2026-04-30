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
 *
 * Wave 8 Part D — multi-key layout (v2). Records are stored keyed by a
 * stable `id` like 'k0', 'k1', ... The "active" key is the one with
 * `retiredAt === null`. Older keys are retained so historical signatures
 * can still be verified (and re-signed for audit-export use cases).
 */

export const SIGNING_DB_NAME = 'leaseguard-signing';
const SIGNING_DB_VERSION = 2;
const STORE = 'keypair';
// v1 single-key id; only used during the v1->v2 migration path.
const V1_KEY_ID = 'active';
const V2_KEY_PREFIX = 'k';

const SALT_LEN = 16;
const IV_LEN = 12;
const PBKDF2_ITERATIONS = 200_000;

interface StoredKeypair {
  /** v2: 'k0', 'k1', ... */
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
  /** null = active; epoch ms = retired-at timestamp. */
  retiredAt: number | null;
}

interface SigningSchema extends DBSchema {
  [STORE]: {
    key: string;
    value: StoredKeypair;
  };
}

/** Public-facing key record (no secret material). */
export interface KeyRecord {
  id: string;
  createdAt: number;
  retiredAt: number | null;
  publicKey: string;
}

let dbPromise: Promise<IDBPDatabase<SigningSchema>> | null = null;

export async function _resetSigningDbForTests(): Promise<void> {
  // Close the cached handle so fake-indexeddb's deleteDatabase isn't blocked.
  // Await the close so any in-flight reads on the previous handle settle
  // before the next test reopens — otherwise a concurrent getAll() can race
  // the close and reject with InvalidStateError as an unhandled rejection.
  const prev = dbPromise;
  dbPromise = null;
  if (prev) {
    try {
      const db = await prev;
      db.close();
    } catch {
      // Swallow open failures from the previous test — the handle is being
      // discarded anyway.
    }
  }
}

async function openSigningDb(): Promise<IDBPDatabase<SigningSchema>> {
  if (!dbPromise) {
    dbPromise = (async (): Promise<IDBPDatabase<SigningSchema>> => {
      const db = await openDB<SigningSchema>(SIGNING_DB_NAME, SIGNING_DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE, { keyPath: 'id' });
          }
          // The data-shape migration (v1 single record -> v2 multi-key) is
          // performed in `migrateV1ToV2IfNeeded` after the upgrade tx
          // closes, to avoid awaiting WebCrypto promises inside an open IDB
          // transaction (see docs/CLAUDE.md "IDB tx + WebCrypto").
        },
      });
      await migrateV1ToV2IfNeeded(db);
      return db;
    })();
  }
  return dbPromise;
}

async function migrateV1ToV2IfNeeded(db: IDBPDatabase<SigningSchema>): Promise<void> {
  const legacy = await db.get(STORE, V1_KEY_ID);
  if (!legacy) return;
  const migrated: StoredKeypair = {
    id: `${V2_KEY_PREFIX}0`,
    publicKeyB64: legacy.publicKeyB64,
    salt: legacy.salt,
    iv: legacy.iv,
    wrappedPrivate: legacy.wrappedPrivate,
    createdAt: legacy.createdAt,
    retiredAt: (legacy as Partial<StoredKeypair>).retiredAt ?? null,
  };
  const tx = db.transaction(STORE, 'readwrite');
  await tx.objectStore(STORE).delete(V1_KEY_ID);
  await tx.objectStore(STORE).put(migrated);
  await tx.done;
}

function toRecord(kp: StoredKeypair): KeyRecord {
  return {
    id: kp.id,
    createdAt: kp.createdAt,
    retiredAt: kp.retiredAt,
    publicKey: kp.publicKeyB64,
  };
}

async function getAll(db: IDBPDatabase<SigningSchema>): Promise<StoredKeypair[]> {
  const all = await db.getAll(STORE);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

function findActive(all: StoredKeypair[]): StoredKeypair | undefined {
  // Active = retiredAt === null. If multiple (shouldn't happen), pick newest.
  const active = all.filter((k) => k.retiredAt === null);
  active.sort((a, b) => b.createdAt - a.createdAt);
  return active[0];
}

function nextKeyId(all: StoredKeypair[]): string {
  let max = -1;
  for (const k of all) {
    if (k.id.startsWith(V2_KEY_PREFIX)) {
      const n = Number(k.id.slice(V2_KEY_PREFIX.length));
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `${V2_KEY_PREFIX}${max + 1}`;
}

export async function hasSigningKey(): Promise<boolean> {
  const db = await openSigningDb();
  const all = await getAll(db);
  return findActive(all) !== undefined;
}

export async function exportPublicKey(): Promise<string | null> {
  const db = await openSigningDb();
  const all = await getAll(db);
  const active = findActive(all);
  return active ? active.publicKeyB64 : null;
}

export async function listKeys(): Promise<KeyRecord[]> {
  const db = await openSigningDb();
  const all = await getAll(db);
  return all.map(toRecord);
}

export async function getActiveKey(): Promise<KeyRecord | null> {
  const db = await openSigningDb();
  const all = await getAll(db);
  const active = findActive(all);
  return active ? toRecord(active) : null;
}

export async function createSigningKey(passphrase: string): Promise<void> {
  const db = await openSigningDb();
  const all = await getAll(db);
  if (findActive(all)) {
    throw new Error('Signing key already exists; delete it before creating a new one.');
  }
  const id = nextKeyId(all);
  const record = await buildKeyRecord(passphrase, id);
  await db.put(STORE, record);
}

export async function rotateKey(passphrase: string): Promise<{ id: string; publicKey: string }> {
  const db = await openSigningDb();
  const all = await getAll(db);
  const prev = findActive(all);
  // Build the new key OUTSIDE any IDB tx (WebCrypto would auto-commit it).
  const id = nextKeyId(all);
  const record = await buildKeyRecord(passphrase, id);

  // Now perform the storage swap in a single readwrite tx.
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  if (prev) {
    const retired: StoredKeypair = { ...prev, retiredAt: Date.now() };
    await store.put(retired);
  }
  await store.put(record);
  await tx.done;
  return { id: record.id, publicKey: record.publicKeyB64 };
}

async function buildKeyRecord(passphrase: string, id: string): Promise<StoredKeypair> {
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
  return {
    id,
    publicKeyB64: bytesToBase64(pubRaw),
    salt,
    iv,
    wrappedPrivate: wrapped,
    createdAt: Date.now(),
    retiredAt: null,
  };
}

export async function signPayload(
  payload: Uint8Array,
  passphrase: string,
): Promise<{ signature: string; publicKey: string; keyId: string }> {
  const db = await openSigningDb();
  const all = await getAll(db);
  const active = findActive(all);
  if (!active) {
    throw new Error('No signing key present. Call createSigningKey first.');
  }
  return signWithRecord(active, payload, passphrase);
}

export async function signWithKey(
  payload: Uint8Array,
  passphrase: string,
  keyId: string,
): Promise<{ signature: string; publicKey: string; keyId: string }> {
  const db = await openSigningDb();
  const record = await db.get(STORE, keyId);
  if (!record) {
    throw new Error(`No signing key with id "${keyId}".`);
  }
  return signWithRecord(record, payload, passphrase);
}

async function signWithRecord(
  record: StoredKeypair,
  payload: Uint8Array,
  passphrase: string,
): Promise<{ signature: string; publicKey: string; keyId: string }> {
  const wrapKey = await deriveWrapKey(passphrase, record.salt);
  let privPkcs8: ArrayBuffer;
  try {
    privPkcs8 = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: record.iv as BufferSource },
      wrapKey,
      record.wrappedPrivate as BufferSource,
    );
  } catch {
    throw new WrongPassphraseError();
  }
  const privKey = await crypto.subtle.importKey('pkcs8', privPkcs8, { name: 'Ed25519' }, false, [
    'sign',
  ]);
  const sig = new Uint8Array(await crypto.subtle.sign('Ed25519', privKey, payload as BufferSource));
  return {
    signature: bytesToBase64(sig),
    publicKey: record.publicKeyB64,
    keyId: record.id,
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

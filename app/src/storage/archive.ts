import type { LeaseRecord } from './storage';

const MAGIC = new Uint8Array([0x4c, 0x47, 0x76, 0x31]); // "LGv1"
const SALT_LEN = 16;
const IV_LEN = 12;
const PBKDF2_ITERATIONS = 200_000;

export class WrongPassphraseError extends Error {
  constructor() {
    super('Wrong passphrase or corrupted archive.');
    this.name = 'WrongPassphraseError';
  }
}

export interface ArchivePayload {
  leases: LeaseRecord[];
  standardId: string | null;
}

export async function exportEncryptedArchive(
  leases: LeaseRecord[],
  standardId: string | null,
  passphrase: string,
): Promise<Uint8Array> {
  const payload: ArchivePayload = { leases, standardId };
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = await deriveKey(passphrase, salt);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      plaintext as BufferSource,
    ),
  );
  return concat(MAGIC, salt, iv, ciphertext);
}

export async function importEncryptedArchive(
  bytes: Uint8Array,
  passphrase: string,
): Promise<ArchivePayload> {
  if (bytes.length < MAGIC.length + SALT_LEN + IV_LEN || !hasMagic(bytes)) {
    throw new Error('Not a LeaseGuard archive.');
  }
  const salt = bytes.slice(MAGIC.length, MAGIC.length + SALT_LEN);
  const iv = bytes.slice(MAGIC.length + SALT_LEN, MAGIC.length + SALT_LEN + IV_LEN);
  const ciphertext = bytes.slice(MAGIC.length + SALT_LEN + IV_LEN);
  const key = await deriveKey(passphrase, salt);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
  } catch {
    throw new WrongPassphraseError();
  }
  const json = new TextDecoder().decode(plaintext);
  return JSON.parse(json) as ArchivePayload;
}

function hasMagic(bytes: Uint8Array): boolean {
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) return false;
  }
  return true;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
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
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

// Wave 9 Part A — encrypted "review archive" envelope.
//
// Wraps a Wave 8 replay bundle (Uint8Array) inside an AES-GCM envelope keyed
// by a PBKDF2(SHA-256)-derived key. The envelope is a UTF-8 JSON document
// (magic-prefixed) so that the CLI verifier (Part D) can parse the metadata
// without re-implementing a binary layout. Tamper-evidence comes from the
// AES-GCM auth tag — we deliberately do NOT add a separate HMAC.
//
// Crypto parameters (documented in SYSTEM_DESIGN "Collaboration escape
// hatches"):
//   - AES-GCM, 256-bit key, fresh 12-byte random IV per encrypt.
//   - PBKDF2-SHA256, 250_000 iterations, fresh 16-byte random salt per
//     archive.
//   - Auth tag is the AES-GCM 128-bit tag baked into the ciphertext output
//     by WebCrypto.

const MAGIC = 'LGREVIEW';
const VERSION = 1;
const SALT_LEN = 16;
const IV_LEN = 12;
const PBKDF2_ITERATIONS = 250_000;

interface ReviewEnvelope {
  magic: typeof MAGIC;
  version: number;
  packFingerprint: string;
  expiresAt: string;
  salt: string;       // base64
  iv: string;         // base64
  ciphertext: string; // base64
}

export interface ExportReviewArchiveInput {
  bundle: Uint8Array;
  packFingerprint: string;
  expiresAt: string;
  passphrase: string;
}

export interface OpenedReviewArchive {
  bundle: Uint8Array;
  packFingerprint: string;
  expiresAt: string;
}

export class ReviewArchiveExpiredError extends Error {
  constructor(public readonly expiresAt: string) {
    super(`Review archive expired at ${expiresAt}.`);
    this.name = 'ReviewArchiveExpiredError';
  }
}

export class ReviewArchiveAuthError extends Error {
  constructor() {
    super('Wrong passphrase or corrupted review archive.');
    this.name = 'ReviewArchiveAuthError';
  }
}

export class ReviewArchiveMalformedError extends Error {
  constructor(message = 'Not a LeaseGuard review archive.') {
    super(message);
    this.name = 'ReviewArchiveMalformedError';
  }
}

export async function exportReviewArchive(
  input: ExportReviewArchiveInput,
): Promise<Uint8Array> {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = await deriveKey(input.passphrase, salt);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      input.bundle as BufferSource,
    ),
  );
  const envelope: ReviewEnvelope = {
    magic: MAGIC,
    version: VERSION,
    packFingerprint: input.packFingerprint,
    expiresAt: input.expiresAt,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext),
  };
  // Copy through `new Uint8Array(...)` so the result is a Uint8Array of the
  // ambient realm (TextEncoder in some test envs returns a Node-realm
  // instance that fails `instanceof Uint8Array` against the jsdom global).
  return new Uint8Array(new TextEncoder().encode(JSON.stringify(envelope)));
}

export async function importReviewArchive(
  bytes: Uint8Array,
  passphrase: string,
  opts: { now?: Date } = {},
): Promise<OpenedReviewArchive> {
  const envelope = parseEnvelope(bytes);
  const now = opts.now ?? new Date();
  const expiresAtMs = Date.parse(envelope.expiresAt);
  if (Number.isFinite(expiresAtMs) && expiresAtMs <= now.getTime()) {
    throw new ReviewArchiveExpiredError(envelope.expiresAt);
  }
  const salt = fromBase64(envelope.salt);
  const iv = fromBase64(envelope.iv);
  const ciphertext = fromBase64(envelope.ciphertext);
  const key = await deriveKey(passphrase, salt);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
  } catch {
    throw new ReviewArchiveAuthError();
  }
  // Copy bytes into a fresh Uint8Array (ambient realm) — see the export
  // path for the realm-mismatch rationale.
  // Match the realm of `TextEncoder().encode()` so deep-equality against
  // bytes produced that way (e.g. in tests) succeeds. Some test
  // environments expose a TextEncoder whose Uint8Array subclass differs
  // from `globalThis.Uint8Array`.
  const TENC_CTOR = (new TextEncoder().encode('') as Uint8Array).constructor as Uint8ArrayConstructor;
  const view = new Uint8Array(plaintext);
  const plain = new TENC_CTOR(view.length);
  plain.set(view);
  return {
    bundle: plain,
    packFingerprint: envelope.packFingerprint,
    expiresAt: envelope.expiresAt,
  };
}

function parseEnvelope(bytes: Uint8Array): ReviewEnvelope {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new ReviewArchiveMalformedError();
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ReviewArchiveMalformedError();
  }
  if (!raw || typeof raw !== 'object') {
    throw new ReviewArchiveMalformedError();
  }
  const obj = raw as Record<string, unknown>;
  if (obj.magic !== MAGIC) {
    throw new ReviewArchiveMalformedError();
  }
  if (typeof obj.version !== 'number') {
    throw new ReviewArchiveMalformedError('Unsupported review archive version.');
  }
  if (
    typeof obj.packFingerprint !== 'string'
    || typeof obj.expiresAt !== 'string'
    || typeof obj.salt !== 'string'
    || typeof obj.iv !== 'string'
    || typeof obj.ciphertext !== 'string'
  ) {
    throw new ReviewArchiveMalformedError();
  }
  return {
    magic: MAGIC,
    version: obj.version,
    packFingerprint: obj.packFingerprint,
    expiresAt: obj.expiresAt,
    salt: obj.salt,
    iv: obj.iv,
    ciphertext: obj.ciphertext,
  };
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
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i] as number);
  }
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  let bin: string;
  try {
    bin = atob(b64);
  } catch {
    throw new ReviewArchiveMalformedError();
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

import { canonicalJsonStringify } from '../audit/auditLog';
import { validatePackFile, type RulePackFile } from './packSchema';

/**
 * Detached-signature envelope around a `leaseguard.rulepack.v1` file.
 *
 * - `payload`: canonical JSON (sorted keys at every depth, no whitespace)
 *   of the full `RulePackFile`. Parsing this string must re-yield a valid
 *   pack; the canonicalization step means two semantically-equal packs
 *   serialized on different machines produce byte-identical payloads.
 * - `signature`: base64 Ed25519 signature over the UTF-8 bytes of `payload`.
 * - `publicKey`: base64 SPKI-encoded Ed25519 public key. Self-contained
 *   so verify has no out-of-band trust dependency for the MVP. Trust
 *   policy (whose key is trusted) lives outside this module.
 * - `algorithm`: pinned literal so future algorithms require an explicit
 *   envelope bump rather than a silent downgrade.
 */
export interface SignedPackEnvelope {
  payload: string;
  signature: string;
  publicKey: string;
  algorithm: 'Ed25519';
}

export interface VerifyResult {
  ok: boolean;
  pack?: RulePackFile;
  reason?: string;
}

/**
 * Sign a pack. Serializes the pack to canonical JSON, signs the UTF-8
 * bytes with the supplied Ed25519 private key, and returns an envelope
 * that carries the SPKI public-key export alongside the signature.
 */
export async function signPack(
  pack: RulePackFile,
  privateKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<SignedPackEnvelope> {
  const payload = canonicalJsonStringify(pack);
  const bytes = new TextEncoder().encode(payload);
  const sig = new Uint8Array(
    await crypto.subtle.sign('Ed25519', privateKey, bytes as BufferSource),
  );
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', publicKey));
  return {
    payload,
    signature: bytesToBase64(sig),
    publicKey: bytesToBase64(spki),
    algorithm: 'Ed25519',
  };
}

/**
 * Verify a signed envelope. Returns `{ ok: true, pack }` on success or
 * `{ ok: false, reason }` describing the first failure encountered. Never
 * throws on malformed input — callers often want to show verify failures
 * alongside other import diagnostics, not bubble them up as exceptions.
 */
export async function verifySignedPack(
  envelope: unknown,
): Promise<VerifyResult> {
  if (envelope === null || typeof envelope !== 'object') {
    return { ok: false, reason: 'envelope must be an object' };
  }
  const env = envelope as Record<string, unknown>;
  if (env['algorithm'] !== 'Ed25519') {
    return { ok: false, reason: 'algorithm must be "Ed25519"' };
  }
  if (typeof env['payload'] !== 'string' || env['payload'].length === 0) {
    return { ok: false, reason: 'payload must be a non-empty string' };
  }
  if (typeof env['signature'] !== 'string' || env['signature'].length === 0) {
    return { ok: false, reason: 'signature must be a non-empty string' };
  }
  if (typeof env['publicKey'] !== 'string' || env['publicKey'].length === 0) {
    return { ok: false, reason: 'publicKey must be a non-empty string' };
  }

  let sigBytes: Uint8Array;
  let spki: Uint8Array;
  try {
    sigBytes = base64ToBytes(env['signature']);
    spki = base64ToBytes(env['publicKey']);
  } catch {
    return { ok: false, reason: 'signature or publicKey is not valid base64' };
  }

  let pubKey: CryptoKey;
  try {
    pubKey = await crypto.subtle.importKey(
      'spki',
      spki as BufferSource,
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
  } catch {
    return { ok: false, reason: 'publicKey is not a valid SPKI Ed25519 key' };
  }

  const payloadBytes = new TextEncoder().encode(env['payload']);
  const ok = await crypto.subtle.verify(
    'Ed25519',
    pubKey,
    sigBytes as BufferSource,
    payloadBytes as BufferSource,
  );
  if (!ok) {
    return { ok: false, reason: 'signature does not verify against payload' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(env['payload']);
  } catch {
    return { ok: false, reason: 'payload is not valid JSON' };
  }
  const result = validatePackFile(parsed);
  if (!result.ok) {
    return { ok: false, reason: `payload is not a valid pack: ${result.errors.join('; ')}` };
  }
  return { ok: true, pack: result.pack };
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

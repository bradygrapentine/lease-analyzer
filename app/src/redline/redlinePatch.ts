/**
 * Wave 9 Part B — Counter-sign-and-return patch format.
 *
 * A `RedlinePatch` is what a reviewer (e.g. a co-tenant or lawyer) emits
 * after triaging another party's redline edits. It carries per-edit
 * accept/reject decisions plus an Ed25519 signature over the canonical
 * representation so the original author can verify the patch hasn't been
 * tampered with in transit.
 *
 * The signature covers a canonical-JSON view of {archiveFingerprint,
 * decisions[], signedByKeyId, signedByPublicKey} — i.e. everything *but*
 * the signature itself. Public key is embedded so verification is
 * self-contained; the recipient still cross-checks `archiveFingerprint`
 * against their local archive before applying.
 */

export interface PatchDecision {
  editId: string;
  accepted: boolean;
}

export interface RedlinePatch {
  archiveFingerprint: string;
  decisions: PatchDecision[];
  /** base64 Ed25519 signature over the signing payload. */
  signature: string;
  signedByKeyId: string;
  /** base64 SPKI Ed25519 public key. */
  signedByPublicKey: string;
}

export interface BuildRedlinePatchInput {
  archiveFingerprint: string;
  knownEditIds: readonly string[];
  decisions: PatchDecision[];
  signingKey: CryptoKeyPair;
  signedByKeyId: string;
}

/**
 * JSON.stringify with object keys sorted lexicographically at every depth.
 * Matches the audit-log canonicalisation so signatures are reproducible.
 */
function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    sorted[k] = canonicalize(obj[k]);
  }
  return sorted;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

interface SigningPayload {
  archiveFingerprint: string;
  decisions: PatchDecision[];
  signedByKeyId: string;
  signedByPublicKey: string;
}

function encodeSigningPayload(p: SigningPayload): Uint8Array {
  return new TextEncoder().encode(canonicalJsonStringify(p));
}

export async function buildRedlinePatch(
  input: BuildRedlinePatchInput,
): Promise<RedlinePatch> {
  const { archiveFingerprint, knownEditIds, decisions, signingKey, signedByKeyId } =
    input;

  const known = new Set(knownEditIds);
  for (const d of decisions) {
    if (!known.has(d.editId)) {
      throw new Error(
        `redlinePatch: decision references unknown editId "${d.editId}"`,
      );
    }
  }

  const pubRaw = new Uint8Array(
    await crypto.subtle.exportKey('spki', signingKey.publicKey),
  );
  const signedByPublicKey = bytesToBase64(pubRaw);

  const payload = encodeSigningPayload({
    archiveFingerprint,
    decisions,
    signedByKeyId,
    signedByPublicKey,
  });
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'Ed25519' } as unknown as AlgorithmIdentifier,
      signingKey.privateKey,
      payload as BufferSource,
    ),
  );

  return {
    archiveFingerprint,
    decisions: [...decisions],
    signature: bytesToBase64(sig),
    signedByKeyId,
    signedByPublicKey,
  };
}

export async function verifyRedlinePatch(
  patch: RedlinePatch,
): Promise<{ ok: boolean }> {
  try {
    const pubRaw = base64ToBytes(patch.signedByPublicKey);
    const pubKey = await crypto.subtle.importKey(
      'spki',
      pubRaw as BufferSource,
      { name: 'Ed25519' } as unknown as AlgorithmIdentifier,
      true,
      ['verify'],
    );
    const payload = encodeSigningPayload({
      archiveFingerprint: patch.archiveFingerprint,
      decisions: patch.decisions,
      signedByKeyId: patch.signedByKeyId,
      signedByPublicKey: patch.signedByPublicKey,
    });
    const sig = base64ToBytes(patch.signature);
    const ok = await crypto.subtle.verify(
      { name: 'Ed25519' } as unknown as AlgorithmIdentifier,
      pubKey,
      sig as BufferSource,
      payload as BufferSource,
    );
    return { ok };
  } catch {
    return { ok: false };
  }
}

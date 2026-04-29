/**
 * Wave 46 Item C — short SHA-256 fingerprint of a raw Ed25519 public key.
 *
 * Returns the first 4 bytes of `SHA-256(rawPublicKeyBytes)` as 8 lowercase
 * hex characters. Short enough to read aloud over the phone, long enough that
 * a random collision is roughly 1 in 4 billion.
 *
 * This fingerprint is *informational*: a match between two fingerprints is
 * evidence the underlying public-key bytes match, not proof of the key
 * holder's identity. It is used as an out-of-band comparison artifact for
 * signed-export verification.
 */
export async function computeShortFingerprint(rawPublicKeyBytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', rawPublicKeyBytes as BufferSource);
  const view = new Uint8Array(digest).slice(0, 4);
  let out = '';
  for (let i = 0; i < view.length; i++) {
    const b = view[i] ?? 0;
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * Convenience wrapper that decodes a base64 public key (the format
 * `signingKeys.exportPublicKey` returns) before fingerprinting.
 */
export async function computeShortFingerprintFromBase64(
  publicKeyB64: string,
): Promise<string | null> {
  let bin: string;
  try {
    bin = atob(publicKeyB64);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return computeShortFingerprint(bytes);
}

/**
 * SHA-256 of a byte sequence, returned as a 64-char lowercase hex string.
 * Uses WebCrypto; works in browsers and in Node 20+ (and jsdom under Vitest).
 */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] ?? 0;
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}

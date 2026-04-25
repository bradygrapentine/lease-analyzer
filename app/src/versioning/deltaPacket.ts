/**
 * Wave 9 Part C — Delta packets.
 *
 * A signed, transferable diff between two lease versions. The recipient
 * uses `applyDeltaPacket` (in `applyDelta.ts`) to verify the signature,
 * confirm their local base bytes hash to `baseInputHash`, and apply the
 * line-level patch.
 *
 * The signature covers a canonical JSON encoding of every field except
 * `signature` itself. The signer's public key is embedded (SPKI base64)
 * so verification does not depend on a live key directory — this matches
 * Wave 8-D semantics where retired keys remain verification-only.
 *
 * No network egress: signing and verification are pure WebCrypto.
 */

export interface DeltaPacket {
  baseInputHash: string;
  targetInputHash: string;
  changes: string;
  rulePackVersion: string;
  signature: string;
  signedByKeyId: string;
  signedByPublicKey: string;
}

interface BuildInput {
  baseBytes: Uint8Array;
  targetBytes: Uint8Array;
  rulePackVersion: string;
  signingKey: CryptoKeyPair;
  signedByKeyId: string;
}

const ED25519: AlgorithmIdentifier = { name: 'Ed25519' } as unknown as AlgorithmIdentifier;

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] as number);
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  const arr = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < arr.length; i++) {
    const b = arr[i] as number;
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Canonicalize lease bytes for hashing/diffing.
 * Normalize CRLF/CR -> LF so equivalent files round-trip identically.
 */
function canonicalize(bytes: Uint8Array): Uint8Array {
  const text = new TextDecoder().decode(bytes);
  const norm = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return new TextEncoder().encode(norm);
}

/**
 * LCS-based unified-style line diff. The format is intentionally simple
 * and self-describing so `applyDelta` can parse it without a third-party
 * library:
 *
 *   ` line`  — context (kept)
 *   `-line`  — removed from base
 *   `+line`  — added in target
 *
 * Lines are joined with `\n`. A trailing `\n` is appended so consumers
 * can split on `\n` and ignore the empty tail.
 */
export function diffLines(baseText: string, targetText: string): string {
  const a = baseText.split('\n');
  const b = targetText.split('\n');
  const m = a.length;
  const n = b.length;
  // LCS length table.
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      const row = dp[i] as number[];
      const next = dp[i + 1] as number[];
      if (a[i] === b[j]) {
        row[j] = (next[j + 1] as number) + 1;
      } else {
        const down = next[j] as number;
        const right = row[j + 1] as number;
        row[j] = down >= right ? down : right;
      }
    }
  }
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push(' ' + (a[i] as string));
      i++;
      j++;
    } else {
      const next = dp[i + 1] as number[];
      const row = dp[i] as number[];
      const down = next[j] as number;
      const right = row[j + 1] as number;
      if (down >= right) {
        out.push('-' + (a[i] as string));
        i++;
      } else {
        out.push('+' + (b[j] as string));
        j++;
      }
    }
  }
  while (i < m) {
    out.push('-' + (a[i] as string));
    i++;
  }
  while (j < n) {
    out.push('+' + (b[j] as string));
    j++;
  }
  return out.join('\n') + '\n';
}

/**
 * Apply a `diffLines` patch to `baseText` and return the merged text.
 * Throws on a malformed patch line.
 */
export function applyLineDiff(baseText: string, patch: string): string {
  const baseLines = baseText.split('\n');
  const out: string[] = [];
  let bi = 0;
  // Drop the trailing empty string from the final '\n' separator.
  const lines = patch.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  for (const raw of lines) {
    if (raw.length === 0) {
      // A blank patch line shouldn't occur — tag was required.
      throw new Error('malformed delta: empty patch line');
    }
    const tag = raw[0] as string;
    const content = raw.slice(1);
    if (tag === ' ') {
      if (baseLines[bi] !== content) {
        throw new Error('delta context mismatch at line ' + String(bi));
      }
      out.push(content);
      bi++;
    } else if (tag === '-') {
      if (baseLines[bi] !== content) {
        throw new Error('delta removal mismatch at line ' + String(bi));
      }
      bi++;
    } else if (tag === '+') {
      out.push(content);
    } else {
      throw new Error('malformed delta: unknown tag ' + tag);
    }
  }
  if (bi !== baseLines.length) {
    throw new Error('delta did not consume full base');
  }
  return out.join('\n');
}

/** Stable JSON of the signed payload (every field except `signature`). */
function signedPayloadJson(p: Omit<DeltaPacket, 'signature'>): string {
  // Sort keys alphabetically for canonical signing.
  const ordered = {
    baseInputHash: p.baseInputHash,
    changes: p.changes,
    rulePackVersion: p.rulePackVersion,
    signedByKeyId: p.signedByKeyId,
    signedByPublicKey: p.signedByPublicKey,
    targetInputHash: p.targetInputHash,
  };
  return JSON.stringify(ordered);
}

export async function buildDeltaPacket(input: BuildInput): Promise<DeltaPacket> {
  const baseCanon = canonicalize(input.baseBytes);
  const targetCanon = canonicalize(input.targetBytes);
  const baseInputHash = await sha256Hex(baseCanon);
  const targetInputHash = await sha256Hex(targetCanon);
  const changes = diffLines(new TextDecoder().decode(baseCanon), new TextDecoder().decode(targetCanon));
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', input.signingKey.publicKey));
  const signedByPublicKey = toBase64(spki);
  const payload: Omit<DeltaPacket, 'signature'> = {
    baseInputHash,
    changes,
    rulePackVersion: input.rulePackVersion,
    signedByKeyId: input.signedByKeyId,
    signedByPublicKey,
    targetInputHash,
  };
  const sigBuf = await crypto.subtle.sign(
    ED25519,
    input.signingKey.privateKey,
    new TextEncoder().encode(signedPayloadJson(payload)) as unknown as BufferSource,
  );
  const signature = toBase64(new Uint8Array(sigBuf));
  return { ...payload, signature };
}

export async function verifyDeltaPacket(packet: DeltaPacket): Promise<{ ok: boolean }> {
  try {
    const spki = fromBase64(packet.signedByPublicKey);
    const pub = await crypto.subtle.importKey(
      'spki',
      spki as unknown as BufferSource,
      ED25519,
      true,
      ['verify'],
    );
    const sig = fromBase64(packet.signature);
    const { signature: _sig, ...rest } = packet;
    void _sig;
    const ok = await crypto.subtle.verify(
      ED25519,
      pub,
      sig as unknown as BufferSource,
      new TextEncoder().encode(signedPayloadJson(rest)) as unknown as BufferSource,
    );
    return { ok };
  } catch {
    return { ok: false };
  }
}

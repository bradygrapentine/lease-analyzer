/**
 * Wave 9 Part C — apply a signed delta packet to a recipient's local
 * lease bytes. Verifies the signature, checks `baseInputHash` against
 * the recipient's bytes (refusing on drift), and applies the line patch.
 */

import { applyLineDiff, verifyDeltaPacket, type DeltaPacket } from './deltaPacket';

interface ApplyInput {
  packet: DeltaPacket;
  localBaseBytes: Uint8Array;
}

interface ApplyResult {
  mergedBytes: Uint8Array;
}

function canonicalize(bytes: Uint8Array): Uint8Array {
  const text = new TextDecoder().decode(bytes);
  const norm = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return new TextEncoder().encode(norm);
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

export async function applyDeltaPacket(input: ApplyInput): Promise<ApplyResult> {
  const verified = await verifyDeltaPacket(input.packet);
  if (!verified.ok) {
    throw new Error('delta signature did not verify');
  }
  const canon = canonicalize(input.localBaseBytes);
  const localHash = await sha256Hex(canon);
  if (localHash !== input.packet.baseInputHash) {
    throw new Error(
      'version mismatch: local baseInputHash ' +
        localHash +
        ' does not match packet baseInputHash ' +
        input.packet.baseInputHash,
    );
  }
  const mergedText = applyLineDiff(new TextDecoder().decode(canon), input.packet.changes);
  return { mergedBytes: new TextEncoder().encode(mergedText) };
}

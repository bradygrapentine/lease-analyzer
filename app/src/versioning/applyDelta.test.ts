import { describe, it, expect } from 'vitest';
// Wave 9 Part C — module under test does not yet exist; failing import is
// the expected red signal. The implementer creates
// `app/src/versioning/applyDelta.ts` exporting:
//
//   applyDeltaPacket(input: {
//     packet: DeltaPacket;        // see deltaPacket.ts
//     localBaseBytes: Uint8Array; // recipient's current lease bytes
//   }): Promise<{ mergedBytes: Uint8Array }>
//
// On success it MUST:
//  - call verifyDeltaPacket(packet) and refuse on bad signature
//  - hash localBaseBytes and refuse with a "version mismatch" error if it
//    doesn't equal packet.baseInputHash
//  - apply the line-diff in packet.changes and return the merged bytes
//    that line-equal the original target
import type { DeltaPacket } from './deltaPacket';
import { buildDeltaPacket } from './deltaPacket';
import { applyDeltaPacket } from './applyDelta';

async function genKey(): Promise<CryptoKeyPair> {
  return (await crypto.subtle.generateKey(
    { name: 'Ed25519' } as unknown as AlgorithmIdentifier,
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
}

function bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe('applyDeltaPacket', () => {
  it('round-trip: apply(diff(v1, v2)) on recipient v1 yields exactly v2 bytes', async () => {
    const key = await genKey();
    const v1 = bytes('rent: 1000\nterm: 12mo\n');
    const v2 = bytes('rent: 1100\nterm: 24mo\n');
    const packet = await buildDeltaPacket({
      baseBytes: v1,
      targetBytes: v2,
      rulePackVersion: '1.0.0',
      signingKey: key,
      signedByKeyId: 'key-1',
    });
    const { mergedBytes } = await applyDeltaPacket({ packet, localBaseBytes: v1 });
    expect(new TextDecoder().decode(mergedBytes)).toBe(new TextDecoder().decode(v2));
  });

  it('refuses with a clear "version mismatch" error when localBaseBytes differs from baseInputHash', async () => {
    const key = await genKey();
    const v1 = bytes('rent: 1000\n');
    const v2 = bytes('rent: 1100\n');
    const packet = await buildDeltaPacket({
      baseBytes: v1,
      targetBytes: v2,
      rulePackVersion: '1.0.0',
      signingKey: key,
      signedByKeyId: 'key-1',
    });
    const drifted = bytes('rent: 1234\n');
    await expect(
      applyDeltaPacket({ packet, localBaseBytes: drifted }),
    ).rejects.toThrow(/version mismatch|baseInputHash/i);
  });

  it('refuses to apply a delta whose signature does not verify', async () => {
    const key = await genKey();
    const v1 = bytes('a\n');
    const v2 = bytes('b\n');
    const packet = await buildDeltaPacket({
      baseBytes: v1,
      targetBytes: v2,
      rulePackVersion: '1.0.0',
      signingKey: key,
      signedByKeyId: 'key-1',
    });
    const tampered: DeltaPacket = { ...packet, signature: 'AAAA' };
    await expect(
      applyDeltaPacket({ packet: tampered, localBaseBytes: v1 }),
    ).rejects.toThrow(/signature/i);
  });
});

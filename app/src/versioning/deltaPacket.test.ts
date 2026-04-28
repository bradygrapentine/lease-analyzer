import { describe, it, expect } from 'vitest';
// Wave 9 Part C — module under test does not yet exist; failing import is
// the expected red signal. The implementer creates
// `app/src/versioning/deltaPacket.ts` exporting:
//
//   interface DeltaPacket {
//     baseInputHash: string;        // hex sha-256 of canonical base lease bytes
//     targetInputHash: string;      // hex sha-256 of canonical target lease bytes
//     changes: string;              // line-level unified diff (text)
//     rulePackVersion: string;
//     signature: string;            // base64
//     signedByKeyId: string;
//     signedByPublicKey: string;    // base64 SPKI
//   }
//
//   buildDeltaPacket(input: {
//     baseBytes: Uint8Array;
//     targetBytes: Uint8Array;
//     rulePackVersion: string;
//     signingKey: CryptoKeyPair;
//     signedByKeyId: string;
//   }): Promise<DeltaPacket>
//
//   verifyDeltaPacket(packet: DeltaPacket): Promise<{ ok: boolean }>
import { applyLineDiff, buildDeltaPacket, verifyDeltaPacket } from './deltaPacket';

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

describe('deltaPacket', () => {
  it('round-trip: build a signed delta and verify it under the embedded public key', async () => {
    const key = await genKey();
    const base = bytes('rent: 1000\nterm: 12mo\n');
    const target = bytes('rent: 1100\nterm: 12mo\n');
    const packet = await buildDeltaPacket({
      baseBytes: base,
      targetBytes: target,
      rulePackVersion: '1.0.0',
      signingKey: key,
      signedByKeyId: 'key-1',
    });
    expect(packet.changes.length).toBeGreaterThan(0);
    expect(packet.baseInputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(packet.targetInputHash).toMatch(/^[0-9a-f]{64}$/);
    const r = await verifyDeltaPacket(packet);
    expect(r.ok).toBe(true);
  });

  it('signature still verifies after the signer rotates keys (retired = verify-only)', async () => {
    // Wave 8-D semantics: a retired key can still verify previously signed
    // material. We model that by re-running verify on a packet whose key
    // material is unchanged — verifyDeltaPacket relies only on the embedded
    // signedByPublicKey, NOT a live key directory.
    const key = await genKey();
    const packet = await buildDeltaPacket({
      baseBytes: bytes('a'),
      targetBytes: bytes('b'),
      rulePackVersion: '1.0.0',
      signingKey: key,
      signedByKeyId: 'rotated-out-key',
    });
    const r = await verifyDeltaPacket(packet);
    expect(r.ok).toBe(true);
  });

  it('verifyDeltaPacket returns ok:false on a malformed signature (catch path)', async () => {
    // The catch branch fires when fromBase64 / importKey blow up before
    // the actual verify call — distinct from a "verify returned false"
    // path. Hand it a packet with a non-base64 signature.
    const key = await genKey();
    const packet = await buildDeltaPacket({
      baseBytes: bytes('a'),
      targetBytes: bytes('b'),
      rulePackVersion: '1.0.0',
      signingKey: key,
      signedByKeyId: 'key-1',
    });
    const malformed = { ...packet, signature: 'not-valid-base64-!!!' };
    const r = await verifyDeltaPacket(malformed);
    expect(r.ok).toBe(false);
  });

  it('applyLineDiff throws when the patch does not consume the full base', () => {
    // Construct a patch that only matches the first line — bi never
    // advances to baseLines.length, so the trailing guard fires.
    const baseText = 'line one\nline two\n';
    const shortPatch = ' line one\n'; // only consumes one base line
    expect(() => applyLineDiff(baseText, shortPatch)).toThrow(/did not consume full base/);
  });

  it('tampering with changes invalidates the signature', async () => {
    const key = await genKey();
    const packet = await buildDeltaPacket({
      baseBytes: bytes('a'),
      targetBytes: bytes('b'),
      rulePackVersion: '1.0.0',
      signingKey: key,
      signedByKeyId: 'key-1',
    });
    const tampered = { ...packet, changes: packet.changes + '\n+rogue line' };
    const r = await verifyDeltaPacket(tampered);
    expect(r.ok).toBe(false);
  });
});

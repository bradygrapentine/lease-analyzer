import { describe, it, expect } from 'vitest';
// Wave 9 Part B — module under test does not yet exist; failing import is
// the expected red signal. The implementer creates
// `app/src/redline/redlinePatch.ts` exporting:
//
//   interface PatchDecision {
//     editId: string;            // stable id for an edit known to the archive
//     accepted: boolean;
//   }
//
//   interface RedlinePatch {
//     archiveFingerprint: string;
//     decisions: PatchDecision[];
//     signature: string;         // base64
//     signedByKeyId: string;
//     signedByPublicKey: string; // base64 SPKI
//   }
//
//   buildRedlinePatch(input: {
//     archiveFingerprint: string;
//     knownEditIds: readonly string[];
//     decisions: PatchDecision[];
//     signingKey: CryptoKeyPair;        // Ed25519
//     signedByKeyId: string;
//   }): Promise<RedlinePatch>
//
//   verifyRedlinePatch(patch: RedlinePatch): Promise<{ ok: boolean }>
import { buildRedlinePatch, verifyRedlinePatch } from './redlinePatch';

async function genKey(): Promise<CryptoKeyPair> {
  return (await crypto.subtle.generateKey(
    { name: 'Ed25519' } as unknown as AlgorithmIdentifier,
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
}

const FINGERPRINT = 'b'.repeat(64);
const KNOWN_EDITS = ['e1', 'e2', 'e3'] as const;

describe('redlinePatch', () => {
  it('emit + verify: a fresh patch verifies under its embedded public key', async () => {
    const key = await genKey();
    const patch = await buildRedlinePatch({
      archiveFingerprint: FINGERPRINT,
      knownEditIds: KNOWN_EDITS,
      decisions: [
        { editId: 'e1', accepted: true },
        { editId: 'e2', accepted: false },
      ],
      signingKey: key,
      signedByKeyId: 'key-1',
    });
    const r = await verifyRedlinePatch(patch);
    expect(r.ok).toBe(true);
    expect(patch.archiveFingerprint).toBe(FINGERPRINT);
    expect(patch.signedByKeyId).toBe('key-1');
  });

  it('rejects decisions referencing edits the archive does not know about', async () => {
    const key = await genKey();
    await expect(
      buildRedlinePatch({
        archiveFingerprint: FINGERPRINT,
        knownEditIds: KNOWN_EDITS,
        decisions: [{ editId: 'does-not-exist', accepted: true }],
        signingKey: key,
        signedByKeyId: 'key-1',
      }),
    ).rejects.toThrow();
  });

  it('signature covers the canonical decisions list (tampering invalidates)', async () => {
    const key = await genKey();
    const patch = await buildRedlinePatch({
      archiveFingerprint: FINGERPRINT,
      knownEditIds: KNOWN_EDITS,
      decisions: [{ editId: 'e1', accepted: true }],
      signingKey: key,
      signedByKeyId: 'key-1',
    });
    const tampered = {
      ...patch,
      decisions: [{ editId: 'e1', accepted: false }], // flip the decision
    };
    const r = await verifyRedlinePatch(tampered);
    expect(r.ok).toBe(false);
  });
});

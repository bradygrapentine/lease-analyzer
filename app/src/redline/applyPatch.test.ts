import { describe, it, expect, beforeEach } from 'vitest';
// Wave 9 Part B — module under test does not yet exist; failing import is
// the expected red signal. The implementer creates
// `app/src/redline/applyPatch.ts` exporting:
//
//   applyRedlinePatch(input: {
//     patch: RedlinePatch;            // see redlinePatch.ts
//     archiveFingerprint: string;     // recipient's local fingerprint to match
//     editsByPatchId: Record<string, RedlineEdit>;
//   }): Promise<{ acceptedEditIds: string[] }>
//
// On success it MUST:
//  - verify the patch signature against patch.signedByPublicKey
//  - check archiveFingerprint matches patch.archiveFingerprint
//  - persist accepted edits to the RedlineEdit store via saveEdit()
//  - append exactly one audit entry of kind 'patch-applied' with
//    payload { archiveFingerprint, acceptedEditIds }
import type { RedlinePatch } from './redlinePatch';
import { buildRedlinePatch } from './redlinePatch';
import { applyRedlinePatch } from './applyPatch';

async function realPatch(over: Partial<RedlinePatch> = {}): Promise<RedlinePatch> {
  const keyPair = (await crypto.subtle.generateKey('Ed25519', true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const built = await buildRedlinePatch({
    archiveFingerprint: FINGERPRINT,
    knownEditIds: ['e1', 'e2'],
    decisions: [
      { editId: 'e1', accepted: true },
      { editId: 'e2', accepted: false },
    ],
    signingKey: keyPair,
    signedByKeyId: 'key-1',
  });
  return { ...built, ...over };
}
import {
  _resetRedlineDbForTests,
  listEditsForLease,
} from './redlineStorage';
import { _resetAuditDbForTests, listAuditEntries } from '../audit/auditLog';

const FINGERPRINT = 'c'.repeat(64);

beforeEach(async () => {
  _resetRedlineDbForTests();
  _resetAuditDbForTests();
  indexedDB.deleteDatabase('leaseguard-redlines');
  indexedDB.deleteDatabase('leaseguard-audit');
});

describe('applyRedlinePatch', () => {
  it('refuses to apply a patch with an invalid signature', async () => {
    const patch = await realPatch({ signature: 'tampered' });
    await expect(
      applyRedlinePatch({
        patch,
        archiveFingerprint: FINGERPRINT,
        editsByPatchId: {
          e1: { leaseId: 'L', paragraphIndex: 0, before: 'a', after: 'b', updatedAt: 'now' },
          e2: { leaseId: 'L', paragraphIndex: 1, before: 'a', after: 'b', updatedAt: 'now' },
        },
      }),
    ).rejects.toThrow(/signature/i);
  });

  it('refuses to apply when the local archive fingerprint does not match the patch', async () => {
    const patch = await realPatch();
    await expect(
      applyRedlinePatch({
        patch,
        archiveFingerprint: 'd'.repeat(64),
        editsByPatchId: {
          e1: { leaseId: 'L', paragraphIndex: 0, before: 'a', after: 'b', updatedAt: 'now' },
        },
      }),
    ).rejects.toThrow(/fingerprint|mismatch/i);
  });

  it('on success, persists exactly the accepted edits and writes one patch-applied audit entry', async () => {
    const patch = await realPatch();
    const result = await applyRedlinePatch({
      patch,
      archiveFingerprint: FINGERPRINT,
      editsByPatchId: {
        e1: { leaseId: 'L', paragraphIndex: 0, before: 'a', after: 'b', updatedAt: 'now' },
        e2: { leaseId: 'L', paragraphIndex: 1, before: 'a', after: 'b', updatedAt: 'now' },
      },
    });
    expect(result.acceptedEditIds).toEqual(['e1']);
    const persisted = await listEditsForLease('L');
    expect(persisted).toHaveLength(1);
    const audits = await listAuditEntries();
    const patchApplied = audits.filter((e) => e.kind === 'patch-applied');
    expect(patchApplied).toHaveLength(1);
  });
});

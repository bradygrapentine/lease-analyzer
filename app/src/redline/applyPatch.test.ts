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
import { applyRedlinePatch } from './applyPatch';
import {
  _resetRedlineDbForTests,
  listEditsForLease,
} from './redlineStorage';
import { _resetAuditDbForTests, listAuditEntries } from '../audit/auditLog';

const FINGERPRINT = 'c'.repeat(64);

function fakePatch(over: Partial<RedlinePatch> = {}): RedlinePatch {
  return {
    archiveFingerprint: FINGERPRINT,
    decisions: [
      { editId: 'e1', accepted: true },
      { editId: 'e2', accepted: false },
    ],
    signature: 'AAAA',
    signedByKeyId: 'key-1',
    signedByPublicKey: 'BBBB',
    ...over,
  };
}

beforeEach(async () => {
  _resetRedlineDbForTests();
  _resetAuditDbForTests();
  indexedDB.deleteDatabase('leaseguard-redlines');
  indexedDB.deleteDatabase('leaseguard-audit');
});

describe('applyRedlinePatch', () => {
  it('refuses to apply a patch with an invalid signature', async () => {
    await expect(
      applyRedlinePatch({
        patch: fakePatch({ signature: 'tampered' }),
        archiveFingerprint: FINGERPRINT,
        editsByPatchId: {
          e1: { leaseId: 'L', paragraphIndex: 0, before: 'a', after: 'b', updatedAt: 'now' },
          e2: { leaseId: 'L', paragraphIndex: 1, before: 'a', after: 'b', updatedAt: 'now' },
        },
      }),
    ).rejects.toThrow(/signature/i);
  });

  it('refuses to apply when the local archive fingerprint does not match the patch', async () => {
    await expect(
      applyRedlinePatch({
        patch: fakePatch(),
        archiveFingerprint: 'd'.repeat(64),
        editsByPatchId: {
          e1: { leaseId: 'L', paragraphIndex: 0, before: 'a', after: 'b', updatedAt: 'now' },
        },
      }),
    ).rejects.toThrow(/fingerprint|mismatch/i);
  });

  it('on success, persists exactly the accepted edits and writes one patch-applied audit entry', async () => {
    // The signature path will fail with the placeholder fakePatch above, so
    // this test pins the contract: after success we expect exactly one
    // accepted edit in the redline store and exactly one new audit entry of
    // kind 'patch-applied'. Until applyRedlinePatch is implemented this
    // test fails at the await call (module missing).
    const result = await applyRedlinePatch({
      patch: fakePatch(),
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

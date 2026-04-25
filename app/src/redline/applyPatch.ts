/**
 * Wave 9 Part B — Apply a `RedlinePatch` returned by a reviewer.
 *
 * Verifies the embedded signature against the embedded public key,
 * cross-checks the local archive fingerprint, persists the accepted
 * edits to the redline IDB store, and writes exactly one
 * `kind: 'patch-applied'` audit entry summarising the apply.
 *
 * Rejects (throws) on:
 *  - signature failing Ed25519 verification under `signedByPublicKey`
 *  - `patch.archiveFingerprint` not matching the recipient's local
 *    `archiveFingerprint` (i.e. the patch was authored for a different
 *    archive than the one the recipient is holding)
 */

import type { RedlinePatch } from './redlinePatch';
import { verifyRedlinePatch } from './redlinePatch';
import type { RedlineEdit } from './redline';
import { saveEdit } from './redlineStorage';
import { appendAuditEntry } from '../audit/auditLog';

export interface ApplyRedlinePatchInput {
  patch: RedlinePatch;
  archiveFingerprint: string;
  editsByPatchId: Record<string, RedlineEdit>;
}

export interface ApplyRedlinePatchResult {
  acceptedEditIds: string[];
}

export async function applyRedlinePatch(
  input: ApplyRedlinePatchInput,
): Promise<ApplyRedlinePatchResult> {
  const { patch, archiveFingerprint, editsByPatchId } = input;

  if (patch.archiveFingerprint !== archiveFingerprint) {
    throw new Error(
      'redline patch: archive fingerprint mismatch (patch was authored for a different archive)',
    );
  }

  const { ok } = await verifyRedlinePatch(patch);
  if (!ok) {
    throw new Error('redline patch: signature verification failed');
  }

  const acceptedEditIds: string[] = [];
  for (const decision of patch.decisions) {
    if (!decision.accepted) continue;
    const edit = editsByPatchId[decision.editId];
    if (!edit) continue;
    await saveEdit(edit);
    acceptedEditIds.push(decision.editId);
  }

  await appendAuditEntry({
    kind: 'patch-applied',
    payload: { archiveFingerprint, acceptedEditIds },
  });

  return { acceptedEditIds };
}

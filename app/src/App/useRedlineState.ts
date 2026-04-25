import { useCallback, useEffect, useState } from 'react';
import {
  saveEdit,
  listEditsForLease,
  deleteEdit,
} from '../redline/redlineStorage';
import { buildRedlineHtml } from '../redline/redline';
import type { RedlineEdit } from '../redline/redline';
import type { LeaseDocument } from '../parser/types';
import type { Finding } from '../rules/types';

export interface UseRedlineStateDeps {
  leaseId: string | null;
  /**
   * Best-effort audit append. Wired to `safeAudit` from App.tsx so audit
   * failures never block a redline edit.
   */
  audit?: (input: { kind: string; payload: Record<string, unknown> }) => Promise<void>;
  /**
   * Called after an audited mutation, so the audit log panel can refresh.
   * Optional — pure data tests may omit it.
   */
  onAuditMutation?: () => void;
}

export interface UseRedlineStateApi {
  redlineEdits: RedlineEdit[];
  /** Save (or replace) an edit for `paragraphIndex` with `before`/`after` text. */
  editParagraph: (input: {
    paragraphIndex: number;
    before: string;
    after: string;
    ruleId?: string;
  }) => Promise<void>;
  deleteParagraphEdit: (paragraphIndex: number) => Promise<void>;
  /**
   * Replace all stored edits for the active lease with the supplied list.
   * Used by version-restore — keeps the (leaseId, paragraphIndex) uniqueness
   * invariant intact without introducing a bulk-replace primitive.
   */
  replaceAll: (edits: RedlineEdit[]) => Promise<void>;
  /** Manually refresh from storage (e.g. after a version-restore audit). */
  refresh: () => Promise<void>;
  /** Build a printable redline HTML for the supplied doc + the current edits. */
  buildHtml: (input: { leaseName: string; doc: LeaseDocument }) => string;
  /**
   * Apply a rule's suggested edit (or a counter-offer) to a paragraph. Resolves
   * `before` from `doc` and audits the change as `applied: true`.
   */
  applySuggestion: (input: {
    finding: Finding;
    paragraphIndex: number;
    suggestedText: string;
    doc: LeaseDocument;
  }) => Promise<void>;
}

/**
 * Owns the per-lease redline edit list. When `leaseId` flips to null (no
 * analyzed lease) the list clears.
 */
export function useRedlineState(deps: UseRedlineStateDeps): UseRedlineStateApi {
  const { leaseId, audit, onAuditMutation } = deps;
  const [redlineEdits, setRedlineEdits] = useState<RedlineEdit[]>([]);

  const refresh = useCallback(async (): Promise<void> => {
    if (!leaseId) return;
    setRedlineEdits(await listEditsForLease(leaseId));
  }, [leaseId]);

  const editParagraph = useCallback<UseRedlineStateApi['editParagraph']>(
    async (input) => {
      if (!leaseId) return;
      await saveEdit({
        leaseId,
        paragraphIndex: input.paragraphIndex,
        before: input.before,
        after: input.after,
        updatedAt: new Date().toISOString(),
        ...(input.ruleId !== undefined ? { ruleId: input.ruleId } : {}),
      });
      if (audit) {
        await audit({
          kind: 'redline-edit',
          payload: {
            leaseId,
            paragraphIndex: input.paragraphIndex,
            ...(input.ruleId !== undefined
              ? { ruleId: input.ruleId, applied: true }
              : {}),
          },
        });
      }
      setRedlineEdits(await listEditsForLease(leaseId));
      onAuditMutation?.();
    },
    [leaseId, audit, onAuditMutation],
  );

  const deleteParagraphEdit = useCallback<UseRedlineStateApi['deleteParagraphEdit']>(
    async (paragraphIndex) => {
      if (!leaseId) return;
      await deleteEdit(leaseId, paragraphIndex);
      if (audit) {
        await audit({
          kind: 'redline-edit',
          payload: { leaseId, paragraphIndex, deleted: true },
        });
      }
      setRedlineEdits(await listEditsForLease(leaseId));
      onAuditMutation?.();
    },
    [leaseId, audit, onAuditMutation],
  );

  const replaceAll = useCallback<UseRedlineStateApi['replaceAll']>(
    async (edits) => {
      if (!leaseId) return;
      const current = await listEditsForLease(leaseId);
      for (const e of current) {
        await deleteEdit(leaseId, e.paragraphIndex);
      }
      for (const e of edits) {
        await saveEdit({ ...e, leaseId });
      }
      setRedlineEdits(await listEditsForLease(leaseId));
    },
    [leaseId],
  );

  const buildHtml = useCallback<UseRedlineStateApi['buildHtml']>(
    ({ leaseName, doc }) =>
      buildRedlineHtml({ leaseName, doc, edits: redlineEdits }),
    [redlineEdits],
  );

  useEffect(() => {
    if (leaseId) void refresh();
    else setRedlineEdits([]);
  }, [leaseId, refresh]);

  const applySuggestion = useCallback<UseRedlineStateApi['applySuggestion']>(
    async ({ finding, paragraphIndex, suggestedText, doc }) => {
      const before = doc.paragraphs[paragraphIndex]?.text ?? '';
      await editParagraph({
        paragraphIndex,
        before,
        after: suggestedText,
        ruleId: finding.ruleId,
      });
    },
    [editParagraph],
  );

  return {
    redlineEdits,
    editParagraph,
    deleteParagraphEdit,
    replaceAll,
    refresh,
    buildHtml,
    applySuggestion,
  };
}

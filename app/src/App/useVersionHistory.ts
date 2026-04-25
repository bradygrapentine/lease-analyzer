import { useCallback, useEffect, useState } from 'react';
import {
  deleteVersion,
  getVersion,
  listVersionsForLease,
  saveVersion,
  type LeaseVersion,
} from '../negotiation/versionHistory';
import { listEditsForLease } from '../redline/redlineStorage';
import { buildRedlineHtml } from '../redline/redline';
import type { LeaseDocument } from '../parser/types';
import type { RedlineEdit } from '../redline/redline';
import { downloadBlob, stripPdfExt } from './appHelpers';

export interface UseVersionHistoryDeps {
  leaseId: string | null;
  audit?: (input: { kind: string; payload: Record<string, unknown> }) => Promise<void>;
  onAuditMutation?: () => void;
}

export interface UseVersionHistoryApi {
  versions: LeaseVersion[];
  /** Snapshot the lease's currently-stored edits as a new version. */
  createVersion: (label?: string, note?: string) => Promise<LeaseVersion | null>;
  /** Delete a specific version by id. */
  removeVersion: (versionId: string) => Promise<void>;
  /** Look up a version by id (null if missing or wrong lease). */
  getVersionById: (versionId: string) => Promise<LeaseVersion | null>;
  refresh: () => Promise<void>;
  /**
   * Restore a version by replacing the lease's current edits with the
   * version's snapshot. The replace is delegated through `applyRestore` so
   * the redline DB stays the single source of truth — we only audit here.
   */
  restoreVersion: (
    versionId: string,
    applyRestore: (edits: RedlineEdit[]) => Promise<void>,
  ) => Promise<void>;
  /** Build + download a redline HTML snapshot for a saved version. */
  exportVersion: (
    versionId: string,
    input: { leaseName: string; doc: LeaseDocument },
  ) => Promise<void>;
}

/**
 * Owns the per-lease version history list. Restoring a version mutates the
 * redline DB; we leave that mutation to `useRedlineState.replaceAll` and
 * only audit the restore here, to keep the responsibilities separable.
 */
export function useVersionHistory(deps: UseVersionHistoryDeps): UseVersionHistoryApi {
  const { leaseId, audit, onAuditMutation } = deps;
  const [versions, setVersions] = useState<LeaseVersion[]>([]);

  const refresh = useCallback(async (): Promise<void> => {
    if (!leaseId) return;
    setVersions(await listVersionsForLease(leaseId));
  }, [leaseId]);

  const createVersion = useCallback<UseVersionHistoryApi['createVersion']>(
    async (label, note) => {
      if (!leaseId) return null;
      const currentEdits = await listEditsForLease(leaseId);
      const saved = await saveVersion({
        leaseId,
        edits: currentEdits,
        ...(label !== undefined ? { label } : {}),
        ...(note !== undefined ? { note } : {}),
      });
      if (audit) {
        await audit({
          kind: 'version-save',
          payload: {
            leaseId,
            versionId: saved.versionId,
            editCount: saved.edits.length,
          },
        });
      }
      setVersions(await listVersionsForLease(leaseId));
      onAuditMutation?.();
      return saved;
    },
    [leaseId, audit, onAuditMutation],
  );

  const removeVersion = useCallback<UseVersionHistoryApi['removeVersion']>(
    async (versionId) => {
      if (!leaseId) return;
      await deleteVersion(versionId);
      if (audit) {
        await audit({
          kind: 'version-delete',
          payload: { leaseId, versionId },
        });
      }
      setVersions(await listVersionsForLease(leaseId));
      onAuditMutation?.();
    },
    [leaseId, audit, onAuditMutation],
  );

  const getVersionById = useCallback<UseVersionHistoryApi['getVersionById']>(
    async (versionId) => {
      const v = await getVersion(versionId);
      if (!v || (leaseId && v.leaseId !== leaseId)) return null;
      return v;
    },
    [leaseId],
  );

  const restoreVersion = useCallback<UseVersionHistoryApi['restoreVersion']>(
    async (versionId, applyRestore) => {
      if (!leaseId) return;
      const v = await getVersion(versionId);
      if (!v || v.leaseId !== leaseId) return;
      await applyRestore(v.edits);
      if (audit) {
        await audit({
          kind: 'version-restore',
          payload: { leaseId, versionId, restoredEdits: v.edits.length },
        });
      }
      onAuditMutation?.();
    },
    [leaseId, audit, onAuditMutation],
  );

  const exportVersion = useCallback<UseVersionHistoryApi['exportVersion']>(
    async (versionId, { leaseName, doc }) => {
      const v = await getVersion(versionId);
      if (!v) return;
      const labelPart = v.label
        ? `-${v.label.replace(/[^a-z0-9-]+/gi, '_')}`
        : '';
      downloadBlob(
        buildRedlineHtml({ leaseName, doc, edits: v.edits }),
        'text/html',
        `${stripPdfExt(leaseName)}-redline${labelPart}.html`,
      );
    },
    [],
  );

  useEffect(() => {
    if (leaseId) void refresh();
    else setVersions([]);
  }, [leaseId, refresh]);

  return {
    versions,
    createVersion,
    removeVersion,
    getVersionById,
    refresh,
    restoreVersion,
    exportVersion,
  };
}

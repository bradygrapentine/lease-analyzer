import { useCallback } from 'react';
import type { ChangeEvent } from 'react';
import type { PipelineApi } from './usePipeline';
import type { UseSigningKeyApi } from './useSigningKey';
import { clearStandardId, deleteLease, getLease, type LeaseRecord } from '../storage/storage';
import { friendlyError, importEncryptedArchiveFlow } from './appHelpers';

interface AuditEntry {
  kind: string;
  payload: Record<string, unknown>;
}

interface UseAppCallbacksDeps {
  pipeline: PipelineApi;
  signingKey: UseSigningKeyApi;
  safeAudit: (entry: AuditEntry) => Promise<void>;
  refreshAuditLog: () => Promise<void> | void;
  refreshLibrary: () => Promise<void>;
  setSelected: (selected: null) => void;
  /** The currently-saved standard lease id, if any. Used by `onDelete` to
   *  clear the pointer when the standard itself is being deleted. */
  standardId: string | null;
}

export interface UseAppCallbacksApi {
  handleBytes: (bytes: Uint8Array, fileName: string) => Promise<void>;
  onTrySample: () => Promise<void>;
  onOpenLibrary: (id: string) => Promise<void>;
  onDeleteLibrary: (id: string) => Promise<void>;
  onCompare: (aId: string, bId: string) => Promise<void>;
  onImportArchiveFile: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onExportSignedJson: () => Promise<void>;
}

export function useAppCallbacks(deps: UseAppCallbacksDeps): UseAppCallbacksApi {
  const {
    pipeline,
    signingKey,
    safeAudit,
    refreshAuditLog,
    refreshLibrary,
    setSelected,
    standardId,
  } = deps;

  const handleBytes = useCallback(
    async (bytes: Uint8Array, fileName: string): Promise<void> => {
      setSelected(null);
      await safeAudit({ kind: 'analyze', payload: { fileName, phase: 'start' } });
      await pipeline.upload(bytes, fileName);
      await safeAudit({ kind: 'analyze', payload: { fileName, phase: 'complete' } });
      void refreshAuditLog();
    },
    [pipeline, safeAudit, refreshAuditLog, setSelected],
  );

  const onTrySample = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/sample.pdf');
      if (!res.ok) throw new Error(`Could not load sample (${res.status})`);
      const buf = await res.arrayBuffer();
      await handleBytes(new Uint8Array(buf), 'Sample lease.pdf');
    } catch (err) {
      pipeline.setError(friendlyError(err));
    }
  }, [handleBytes, pipeline]);

  const onOpenLibrary = useCallback(
    async (id: string): Promise<void> => {
      const record: LeaseRecord | undefined = await getLease(id);
      if (!record) return;
      setSelected(null);
      pipeline.open(record);
    },
    [pipeline, setSelected],
  );

  const onDeleteLibrary = useCallback(
    async (id: string): Promise<void> => {
      await deleteLease(id);
      if (standardId === id) await clearStandardId();
      await safeAudit({ kind: 'delete-lease', payload: { leaseId: id } });
      await refreshLibrary();
      void refreshAuditLog();
    },
    [standardId, safeAudit, refreshLibrary, refreshAuditLog],
  );

  const onCompare = useCallback(
    async (aId: string, bId: string): Promise<void> => {
      const [a, b] = await Promise.all([getLease(aId), getLease(bId)]);
      if (!a || !b) return;
      pipeline.setComparison({ a, b });
    },
    [pipeline],
  );

  const onImportArchiveFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      await importEncryptedArchiveFlow(file, {
        onSuccess: async () => {
          await refreshLibrary();
          pipeline.reset();
          setSelected(null);
        },
        onError: (msg) => pipeline.setError(msg),
      });
    },
    [pipeline, refreshLibrary, setSelected],
  );

  const onExportSignedJson = useCallback(async (): Promise<void> => {
    const status = pipeline.status;
    if (status.kind !== 'analyzed') return;
    const passphrase = window.prompt('Passphrase to unlock the signing key:');
    if (!passphrase) return;
    try {
      await signingKey.signAndDownloadFindings({
        fileName: status.fileName,
        doc: status.result.doc,
        findings: status.result.findings,
        bytes: status.bytes,
        passphrase,
      });
    } catch (err) {
      pipeline.setError(`Signing failed: ${friendlyError(err)}`);
    }
  }, [pipeline, signingKey]);

  return {
    handleBytes,
    onTrySample,
    onOpenLibrary,
    onDeleteLibrary,
    onCompare,
    onImportArchiveFile,
    onExportSignedJson,
  };
}

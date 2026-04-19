import type { AuditEntry, ChainVerification } from './auditLog';

export const AUDIT_EXPORT_SCHEMA = 'leaseguard.audit.v1';

/**
 * Pure function: build a stable, pretty-printed JSON string for the audit-log
 * download. The side effect of turning this into a blob + clicking an anchor
 * lives in `downloadAuditLogBlob` so the output stays unit-testable.
 */
export function buildAuditLogJson(
  entries: readonly AuditEntry[],
  chainVerification: ChainVerification | null,
): string {
  const sorted = [...entries].sort((a, b) => a.seq - b.seq);
  const payload = {
    schema: AUDIT_EXPORT_SCHEMA,
    exportedAt: null as string | null, // filled by caller helper; kept null
    // here so the pure function is deterministic for fixed input.
    entryCount: sorted.length,
    chainVerification,
    entries: sorted.map((e) => ({
      seq: e.seq,
      timestamp: e.timestamp,
      kind: e.kind,
      payload: e.payload,
      prevHash: e.prevHash,
      entryHash: e.entryHash,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Thin DOM side-effect helper. Excluded from the deterministic pure-fn tests
 * above; UI tests exercise it via a mock `onDownload` prop, and this helper
 * only runs in the live app wire-up.
 */
export function downloadAuditLogBlob(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

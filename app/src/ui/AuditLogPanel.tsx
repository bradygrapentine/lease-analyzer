import type { AuditEntry, ChainVerification } from '../audit/auditLog';

export interface AuditLogPanelProps {
  entries: AuditEntry[];
  verification: ChainVerification | null;
  onRefresh: () => void;
  onDownload: () => void;
  onVerify: () => void;
}

export function AuditLogPanel({
  entries,
  verification,
  onRefresh,
  onDownload,
  onVerify,
}: AuditLogPanelProps): JSX.Element {
  return (
    <section aria-label="audit log">
      <h2>Audit log</h2>
      <p>
        Append-only, hash-chained record of analyses, exports, and library
        changes. Entries live in a separate local database.
      </p>

      <div role="group" aria-label="audit log actions">
        <button type="button" onClick={onRefresh}>
          Refresh
        </button>
        <button type="button" onClick={onVerify}>
          Verify chain
        </button>
        <button type="button" onClick={onDownload}>
          Download audit log
        </button>
      </div>

      {verification !== null && (
        <p
          role="status"
          aria-label="chain verification"
          data-testid="audit-verification"
        >
          {verification.ok ? (
            <span>Chain intact ({entries.length} entries).</span>
          ) : (
            <span>
              Chain broken at seq {verification.firstBadSeq ?? '?'}.
            </span>
          )}
        </p>
      )}

      {entries.length === 0 ? (
        <p>
          <em>No audit entries yet.</em>
        </p>
      ) : (
        <table aria-label="audit entries">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Time</th>
              <th scope="col">Kind</th>
              <th scope="col">Payload</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.seq}>
                <td>{e.seq}</td>
                <td>{e.timestamp}</td>
                <td>{e.kind}</td>
                <td>
                  <code>{summarizePayload(e.payload)}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/**
 * Keep the row compact. We intentionally truncate: the full payload is in
 * the downloaded JSON, the table is for at-a-glance scanning.
 */
function summarizePayload(payload: Record<string, unknown>): string {
  const keys = Object.keys(payload);
  if (keys.length === 0) return '{}';
  const s = JSON.stringify(payload);
  if (s.length <= 64) return s;
  return `${s.slice(0, 61)}...`;
}

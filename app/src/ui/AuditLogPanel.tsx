// Wave 27-C — design pass rewrite.
// Semantic attributes preserved verbatim (e2e critical — golden.spec.ts):
//   aria-label="audit log"           (section)
//   role="group" aria-label="audit log actions"  (div)
//   role="status" aria-label="chain verification" data-testid="audit-verification" (p)
//   aria-label="audit entries"       (table)
//
import type { AuditEntry, ChainVerification } from '../audit/auditLog';
import { Section } from './system/Section';
import { Button } from './system/Button';

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
    <Section label="audit log" className="space-y-3 px-4 py-4">
      <h2 className="text-heading uppercase text-fg-muted">Audit log</h2>
      <p className="text-body text-fg-body">
        Append-only, hash-chained record of analyses, exports, and library changes. Entries live in
        a separate local database.
      </p>
      <p className="text-small text-fg-muted">
        Each entry signs the one before it. If a single entry is altered, the chain breaks and
        verification fails. The full digest is shown in mono so you can copy it; the short form
        (first 8 characters) is enough for spot-checks.
      </p>

      <div role="group" aria-label="audit log actions" className="flex flex-wrap gap-2">
        <Button type="button" variant="subtle" size="sm" onClick={onRefresh}>
          Refresh
        </Button>
        <Button type="button" variant="subtle" size="sm" onClick={onVerify}>
          Verify chain
        </Button>
        <Button type="button" variant="subtle" size="sm" onClick={onDownload}>
          Download audit log
        </Button>
      </div>

      {verification !== null && (
        <p
          role="status"
          aria-label="chain verification"
          data-testid="audit-verification"
          className={`text-small rounded-sm px-2 py-1 border ${verification.ok ? 'bg-positive/10 text-positive border-positive/30' : 'bg-severity-high/10 text-severity-high border-severity-high/30'}`}
        >
          {verification.ok ? (
            <span>Chain intact ({entries.length} entries).</span>
          ) : (
            <span>Chain broken at seq {verification.firstBadSeq ?? '?'}.</span>
          )}
        </p>
      )}

      {entries.length === 0 ? (
        <p className="text-body text-fg-muted">
          <em>No audit entries yet.</em>
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table
            aria-label="audit entries"
            className="w-full text-small text-fg-body border-collapse"
          >
            <thead>
              <tr className="border-b border-rule">
                <th scope="col" className="text-left py-1 pr-3 text-fg-muted font-sans">
                  #
                </th>
                <th scope="col" className="text-left py-1 pr-3 text-fg-muted font-sans">
                  Time
                </th>
                <th scope="col" className="text-left py-1 pr-3 text-fg-muted font-sans">
                  Kind
                </th>
                <th scope="col" className="text-left py-1 text-fg-muted font-sans">
                  Payload
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.seq} className="even:bg-paper-sunken border-b border-rule-subtle">
                  <td className="py-1 pr-3">{e.seq}</td>
                  <td className="py-1 pr-3">{e.timestamp}</td>
                  <td className="py-1 pr-3">{e.kind}</td>
                  <td className="py-1">
                    <code className="font-mono text-mono text-fg-body">
                      {summarizePayload(e.payload)}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
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

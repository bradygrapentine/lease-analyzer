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
      <h2 className="text-heading uppercase text-fg-muted">Activity</h2>
      <p className="text-body text-fg-body">
        A running log of what LeaseGuard has done with your lease — every analysis, export, and rule
        change. Stored on this device only. You can download it and check that nothing has been
        altered after the fact.
      </p>

      {/* Wave 53-D — chain ribbon. Entries count + chain head fingerprint
          surface up-top so the integrity signal is the first thing users
          see. Verify-status pill (when present) sits in the same row. */}
      {entries.length > 0 && (
        <div
          aria-label="audit chain ribbon"
          className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-sm border border-rule bg-paper-sunken px-3 py-2 font-mono text-mono text-fg-muted"
        >
          <span>
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </span>
          <span>
            fingerprint{' '}
            <span className="text-fg-body">
              {shortHash(entries[entries.length - 1]?.entryHash)}
            </span>
          </span>
          {verification !== null && (
            <span
              role="status"
              aria-label="chain verification"
              data-testid="audit-verification"
              className={`rounded-sm px-1.5 py-0.5 border ${verification.ok ? 'bg-positive/10 text-positive border-positive/30' : 'bg-severity-high/10 text-severity-high border-severity-high/30'}`}
            >
              {verification.ok
                ? `Log intact (${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}).`
                : `An entry was altered after the fact (entry #${verification.firstBadSeq ?? '?'}). The activity log can no longer confirm the order of events from there onward.`}
            </span>
          )}
        </div>
      )}

      <div role="group" aria-label="audit log actions" className="flex flex-wrap gap-2">
        <Button type="button" variant="subtle" size="sm" onClick={onRefresh}>
          Refresh
        </Button>
        <Button type="button" variant="subtle" size="sm" onClick={onVerify}>
          Check the log
        </Button>
        <Button type="button" variant="subtle" size="sm" onClick={onDownload}>
          Download
        </Button>
      </div>

      {/* Empty-state pill: when no entries but Verify was clicked, the
          ribbon is gated on entries.length > 0 so surface the verdict
          here. */}
      {entries.length === 0 && verification !== null && (
        <p
          role="status"
          aria-label="chain verification"
          data-testid="audit-verification"
          className={`text-small rounded-sm px-2 py-1 border ${verification.ok ? 'bg-positive/10 text-positive border-positive/30' : 'bg-severity-high/10 text-severity-high border-severity-high/30'}`}
        >
          {verification.ok ? 'Log intact (0 entries).' : 'An entry was altered after the fact.'}
        </p>
      )}

      {entries.length === 0 ? (
        <p className="text-body text-fg-muted">
          <em>Nothing here yet — analyze a lease to start the log.</em>
        </p>
      ) : (
        <>
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
                    When
                  </th>
                  <th scope="col" className="text-left py-1 pr-3 text-fg-muted font-sans">
                    What
                  </th>
                  <th scope="col" className="text-left py-1 text-fg-muted font-sans">
                    Subject
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const subject = extractSubject(e.payload);
                  return (
                    <tr key={e.seq} className="even:bg-paper-sunken border-b border-rule-subtle">
                      <td className="py-1 pr-3 font-mono text-mono text-fg-muted">{e.seq}</td>
                      <td className="py-1 pr-3 font-mono text-mono text-fg-muted whitespace-nowrap">
                        {e.timestamp}
                      </td>
                      <td className="py-1 pr-3 text-fg-body">{e.kind}</td>
                      <td className="py-1">
                        {subject ? (
                          <span className="font-serif italic text-fg-body">{subject}</span>
                        ) : (
                          <code className="font-mono text-mono text-fg-muted">
                            {summarizePayload(e.payload)}
                          </code>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p
            aria-label="audit chain footer"
            className="pt-3 border-t border-rule font-mono text-mono text-fg-muted m-0"
          >
            ● The log links each entry to the one before it, so any after-the-fact edit shows up
            when you check it.
          </p>
        </>
      )}
    </Section>
  );
}

/**
 * Keep the row compact. We intentionally truncate: the full payload is in
 * the downloaded JSON, the table is for at-a-glance scanning.
 */
function shortHash(hash: string | undefined): string {
  if (!hash) return '—';
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`;
}

function summarizePayload(payload: Record<string, unknown>): string {
  const keys = Object.keys(payload);
  if (keys.length === 0) return '{}';
  const s = JSON.stringify(payload);
  if (s.length <= 64) return s;
  return `${s.slice(0, 61)}...`;
}

/**
 * Wave 53-D — pull a human-readable "object" out of common audit payloads
 * (file name, rule id, pack id, lease name) so the row reads like a
 * sentence: "<seq> <ts> <kind> <subject>". Returns null when the payload
 * has no obvious subject, in which case callers fall back to the JSON
 * summary above.
 */
function extractSubject(payload: Record<string, unknown>): string | null {
  const candidates: readonly string[] = ['fileName', 'name', 'ruleId', 'packId', 'leaseId'];
  for (const key of candidates) {
    const v = payload[key];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

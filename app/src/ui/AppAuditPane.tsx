import { Suspense, lazy } from 'react';
import type { AuditEntry, ChainVerification } from '../audit/auditLog';

// Wave 53-B-1 — Audit promoted to a top-level view (peer of Current /
// Portfolio / Redline) per the design handoff. Previously the
// AuditLogPanel lived inside the GOVERNANCE accordion on Current; that
// stacked the chain table beneath several lease-management panels and
// made it hard to reach. The pane is intentionally thin — the existing
// AuditLogPanel does the heavy lifting.

const AuditLogPanel = lazy(() =>
  import('./AuditLogPanel').then((m) => ({ default: m.AuditLogPanel })),
);

interface AppAuditPaneProps {
  entries: AuditEntry[];
  verification: ChainVerification | null;
  onRefresh: () => void;
  onVerify: () => void;
  onDownload: (entries: AuditEntry[], verification: ChainVerification | null) => void;
}

export function AppAuditPane({
  entries,
  verification,
  onRefresh,
  onVerify,
  onDownload,
}: AppAuditPaneProps): JSX.Element {
  return (
    <div className="mx-auto max-w-[1080px]">
      <Suspense fallback={null}>
        <AuditLogPanel
          entries={entries}
          verification={verification}
          onRefresh={onRefresh}
          onVerify={onVerify}
          onDownload={() => onDownload(entries, verification)}
        />
      </Suspense>
    </div>
  );
}

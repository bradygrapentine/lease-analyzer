import type { AuditEntry } from '../audit/auditLog';
import { HybridPrecisionPanel } from './HybridPrecisionPanel';

export function HybridPrecisionDisclosure({
  auditEntries,
}: {
  auditEntries: AuditEntry[];
}): JSX.Element {
  return (
    <details className="px-4 py-3" data-testid="hybrid-precision-disclosure">
      <summary className="text-heading uppercase text-fg-muted cursor-pointer select-none">
        Hybrid precision
      </summary>
      <div className="pt-2">
        <HybridPrecisionPanel auditEntries={auditEntries} />
      </div>
    </details>
  );
}

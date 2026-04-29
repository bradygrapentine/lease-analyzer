import { useState } from 'react';
import { diffFindings } from '../compare/diffFindings';
import type { Finding } from '../rules/types';
import { Card } from './system/Card';
import { Badge } from './system/Badge';

type Severity = Finding['severity'];

const SEVERITY_LABEL: Record<Severity, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};

function SevBadge({ severity }: { severity: Severity }): JSX.Element {
  return (
    <Badge variant="severity" severity={severity}>
      {SEVERITY_LABEL[severity]}
    </Badge>
  );
}

type ChangedRowData = ReturnType<typeof diffFindings>['changed'][number];

function ChangedRow({ c }: { c: ChangedRowData }): JSX.Element {
  const sevSame = c.from.severity === c.to.severity;
  return (
    <li className="flex items-center gap-2 flex-wrap">
      <strong className="text-body text-fg-body">{c.to.title}</strong>
      <span className="sr-only">
        {sevSame
          ? `Severity ${SEVERITY_LABEL[c.to.severity]}.`
          : `Severity changed from ${SEVERITY_LABEL[c.from.severity]} to ${SEVERITY_LABEL[c.to.severity]}.`}
      </span>
      <span aria-hidden="true" className="inline-flex items-center gap-2 flex-wrap">
        <SevBadge severity={c.from.severity} />
        {!sevSame && (
          <>
            <span className="text-fg-muted">→</span>
            <SevBadge severity={c.to.severity} />
          </>
        )}
      </span>
      {c.from.negated !== c.to.negated && (
        <span className="text-small text-fg-muted">
          {`negated ${c.from.negated ? 'yes→no' : 'no→yes'}`}
        </span>
      )}
    </li>
  );
}

function FlatSection({ label, rows }: { label: string; rows: Finding[] }): JSX.Element | null {
  if (rows.length === 0) return null;
  return (
    <Card variant="default" className="p-3 space-y-2">
      <h3 className="text-heading uppercase text-fg-muted">
        {label} ({rows.length})
      </h3>
      <ul className="space-y-1">
        {rows.map((f) => (
          <li key={f.ruleId} className="flex items-center gap-2 flex-wrap">
            <strong className="text-body text-fg-body">{f.title}</strong>
            <SevBadge severity={f.severity} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

interface ComparePanelProps {
  aName: string;
  bName: string;
  aFindings: Finding[];
  bFindings: Finding[];
  // Set when the two leases were analyzed under different rule-pack versions;
  // surfaces a dismissable info banner. Optional so callers keep compiling.
  packVersionMismatch?: { a: string; b: string };
}

export function ComparePanel({
  aName, bName, aFindings, bFindings, packVersionMismatch,
}: ComparePanelProps): JSX.Element {
  const diff = diffFindings(aFindings, bFindings);
  const totalDiffs = diff.added.length + diff.removed.length + diff.changed.length;
  const [mismatchDismissed, setMismatchDismissed] = useState(false);

  return (
    <Card as="section" aria-label="compare" className="p-4 space-y-4">
      <header className="space-y-1">
        <h2 className="text-heading uppercase text-fg-muted">Compare</h2>
        <p className="text-body text-fg-body">
          <strong>{aName}</strong> → <strong>{bName}</strong>
        </p>
      </header>

      {packVersionMismatch && !mismatchDismissed && (
        <div role="alert" aria-label="pack version mismatch" className="flex flex-col gap-2 p-3 rounded-sm bg-[var(--color-severity-bg-info)] border border-[var(--color-severity-border-info)]">
          <Badge variant="severity" severity="info">Different rule packs</Badge>
          <p className="text-body text-fg-body">
            These leases were analyzed under different rule-pack versions
            (A: v{packVersionMismatch.a}, B: v{packVersionMismatch.b}).
            Differences may reflect rule changes rather than content changes.
          </p>
          <button type="button" onClick={() => setMismatchDismissed(true)} aria-label="Dismiss pack version mismatch warning" className="self-start text-small text-fg-muted underline hover:text-fg-body focus-visible:focus-ring">Dismiss</button>
        </div>
      )}

      {totalDiffs === 0 && (
        <p className="text-body text-fg-muted">
          No differences in findings between these leases.
        </p>
      )}

      <FlatSection label="Added" rows={diff.added} />
      <FlatSection label="Removed" rows={diff.removed} />

      {diff.changed.length > 0 && (
        <Card variant="default" className="p-3 space-y-2">
          <h3 className="text-heading uppercase text-fg-muted">Changed ({diff.changed.length})</h3>
          <ul className="space-y-1">
            {diff.changed.map((c) => <ChangedRow key={c.ruleId} c={c} />)}
          </ul>
        </Card>
      )}
    </Card>
  );
}

import { useState } from 'react';
import { diffFindings } from '../compare/diffFindings';
import type { Finding } from '../rules/types';

interface ComparePanelProps {
  aName: string;
  bName: string;
  aFindings: Finding[];
  bFindings: Finding[];
  /**
   * Present when the two leases were analyzed under different rule-pack
   * versions. When set, the panel renders a dismissable warning banner.
   * Optional so existing callers (App.tsx today) keep compiling; the
   * coordinator will thread this through in a follow-up pass.
   */
  packVersionMismatch?: { a: string; b: string };
}

export function ComparePanel({
  aName,
  bName,
  aFindings,
  bFindings,
  packVersionMismatch,
}: ComparePanelProps): JSX.Element {
  const diff = diffFindings(aFindings, bFindings);
  const totalDiffs = diff.added.length + diff.removed.length + diff.changed.length;
  const [mismatchDismissed, setMismatchDismissed] = useState(false);

  return (
    <section aria-label="compare">
      <header>
        <h2>Compare</h2>
        <p>
          <strong>{aName}</strong> → <strong>{bName}</strong>
        </p>
      </header>

      {packVersionMismatch && !mismatchDismissed && (
        <div role="alert" aria-label="pack version mismatch" data-variant="warning">
          <p>
            These leases were analyzed under different rule-pack versions
            (A: v{packVersionMismatch.a}, B: v{packVersionMismatch.b}).
            Differences may reflect rule changes rather than content changes.
          </p>
          <button
            type="button"
            onClick={() => setMismatchDismissed(true)}
            aria-label="Dismiss pack version mismatch warning"
          >
            Dismiss
          </button>
        </div>
      )}

      {totalDiffs === 0 && <p>No differences in findings between these leases.</p>}

      {diff.added.length > 0 && (
        <div>
          <h3>Added ({diff.added.length})</h3>
          <ul>
            {diff.added.map((f) => (
              <li key={f.ruleId}>
                <strong>{f.title}</strong> <small>({f.severity})</small>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diff.removed.length > 0 && (
        <div>
          <h3>Removed ({diff.removed.length})</h3>
          <ul>
            {diff.removed.map((f) => (
              <li key={f.ruleId}>
                <strong>{f.title}</strong> <small>({f.severity})</small>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diff.changed.length > 0 && (
        <div>
          <h3>Changed ({diff.changed.length})</h3>
          <ul>
            {diff.changed.map((c) => (
              <li key={c.ruleId}>
                <strong>{c.to.title}</strong>{' '}
                <small>
                  {c.from.severity} → {c.to.severity}
                  {c.from.negated !== c.to.negated &&
                    ` · negated ${c.from.negated ? 'yes→no' : 'no→yes'}`}
                </small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

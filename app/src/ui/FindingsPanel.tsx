import type { Finding, Severity } from '../rules/types';

const SEVERITY_ORDER: Severity[] = ['high', 'medium', 'low', 'info'];
const SEVERITY_LABEL: Record<Severity, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};

interface FindingsPanelProps {
  findings: Finding[];
  onSelect: (finding: Finding) => void;
}

export function FindingsPanel({ findings, onSelect }: FindingsPanelProps): JSX.Element {
  if (findings.length === 0) {
    return (
      <aside aria-label="findings">
        <p>No findings yet. Upload a lease to analyze.</p>
      </aside>
    );
  }

  const bySeverity = groupBySeverity(findings);

  return (
    <aside aria-label="findings">
      {SEVERITY_ORDER.map((sev) => {
        const group = bySeverity[sev];
        if (!group || group.length === 0) return null;
        return (
          <section key={sev} aria-labelledby={`findings-${sev}`}>
            <h2 id={`findings-${sev}`}>{SEVERITY_LABEL[sev]}</h2>
            <ul>
              {group.map((finding) => (
                <li key={`${finding.ruleId}-${finding.paragraphIndex}-${finding.span.start}`}>
                  <button type="button" onClick={() => onSelect(finding)}>
                    <strong>{finding.title}</strong>
                    {finding.negated && <span aria-label="negated"> (possibly not applicable)</span>}
                    <div>{finding.explanation}</div>
                    <small>Page {finding.page}</small>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </aside>
  );
}

function groupBySeverity(findings: Finding[]): Record<Severity, Finding[]> {
  const out: Record<Severity, Finding[]> = { high: [], medium: [], low: [], info: [] };
  for (const f of findings) out[f.severity].push(f);
  return out;
}

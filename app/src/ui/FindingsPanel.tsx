import { useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Category, Finding, Severity } from '../rules/types';

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
  const [query, setQuery] = useState('');
  const [hiddenSeverities, setHiddenSeverities] = useState<Set<Severity>>(new Set());
  const [hiddenCategories, setHiddenCategories] = useState<Set<Category>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<Severity>>(new Set());
  const listRef = useRef<HTMLDivElement | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(findings.map((f) => f.category))).sort(),
    [findings],
  );

  if (findings.length === 0) {
    return (
      <aside aria-label="findings">
        <p>No findings yet. Upload a lease to analyze.</p>
      </aside>
    );
  }

  const q = query.trim().toLowerCase();
  const visible = findings.filter((f) => {
    if (hiddenSeverities.has(f.severity)) return false;
    if (hiddenCategories.has(f.category)) return false;
    if (!q) return true;
    return (
      f.title.toLowerCase().includes(q) ||
      f.explanation.toLowerCase().includes(q) ||
      f.snippet.toLowerCase().includes(q)
    );
  });

  const bySeverity = groupBySeverity(visible);

  return (
    <aside aria-label="findings">
      <div className="controls">
        <label>
          <span className="visually-hidden">Search findings</span>
          <input
            type="search"
            aria-label="search findings"
            placeholder="Search findings…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <div role="group" aria-label="severity filters">
          {SEVERITY_ORDER.map((sev) => (
            <button
              key={sev}
              type="button"
              aria-pressed={!hiddenSeverities.has(sev)}
              aria-label={`severity ${sev}`}
              onClick={() => toggleInSet(hiddenSeverities, sev, setHiddenSeverities)}
            >
              {SEVERITY_LABEL[sev]}
            </button>
          ))}
        </div>

        <div role="group" aria-label="category filters">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              aria-pressed={!hiddenCategories.has(cat)}
              aria-label={`category ${cat}`}
              onClick={() => toggleInSet(hiddenCategories, cat, setHiddenCategories)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div ref={listRef} onKeyDown={onListKeyDown}>
        {SEVERITY_ORDER.map((sev) => {
          const group = bySeverity[sev];
          if (!group || group.length === 0) return null;
          const isCollapsed = collapsed.has(sev);
          return (
            <section key={sev} aria-labelledby={`findings-${sev}`}>
              <h2 id={`findings-${sev}`}>
                <button
                  type="button"
                  aria-expanded={!isCollapsed}
                  aria-label={`toggle ${sev}`}
                  onClick={() => toggleInSet(collapsed, sev, setCollapsed)}
                >
                  {SEVERITY_LABEL[sev]} ({group.length})
                </button>
              </h2>
              {!isCollapsed && (
                <ul>
                  {group.map((finding) => (
                    <li key={`${finding.ruleId}-${finding.paragraphIndex}-${finding.span.start}`}>
                      <button
                        type="button"
                        className="finding-btn"
                        onClick={() => onSelect(finding)}
                      >
                        <strong>{finding.title}</strong>
                        {finding.negated && (
                          <span aria-label="negated"> (possibly not applicable)</span>
                        )}
                        <div>{finding.explanation}</div>
                        <small>Page {finding.page}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );

  function onListKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const root = listRef.current;
    if (!root) return;
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button.finding-btn'));
    const activeIdx = buttons.findIndex((b) => b === document.activeElement);
    if (activeIdx === -1) return;
    const nextIdx = e.key === 'ArrowDown' ? activeIdx + 1 : activeIdx - 1;
    const next = buttons[nextIdx];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  }
}

function toggleInSet<T>(
  current: Set<T>,
  value: T,
  setter: (s: Set<T>) => void,
): void {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  setter(next);
}

function groupBySeverity(findings: Finding[]): Record<Severity, Finding[]> {
  const out: Record<Severity, Finding[]> = { high: [], medium: [], low: [], info: [] };
  for (const f of findings) out[f.severity].push(f);
  return out;
}

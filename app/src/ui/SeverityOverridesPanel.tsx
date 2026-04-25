import type { ChangeEvent } from 'react';

export type OverrideSeverity = 'info' | 'warn' | 'error';

interface SeverityOverridesPanelProps {
  /** Rules the panel can surface overrides for. */
  rules: Array<{ id: string; title: string; severity: OverrideSeverity }>;
  /** Current per-rule override map. A rule id absent from the map has no override. */
  overrides: Record<string, OverrideSeverity>;
  /**
   * Called when the user picks a new override or clears one. `severity === null`
   * means "clear the override; fall back to the rule's built-in severity."
   */
  onChange: (ruleId: string, severity: OverrideSeverity | null) => void;
  /**
   * Wave 10 Part D — optional portfolio-scope override map. When provided
   * (alongside `onScopeChange`), the panel renders an "Apply across portfolio"
   * checkbox per row whose checked state mirrors the presence of `ruleId` in
   * `portfolioOverrides`. Existing call sites that omit these props see no
   * behavior change.
   */
  portfolioOverrides?: Record<string, OverrideSeverity>;
  onScopeChange?: (ruleId: string, scope: 'lease' | 'portfolio') => void;
}

const SEVERITY_LABEL: Record<OverrideSeverity, string> = {
  info: 'Info',
  warn: 'Warn',
  error: 'Error',
};

const CLEAR_VALUE = '__clear__';

function isOverrideSeverity(v: string): v is OverrideSeverity {
  return v === 'info' || v === 'warn' || v === 'error';
}

export function SeverityOverridesPanel({
  rules,
  overrides,
  onChange,
  portfolioOverrides,
  onScopeChange,
}: SeverityOverridesPanelProps): JSX.Element {
  const showScopeToggle =
    portfolioOverrides !== undefined && onScopeChange !== undefined;
  if (rules.length === 0) {
    return (
      <section aria-label="severity overrides">
        <h2>Severity overrides</h2>
        <p>
          <em>No rules available to override.</em>
        </p>
      </section>
    );
  }

  function handleChange(ruleId: string, e: ChangeEvent<HTMLSelectElement>): void {
    const v = e.target.value;
    if (v === CLEAR_VALUE) {
      onChange(ruleId, null);
      return;
    }
    if (isOverrideSeverity(v)) {
      onChange(ruleId, v);
    }
  }

  return (
    <section aria-label="severity overrides">
      <h2>Severity overrides</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Rule</th>
            <th scope="col">Built-in</th>
            <th scope="col">Override</th>
            {showScopeToggle ? <th scope="col">Scope</th> : null}
            <th scope="col">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => {
            const current = overrides[r.id];
            const hasOverride = current !== undefined;
            const value: string = current ?? CLEAR_VALUE;
            return (
              <tr key={r.id}>
                <td>
                  <strong>{r.title}</strong>
                  <div>
                    <small>{r.id}</small>
                  </div>
                </td>
                <td>{SEVERITY_LABEL[r.severity]}</td>
                <td>
                  <label>
                    <span className="visually-hidden">
                      Override severity for {r.title}
                    </span>
                    <select
                      aria-label={`override severity for ${r.id}`}
                      value={value}
                      onChange={(e) => handleChange(r.id, e)}
                    >
                      <option value={CLEAR_VALUE}>— use built-in —</option>
                      <option value="info">{SEVERITY_LABEL.info}</option>
                      <option value="warn">{SEVERITY_LABEL.warn}</option>
                      <option value="error">{SEVERITY_LABEL.error}</option>
                    </select>
                  </label>
                </td>
                {showScopeToggle ? (
                  <td>
                    <label>
                      <input
                        type="checkbox"
                        aria-label={`apply across portfolio for ${r.id}`}
                        checked={portfolioOverrides?.[r.id] !== undefined}
                        onChange={(e) =>
                          onScopeChange?.(
                            r.id,
                            e.target.checked ? 'portfolio' : 'lease',
                          )
                        }
                      />
                      <span className="visually-hidden">
                        Apply across portfolio for {r.title}
                      </span>
                    </label>
                  </td>
                ) : null}
                <td>
                  <button
                    type="button"
                    onClick={() => onChange(r.id, null)}
                    disabled={!hasOverride}
                    aria-label={`clear override for ${r.id}`}
                  >
                    Clear
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export type { SeverityOverridesPanelProps };

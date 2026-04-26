// Wave 27-C — design pass rewrite.
// Semantic attributes preserved verbatim:
//   aria-label="severity overrides"              (section, both branches)
//   aria-label={`override severity for ${r.id}`} (select)
//   aria-label={`apply across portfolio for ${r.id}`} (checkbox)
//   aria-label={`clear override for ${r.id}`}   (button)
//
import type { ChangeEvent } from 'react';
import { Section } from './system/Section';
import { Button } from './system/Button';

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

// Wave 29-E — switched from ad-hoc `color-mix` triples (Wave 28-D) to
// the shared `--color-severity-bg-*` / `--color-severity-border-*`
// token pairs declared in index.css. Tinted background + dark fg
// (--color-fg) keeps contrast at WCAG AA (4.5:1 body); severity hue
// lives in the bg + low-alpha border rather than the text color, since
// the warm severity tokens don't pass against cream as foregrounds at
// body sizes.
const SEVERITY_BADGE_CLASS: Record<OverrideSeverity, string> = {
  info: 'bg-[var(--color-severity-bg-info)] text-fg border border-[var(--color-severity-border-info)]',
  warn: 'bg-[var(--color-severity-bg-warn)] text-fg border border-[var(--color-severity-border-warn)]',
  error: 'bg-[var(--color-severity-bg-error)] text-fg border border-[var(--color-severity-border-error)]',
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
      <Section label="severity overrides" className="space-y-2 px-4 py-4">
        <h2 className="text-heading uppercase text-fg-muted">Severity overrides</h2>
        <p className="text-body text-fg-muted">
          <em>No rules available to override.</em>
        </p>
      </Section>
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
    <Section label="severity overrides" className="space-y-3 px-4 py-4">
      <h2 className="text-heading uppercase text-fg-muted">Severity overrides</h2>
      <div className="overflow-x-auto max-h-[24rem] relative">
        <table className="w-full text-small text-fg-body border-collapse">
          <thead className="sticky top-0 z-10 bg-paper-raised">
            <tr className="border-b border-rule">
              <th scope="col" className="text-left py-1 pr-3 text-fg-muted font-sans bg-paper-raised">Rule</th>
              <th scope="col" className="text-left py-1 pr-3 text-fg-muted font-sans bg-paper-raised">Built-in</th>
              <th scope="col" className="text-left py-1 pr-3 text-fg-muted font-sans bg-paper-raised">Override</th>
              {showScopeToggle ? <th scope="col" className="text-left py-1 pr-3 text-fg-muted font-sans bg-paper-raised">Scope</th> : null}
              <th scope="col" className="text-left py-1 text-fg-muted font-sans bg-paper-raised">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => {
              const current = overrides[r.id];
              const hasOverride = current !== undefined;
              const value: string = current ?? CLEAR_VALUE;
              return (
                <tr key={r.id} className="even:bg-paper-sunken hover:bg-[var(--state-hover)] border-b border-rule-subtle transition-colors">
                  <td className="py-2 pr-3 align-top">
                    <strong className="text-body text-fg-body font-sans">{r.title}</strong>
                    <div>
                      <small className="font-mono text-mono text-fg-body">{r.id}</small>
                    </div>
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <span
                      data-severity-badge={r.severity}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-small font-sans ${SEVERITY_BADGE_CLASS[r.severity]}`}
                    >
                      {SEVERITY_LABEL[r.severity]}
                    </span>
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <label className="flex flex-col gap-1">
                      <span className="sr-only">
                        Override severity for {r.title}
                      </span>
                      {/* Both aria-label and the wrapping <label> intentionally present — test depends on aria-label text differing from the visual title. */}
                      <select
                        aria-label={`override severity for ${r.id}`}
                        value={value}
                        className="border border-rule rounded-sm bg-paper-raised px-2 py-1 text-small text-fg focus:outline focus:outline-2 focus:outline-ink"
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
                    <td className="py-2 pr-3 align-top">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
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
                        <span className="sr-only">
                          Apply across portfolio for {r.title}
                        </span>
                      </label>
                    </td>
                  ) : null}
                  <td className="py-2 align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onChange(r.id, null)}
                      disabled={!hasOverride}
                      aria-label={`clear override for ${r.id}`}
                    >
                      Clear
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

export type { SeverityOverridesPanelProps };

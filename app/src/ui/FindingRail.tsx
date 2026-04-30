import { useMemo } from 'react';
import type { Finding, Severity } from '../rules/types';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  /** Total paragraph count drives the rail's vertical resolution. */
  paragraphCount: number;
  findings: Finding[];
  /** Currently-selected finding (highlighted cell). */
  selected: Finding | null;
  onSelectFinding: (finding: Finding) => void;
}

const SEVERITY_RANK: Record<Severity, number> = {
  high: 0,
  medium: 1,
  low: 2,
  info: 3,
};

const SEVERITY_VAR: Record<Severity, string> = {
  high: 'var(--color-severity-high)',
  medium: 'var(--color-severity-medium)',
  low: 'var(--color-severity-low)',
  info: 'var(--color-severity-info)',
};

/**
 * Wave 51-C — 28px vertical heatmap. One cell per paragraph, colored by
 * the most severe finding that lands on that paragraph. Click a cell to
 * select that finding.
 */
export function FindingRail({
  paragraphCount,
  findings,
  selected,
  onSelectFinding,
}: Props): JSX.Element {
  const { t } = useI18n();
  const findingByPara = useMemo<Map<number, Finding>>(() => {
    const m = new Map<number, Finding>();
    for (const f of findings) {
      const cur = m.get(f.paragraphIndex);
      if (!cur || SEVERITY_RANK[f.severity] < SEVERITY_RANK[cur.severity]) {
        m.set(f.paragraphIndex, f);
      }
    }
    return m;
  }, [findings]);

  const isSelected = (f: Finding): boolean =>
    selected != null &&
    selected.ruleId === f.ruleId &&
    selected.paragraphIndex === f.paragraphIndex &&
    selected.span.start === f.span.start;

  return (
    <nav
      aria-label={t('reader.rail.label')}
      className="flex w-7 flex-col border-r border-rule bg-paper-sunken py-3"
    >
      <div className="flex flex-1 flex-col gap-px px-1.5">
        {Array.from({ length: paragraphCount }, (_, i) => {
          const f = findingByPara.get(i);
          if (!f) {
            return (
              <div
                key={i}
                aria-hidden="true"
                className="min-h-[4px] flex-1 rounded-sm bg-rule-subtle"
              />
            );
          }
          const active = isSelected(f);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectFinding(f)}
              aria-label={t('reader.rail.cell', {
                severity: f.severity,
                paragraph: String(i + 1),
              })}
              className="min-h-[4px] flex-1 rounded-sm border-0 p-0 transition-transform"
              style={{
                background: active
                  ? SEVERITY_VAR[f.severity]
                  : `color-mix(in oklab, ${SEVERITY_VAR[f.severity]} 65%, var(--color-paper-sunken))`,
                transform: active ? 'scaleX(1.4)' : 'none',
              }}
            />
          );
        })}
      </div>
    </nav>
  );
}

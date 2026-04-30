import { useMemo, useState } from 'react';
import { Dialog } from './system/Dialog';
import type { Finding, Severity } from '../rules/types';
import type { LeaseDocument } from '../parser/types';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  open: boolean;
  doc: LeaseDocument;
  finding: Finding | null;
  allFindings: Finding[];
  onSelect: (finding: Finding) => void;
  onClose: () => void;
  suggestedTextByRuleId?: Readonly<Record<string, string>>;
  plainEnglishByRuleId?: Readonly<Record<string, string>>;
  onApplySuggestion?: (finding: Finding, paragraphIndex: number, suggestedText: string) => void;
  onAddToCounters?: (finding: Finding) => void;
}

const SEVERITY_VAR: Record<Severity, string> = {
  high: 'var(--color-severity-high)',
  medium: 'var(--color-severity-medium)',
  low: 'var(--color-severity-low)',
  info: 'var(--color-severity-info)',
};

function findingKey(f: Finding): string {
  return `${f.ruleId}__${f.paragraphIndex}__${f.span.start}`;
}

/**
 * Wave 51-D — scholarly-footnote modal for a single finding.
 *
 * Two-pane layout:
 *   - LEFT  the clause as a page from the lease (paragraph text, with
 *           the finding's snippet wrapped in a `<mark>`).
 *   - RIGHT the footnote: title, plain-English explanation, suggested
 *           edit, prev/next nav.
 *
 * Reuses `<Dialog>` for the focus trap, Esc handler, return-focus, and
 * `inert`-on-siblings invariants. Inline highlight is suppressed for
 * hybrid (LLM-classified) findings — same rule as MarginaliaReader: the
 * span is a paragraph prefix, not a real clause location.
 */
export function FindingDetailModal({
  open,
  doc,
  finding,
  allFindings,
  onSelect,
  onClose,
  suggestedTextByRuleId,
  plainEnglishByRuleId,
  onApplySuggestion,
  onAddToCounters,
}: Props): JSX.Element | null {
  const { t } = useI18n();
  const [applied, setApplied] = useState(false);

  // Reset the applied state when the user navigates to a different finding.
  // Tracking by key (ruleId+paragraphIndex+span.start) so prev/next works.
  const key = finding ? findingKey(finding) : null;
  const [appliedKey, setAppliedKey] = useState<string | null>(null);
  if (appliedKey !== null && appliedKey !== key && applied) {
    setApplied(false);
    setAppliedKey(null);
  }

  const idx = useMemo(() => {
    if (!finding) return -1;
    return allFindings.findIndex(
      (f) =>
        f.ruleId === finding.ruleId &&
        f.paragraphIndex === finding.paragraphIndex &&
        f.span.start === finding.span.start,
    );
  }, [allFindings, finding]);

  if (!open || !finding) return null;

  const total = allFindings.length;
  const prev = idx > 0 ? allFindings[idx - 1] : null;
  const next = idx >= 0 && idx < total - 1 ? allFindings[idx + 1] : null;
  const paragraph = doc.paragraphs[finding.paragraphIndex];
  const clauseText = paragraph?.text ?? finding.snippet;
  const suggestedText = suggestedTextByRuleId?.[finding.ruleId] ?? null;
  const plainEnglish = plainEnglishByRuleId?.[finding.ruleId] ?? finding.explanation;

  return (
    <Dialog
      open={open}
      onDismiss={onClose}
      titleId="finding-detail-title"
      descriptionId="finding-detail-description"
      closeOnEscape
      closeOnBackdropClick
      className="!max-w-[880px] !p-0 grid grid-cols-1 md:grid-cols-2 overflow-hidden"
    >
      {/* LEFT: clause as a page from the lease */}
      <section
        aria-label={t('finding.modal.clause')}
        className="border-b md:border-b-0 md:border-r border-rule bg-paper p-7"
      >
        <div className="mb-3 flex items-baseline justify-between text-mono text-fg-faint uppercase tracking-wider text-[11px]">
          <span>{t('finding.modal.from', { paragraph: String(finding.paragraphIndex + 1) })}</span>
          <span>{t('finding.modal.page', { page: String(finding.page) })}</span>
        </div>
        <p className="font-serif text-[15px] leading-[1.7] text-fg-body m-0">
          {renderClause(clauseText, finding)}
        </p>
      </section>

      {/* RIGHT: scholarly footnote */}
      <section className="flex min-h-0 flex-col p-7">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="font-mono text-[18px] font-semibold leading-none"
              style={{ color: SEVERITY_VAR[finding.severity] }}
            >
              ¹
            </span>
            <span
              className="rounded-sm px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em]"
              style={{
                background: `color-mix(in oklab, ${SEVERITY_VAR[finding.severity]} 26%, var(--color-paper))`,
                color: SEVERITY_VAR[finding.severity],
              }}
            >
              {t(`severity.${finding.severity}` as 'severity.high')}
            </span>
            {idx >= 0 && (
              <span className="font-mono text-[11px] text-fg-faint">
                {t('finding.modal.position', { idx: String(idx + 1), total: String(total) })}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('finding.modal.close')}
            className="rounded-sm border border-rule bg-paper-raised px-2 py-0.5 text-fg-body hover:bg-paper-sunken"
          >
            ✕
          </button>
        </div>

        <h2
          id="finding-detail-title"
          className="font-serif text-[24px] font-semibold leading-snug text-fg mb-3"
        >
          {finding.title}
        </h2>
        <p
          id="finding-detail-description"
          className="font-serif text-[15px] leading-relaxed text-fg-body m-0 mb-4"
        >
          {plainEnglish}
        </p>

        {suggestedText && (
          <>
            <div className="mb-2 text-mono text-[11px] uppercase tracking-wider text-fg-muted">
              {t('finding.modal.suggested')}
            </div>
            <blockquote className="m-0 mb-4 border border-rule bg-paper-sunken px-3 py-2 font-serif text-[13.5px] italic leading-snug text-fg-body">
              {suggestedText}
            </blockquote>
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (applied || !onApplySuggestion) return;
                  onApplySuggestion(finding, finding.paragraphIndex, suggestedText);
                  setApplied(true);
                  setAppliedKey(key);
                }}
                disabled={applied || !onApplySuggestion}
                className="rounded-sm bg-ink px-3 py-1.5 text-mono uppercase tracking-[0.06em] text-paper hover:bg-ink/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {applied ? t('finding.modal.applied') : t('finding.modal.apply')}
              </button>
              {onAddToCounters && (
                <button
                  type="button"
                  onClick={() => onAddToCounters(finding)}
                  className="rounded-sm border border-rule px-3 py-1 text-mono uppercase tracking-wider text-fg-body hover:bg-paper-sunken"
                >
                  {t('finding.modal.counter')}
                </button>
              )}
            </div>
          </>
        )}

        <div className="flex-1" />

        <nav
          aria-label={t('finding.modal.nav')}
          className="flex items-center justify-between gap-2 border-t border-rule-subtle pt-3"
        >
          <button
            type="button"
            onClick={() => prev && onSelect(prev)}
            disabled={!prev}
            className="rounded-sm px-2 py-1 text-mono uppercase tracking-wider text-fg-body hover:bg-paper-sunken disabled:opacity-40"
          >
            ‹ {t('finding.modal.prev')}
          </button>
          <span className="font-mono text-[10.5px] text-fg-faint">{finding.ruleId}</span>
          <button
            type="button"
            onClick={() => next && onSelect(next)}
            disabled={!next}
            className="rounded-sm px-2 py-1 text-mono uppercase tracking-wider text-fg-body hover:bg-paper-sunken disabled:opacity-40"
          >
            {t('finding.modal.next')} ›
          </button>
        </nav>
        <p className="mt-2 font-serif text-[11.5px] italic text-fg-faint m-0">
          {t('finding.modal.disclaimer')}
        </p>
      </section>
    </Dialog>
  );
}

function renderClause(text: string, finding: Finding): React.ReactNode {
  // Hybrid findings: snippet + span both cover paragraph prefix; render
  // plain text. Same rule as MarginaliaReader.
  if (finding.evidence) return text;
  const snippet = finding.snippet;
  const idx = snippet ? text.indexOf(snippet, Math.max(0, finding.span.start)) : -1;
  if (idx < 0) {
    // Fall back to span if in-range. If neither resolves, render plain text.
    if (finding.span.end <= text.length && finding.span.start < finding.span.end) {
      return [
        text.slice(0, finding.span.start),
        <Highlight key="m" severity={finding.severity}>
          {text.slice(finding.span.start, finding.span.end)}
        </Highlight>,
        text.slice(finding.span.end),
      ];
    }
    return text;
  }
  return [
    text.slice(0, idx),
    <Highlight key="m" severity={finding.severity}>
      {text.slice(idx, idx + snippet.length)}
    </Highlight>,
    text.slice(idx + snippet.length),
  ];
}

function Highlight({
  severity,
  children,
}: {
  severity: Severity;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <mark
      className="rounded-sm px-0.5"
      style={{
        background: `color-mix(in oklab, ${SEVERITY_VAR[severity]} 24%, var(--color-paper))`,
        color: 'inherit',
      }}
    >
      {children}
    </mark>
  );
}

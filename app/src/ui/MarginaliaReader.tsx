import { useEffect, useMemo, useRef } from 'react';
import type { LeaseDocument } from '../parser/types';
import type { Finding, Severity } from '../rules/types';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  doc: LeaseDocument;
  findings: Finding[];
  selected: Finding | null;
  onSelectFinding: (finding: Finding) => void;
  fileName: string;
}

const SEVERITY_VAR: Record<Severity, string> = {
  high: 'var(--color-severity-high)',
  medium: 'var(--color-severity-medium)',
  low: 'var(--color-severity-low)',
  info: 'var(--color-severity-info)',
};

/**
 * Stable id for a finding within a document — used for `data-finding-id`
 * scroll-into-view targeting and the margin-card key.
 */
function findingKey(f: Finding): string {
  return `${f.ruleId}__${f.paragraphIndex}__${f.span.start}`;
}

/**
 * Wave 51-C — Marginalia reader. Renders `LeaseDocument.paragraphs` as
 * scholarly body text with inline `<mark>` highlights on the snippet span,
 * and a margin column of finding cards aligned to the paragraph they
 * reference. Clicking a `<mark>` or a margin card promotes the finding
 * to the active selection; the active highlight is auto-scrolled into
 * view. Read-only — no mutation, no shared state with the redline path.
 */
export function MarginaliaReader({
  doc,
  findings,
  selected,
  onSelectFinding,
  fileName,
}: Props): JSX.Element {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);

  const findingsByPara = useMemo<Map<number, Finding[]>>(() => {
    const m = new Map<number, Finding[]>();
    for (const f of findings) {
      const arr = m.get(f.paragraphIndex);
      if (arr) arr.push(f);
      else m.set(f.paragraphIndex, [f]);
    }
    return m;
  }, [findings]);

  const selectedKey = selected ? findingKey(selected) : null;

  useEffect(() => {
    if (!selectedKey || !containerRef.current) return;
    // Escape selectedKey before splicing into a CSS selector — `ruleId`
    // comes from imported rule packs whose only validation is "non-empty
    // string", so it can contain quotes or `]` that break the selector.
    const escaped =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(selectedKey)
        : selectedKey.replace(/["\\\]]/g, '\\$&');
    const el = containerRef.current.querySelector<HTMLElement>(`[data-finding-id="${escaped}"]`);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedKey]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto border-r border-rule bg-paper"
      role="region"
      aria-label={t('reader.region.label')}
    >
      <div className="mx-auto grid max-w-[920px] grid-cols-[1fr_200px] gap-x-8 px-6 pb-32 pt-8">
        <div className="col-span-2">
          <div className="text-mono uppercase tracking-wider text-fg-faint">
            {t('reader.header.document', { count: String(doc.pages.length) })}
          </div>
          <div className="mt-1.5 mb-6 flex items-baseline justify-between border-b border-rule pb-3">
            <div className="font-serif text-sm italic text-fg-muted">{fileName}</div>
          </div>
        </div>

        {doc.paragraphs.map((p, idx) => {
          const paraFindings = findingsByPara.get(idx) ?? [];
          return (
            <div key={idx} className="contents">
              <div className="relative">
                <div
                  className="mono absolute -left-8 top-1 select-none text-[10px] tracking-wider text-fg-faint"
                  aria-hidden="true"
                >
                  {String(idx + 1).padStart(2, '0')}
                </div>
                <p className="font-serif text-base leading-relaxed text-fg-body mb-3">
                  {renderParagraph(p.text, paraFindings, selectedKey, onSelectFinding)}
                </p>
              </div>
              <div>
                {paraFindings.map((f) => {
                  const key = findingKey(f);
                  const active = key === selectedKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onSelectFinding(f)}
                      className="mb-1.5 block w-full border-l border-l-[1px] px-2.5 py-2 text-left transition-colors"
                      style={{
                        borderLeftColor: SEVERITY_VAR[f.severity],
                        background: active
                          ? `color-mix(in oklab, ${SEVERITY_VAR[f.severity]} 14%, var(--color-paper))`
                          : 'transparent',
                      }}
                    >
                      <div
                        className="mb-1 flex items-center gap-1.5 text-mono text-[10.5px] uppercase tracking-wider"
                        style={{ color: SEVERITY_VAR[f.severity] }}
                      >
                        <span>{t(`severity.${f.severity}` as 'severity.high')}</span>
                        <span aria-hidden="true">·</span>
                        <span>¶{idx + 1}</span>
                      </div>
                      <div className="font-serif text-[12.5px] italic leading-snug text-fg-body">
                        {truncate(f.title, 110)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/**
 * Render paragraph text with `<mark>` highlights for each finding's
 * resolved span. Inline highlight rules — narrower than the design source
 * to avoid fabricating evidence:
 *
 *   - Hybrid (LLM-classified) findings carry a paragraph-prefix snippet
 *     (`text.slice(0,200)`) and `span = 0..200` rather than a real clause
 *     location; we render them as margin cards only and skip the inline
 *     highlight.
 *   - Deterministic findings use the persisted `span` as ground truth.
 *     `snippet` is consulted only when the span is out-of-range — and
 *     even then we anchor the lookup at `span.start` so repeated text in
 *     the paragraph doesn't snap the highlight to a different occurrence.
 */
function renderParagraph(
  text: string,
  paraFindings: Finding[],
  selectedKey: string | null,
  onSelectFinding: (f: Finding) => void,
): React.ReactNode {
  if (paraFindings.length === 0) return text;
  const ranges = paraFindings
    .map((f) => {
      // Hybrid findings have no precise clause position — just show the
      // margin card, no inline highlight. See Finding.evidence (Wave 23-C).
      if (f.evidence) return null;
      // Span as ground truth for deterministic findings.
      if (f.span.start >= 0 && f.span.end <= text.length && f.span.start < f.span.end) {
        return { start: f.span.start, end: f.span.end, finding: f };
      }
      // Span drifted (re-parsed text changed) — try snippet but anchor at
      // span.start so repeated phrases don't relocate to the first match.
      if (f.snippet) {
        const idx = text.indexOf(f.snippet, Math.max(0, f.span.start));
        if (idx >= 0) return { start: idx, end: idx + f.snippet.length, finding: f };
      }
      return null;
    })
    .filter((r): r is { start: number; end: number; finding: Finding } => r !== null)
    .sort((a, b) => a.start - b.start);

  if (ranges.length === 0) return text;

  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    if (!r) continue;
    if (r.start < cursor) continue; // overlap; skip
    if (r.start > cursor) out.push(text.slice(cursor, r.start));
    const key = findingKey(r.finding);
    const active = key === selectedKey;
    out.push(
      <mark
        key={`m-${i}`}
        data-finding-id={key}
        onClick={() => onSelectFinding(r.finding)}
        className="cursor-pointer rounded-sm px-0.5"
        style={{
          background: active
            ? `color-mix(in oklab, ${SEVERITY_VAR[r.finding.severity]} 38%, transparent)`
            : `color-mix(in oklab, ${SEVERITY_VAR[r.finding.severity]} 22%, transparent)`,
          color: 'inherit',
        }}
      >
        {text.slice(r.start, r.end)}
      </mark>,
    );
    cursor = r.end;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

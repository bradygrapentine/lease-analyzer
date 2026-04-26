import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Category, Finding, Severity } from '../rules/types';
import type { DefinitionEntry } from '../facts/types';
import type { GlossaryEntry } from '../glossary/loadGlossary';
import { highlightDefinedTerms } from './highlightDefinedTerms';
import { useInViewport } from './useInViewport';
import { Button } from './system/Button';
import { Card } from './system/Card';
import type { HybridFeedbackPayload } from './HybridFeedbackButton';

const HybridFeedbackButton = lazy(() =>
  import('./HybridFeedbackButton').then((m) => ({ default: m.HybridFeedbackButton })),
);

// Aria/data inventory (preserved verbatim):
//   aria-label="findings" (aside)
//   aria-label="search findings" (input)
//   role="group" + aria-label="severity filters" (div)
//   role="group" + aria-label="category filters" (div)
//   aria-pressed + aria-label="severity ${sev}" (severity filter buttons)
//   aria-pressed + aria-label="category ${cat}" (category filter buttons)
//   aria-labelledby="findings-${sev}" (section)
//   id="findings-${sev}" (h2)
//   aria-expanded + aria-label="toggle ${sev}" (collapse button)
//   data-finding-key (li and button — both)
//   aria-expanded + aria-label="Identified by on-device classifier..." (llm badge button)
//   aria-expanded + aria-label="what this means for ${finding.title}" (explainer button)
//   aria-label="apply suggestion for ${finding.title}" (button)
//   aria-label="promote to standard ${finding.title}" (button)
//   aria-hidden="true" + data-finding-placeholder (placeholder div)

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
  /**
   * Optional plain-English summaries keyed by rule id. When provided, a
   * "What this means" disclosure is rendered under the explanation. Kept
   * separate from Finding so analysis output stays lean.
   */
  plainEnglishByRuleId?: Record<string, string>;
  /**
   * Optional defined-term glossary; if present, occurrences of each term
   * in a finding's snippet are wrapped with a hover tooltip.
   */
  definitions?: DefinitionEntry[];
  /**
   * Optional static legal glossary (Wave 11). When provided, generic
   * legal terms are tooltip-wrapped in addition to the lease-specific
   * `definitions`. Lease definitions win over glossary entries on
   * duplicate terms.
   */
  glossary?: GlossaryEntry[];
  /**
   * Optional per-rule suggested replacement text (either a user-saved
   * counter-offer or `rule.suggestedEdit`). When a finding's ruleId
   * appears in this map AND `onApplySuggestion` is provided, an "Apply
   * suggestion" button is rendered on the finding. Phase 9 addition —
   * purely additive.
   */
  suggestedTextByRuleId?: Record<string, string>;
  /**
   * Optional "Apply suggestion" callback. When present (and we have
   * suggested text for the finding), renders a button on each matching
   * finding that invokes this with the finding, its paragraphIndex, and
   * the suggested text. Wiring into redline storage is App's job.
   */
  onApplySuggestion?: (finding: Finding, paragraphIndex: number, suggestedText: string) => void;
  /**
   * Wave 10 Part C — optional "Promote to standard" callback. When defined
   * (and `leaseId` is supplied), each finding renders a button that
   * promotes the finding's paragraph into the user's standard-clause
   * suite. Default-undefined keeps the existing UI byte-identical.
   */
  onPromoteToStandard?: (leaseId: string, paragraphIndex: number) => void;
  /**
   * Wave 10 Part C — owning lease id, threaded into `onPromoteToStandard`.
   * Optional so existing call sites that don't wire promotion stay
   * untouched.
   */
  leaseId?: string;
  /**
   * Wave 29-C — optional callback fired when a user marks a hybrid finding
   * as not relevant. The button renders only when both this callback and
   * `leaseId` are provided AND the finding carries `evidence` (i.e. it's
   * a Phase 18 hybrid finding). Receives the canonical audit payload; the
   * caller is responsible for the actual `safeAudit({ kind: 'hybrid-feedback' })`
   * write.
   */
  onHybridFeedback?: (payload: HybridFeedbackPayload) => void | Promise<void>;
}

export function FindingsPanel({
  findings,
  onSelect,
  plainEnglishByRuleId,
  definitions,
  glossary,
  suggestedTextByRuleId,
  onApplySuggestion,
  onPromoteToStandard,
  leaseId,
  onHybridFeedback,
}: FindingsPanelProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [hiddenSeverities, setHiddenSeverities] = useState<Set<Severity>>(new Set());
  const [hiddenCategories, setHiddenCategories] = useState<Set<Category>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<Severity>>(new Set());
  const [openExplainers, setOpenExplainers] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement | null>(null);
  // Phase 13: pending-focus key for virtualized keyboard nav. When the
  // target row isn't mounted full yet, we remember its key; each rendered
  // button registers itself and claims focus if its key matches.
  const pendingFocusRef = useRef<string | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(findings.map((f) => f.category))).sort(),
    [findings],
  );

  if (findings.length === 0) {
    return (
      <aside aria-label="findings" className="p-4">
        <p className="text-body text-fg-muted">No findings yet. Upload a lease to analyze.</p>
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

  // Flat traversal order of all (non-collapsed) finding keys, matching
  // visual order. Used by keyboard nav so ArrowUp/Down can cycle through
  // items whose full content is currently swapped out for a placeholder.
  const orderedKeys: string[] = [];
  for (const sev of SEVERITY_ORDER) {
    const group = bySeverity[sev];
    if (!group || group.length === 0) continue;
    if (collapsed.has(sev)) continue;
    for (const f of group) orderedKeys.push(findingKey(f));
  }

  return (
    <aside aria-label="findings" className="flex flex-col gap-2">
      <div className="controls px-3 pt-3 space-y-2">
        <label>
          <span className="visually-hidden">Search findings</span>
          <input
            type="search"
            aria-label="search findings"
            placeholder="Search findings…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full border border-rule rounded-sm bg-paper-raised px-2 py-1 text-body text-fg focus:outline focus:outline-2 focus:outline-ink"
          />
        </label>

        <div role="group" aria-label="severity filters" className="flex flex-wrap gap-1">
          {SEVERITY_ORDER.map((sev) => (
            <Button
              key={sev}
              type="button"
              variant="ghost"
              size="sm"
              pressed={!hiddenSeverities.has(sev)}
              aria-pressed={!hiddenSeverities.has(sev)}
              aria-label={`severity ${sev}`}
              onClick={() => toggleInSet(hiddenSeverities, sev, setHiddenSeverities)}
            >
              {SEVERITY_LABEL[sev]}
            </Button>
          ))}
        </div>

        <div role="group" aria-label="category filters" className="flex flex-wrap gap-1">
          {categories.map((cat) => (
            <Button
              key={cat}
              type="button"
              variant="ghost"
              size="sm"
              pressed={!hiddenCategories.has(cat)}
              aria-pressed={!hiddenCategories.has(cat)}
              aria-label={`category ${cat}`}
              onClick={() => toggleInSet(hiddenCategories, cat, setHiddenCategories)}
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      <div ref={listRef} onKeyDown={onListKeyDown} className="flex-1 overflow-y-auto px-3 pb-3 space-y-3">
        {SEVERITY_ORDER.map((sev) => {
          const group = bySeverity[sev];
          if (!group || group.length === 0) return null;
          const isCollapsed = collapsed.has(sev);
          return (
            <section key={sev} aria-labelledby={`findings-${sev}`}>
              <h2 id={`findings-${sev}`} className="mb-1">
                <button
                  type="button"
                  aria-expanded={!isCollapsed}
                  aria-label={`toggle ${sev}`}
                  onClick={() => toggleInSet(collapsed, sev, setCollapsed)}
                  className="flex w-full items-center justify-between text-heading uppercase font-sans text-fg-muted py-1 hover:text-fg transition-colors"
                >
                  <span>
                    {SEVERITY_LABEL[sev]} ({group.length})
                  </span>
                  <span aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span>
                </button>
              </h2>
              {!isCollapsed && (
                <ul className="space-y-2">
                  {group.map((finding) => {
                    const key = findingKey(finding);
                    const plain = plainEnglishByRuleId?.[finding.ruleId];
                    const isOpen = openExplainers.has(key);
                    const suggested =
                      onApplySuggestion && suggestedTextByRuleId
                        ? suggestedTextByRuleId[finding.ruleId]
                        : undefined;
                    return (
                      <VirtualFindingItem
                        key={key}
                        findingKey={key}
                        finding={finding}
                        definitions={definitions}
                        glossary={glossary}
                        plain={plain}
                        isExplainerOpen={isOpen}
                        toggleExplainer={() => toggleInSet(openExplainers, key, setOpenExplainers)}
                        isHybridDetailOpen={openExplainers.has(`${key}:hybrid`)}
                        toggleHybridDetail={() =>
                          toggleInSet(openExplainers, `${key}:hybrid`, setOpenExplainers)
                        }
                        suggestedText={suggested}
                        onSelect={onSelect}
                        onApplySuggestion={onApplySuggestion}
                        onPromoteToStandard={onPromoteToStandard}
                        leaseId={leaseId}
                        onHybridFeedback={onHybridFeedback}
                        pendingFocusRef={pendingFocusRef}
                      />
                    );
                  })}
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
    const active = document.activeElement as HTMLElement | null;
    const activeKey = active?.dataset.findingKey;
    if (!activeKey) return;
    const activeIdx = orderedKeys.indexOf(activeKey);
    if (activeIdx === -1) return;
    const nextIdx = e.key === 'ArrowDown' ? activeIdx + 1 : activeIdx - 1;
    const nextKey = orderedKeys[nextIdx];
    if (!nextKey) return;
    e.preventDefault();
    const nextBtn = root.querySelector<HTMLButtonElement>(
      `button.finding-btn[data-finding-key="${cssEscape(nextKey)}"]`,
    );
    if (nextBtn) {
      nextBtn.focus();
      return;
    }
    // Target row is currently a placeholder. Mark it pending and scroll
    // its <li> into view; IntersectionObserver will remount it, and the
    // effect inside VirtualFindingItem will claim focus when the button
    // appears.
    pendingFocusRef.current = nextKey;
    const li = root.querySelector<HTMLLIElement>(`li[data-finding-key="${cssEscape(nextKey)}"]`);
    if (li && typeof li.scrollIntoView === 'function') {
      li.scrollIntoView({ block: 'nearest' });
    }
  }
}

function cssEscape(value: string): string {
  // CSS.escape isn't in jsdom consistently; do a simple manual escape of
  // the characters that appear in our findingKey format.
  return value.replace(/["\\]/g, '\\$&');
}

interface VirtualFindingItemProps {
  findingKey: string;
  finding: Finding;
  definitions: DefinitionEntry[] | undefined;
  glossary: GlossaryEntry[] | undefined;
  plain: string | undefined;
  isExplainerOpen: boolean;
  toggleExplainer: () => void;
  isHybridDetailOpen: boolean;
  toggleHybridDetail: () => void;
  suggestedText: string | undefined;
  onSelect: (finding: Finding) => void;
  onApplySuggestion:
    | ((finding: Finding, paragraphIndex: number, suggestedText: string) => void)
    | undefined;
  onPromoteToStandard: ((leaseId: string, paragraphIndex: number) => void) | undefined;
  leaseId: string | undefined;
  onHybridFeedback: ((payload: HybridFeedbackPayload) => void | Promise<void>) | undefined;
  pendingFocusRef: { current: string | null };
}

function VirtualFindingItem(props: VirtualFindingItemProps): JSX.Element {
  const {
    findingKey: key,
    finding,
    definitions,
    glossary,
    plain,
    isExplainerOpen,
    toggleExplainer,
    isHybridDetailOpen,
    toggleHybridDetail,
    suggestedText,
    onSelect,
    onApplySuggestion,
    onPromoteToStandard,
    leaseId,
    onHybridFeedback,
    pendingFocusRef,
  } = props;
  const liRef = useRef<HTMLLIElement | null>(null);
  const fullRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const inView = useInViewport(liRef);
  // Cache the measured height of the full content so the placeholder can
  // reserve the same slot when we swap out — preventing scroll jumps.
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (inView && fullRef.current) {
      const h = fullRef.current.offsetHeight;
      if (h > 0 && h !== measuredHeight) setMeasuredHeight(h);
    }
  }, [inView, measuredHeight, finding]);

  // If keyboard nav asked to land here, grab focus once the button mounts.
  useEffect(() => {
    if (!inView) return;
    if (pendingFocusRef.current === key && btnRef.current) {
      pendingFocusRef.current = null;
      btnRef.current.focus();
    }
  }, [inView, key, pendingFocusRef]);

  return (
    <li ref={liRef} data-finding-key={key}>
      {inView ? (
        <Card accent={finding.severity as Severity} className="overflow-hidden">
          <div ref={fullRef}>
            <button
              type="button"
              className="finding-btn w-full text-left p-3 space-y-1"
              data-finding-key={key}
              ref={btnRef}
              onClick={() => onSelect(finding)}
            >
              <span className="font-sans text-body text-fg-body font-semibold">
                {finding.title}
              </span>
              {finding.negated && (
                <span aria-label="negated" className="text-small text-fg-muted ml-1">
                  {' '}(possibly not applicable)
                </span>
              )}
              {finding.deviation && (
                <span
                  className="finding-deviation-badge text-small text-fg-muted ml-1"
                  aria-label="Deviates from verified baseline"
                >
                  {' '}deviates from verified pack
                </span>
              )}
              <div className="text-body text-fg-body">{finding.explanation}</div>
              {(definitions && definitions.length > 0) || (glossary && glossary.length > 0) ? (
                <span className="finding-snippet block font-mono text-mono text-fg-muted">
                  {highlightDefinedTerms(finding.snippet, definitions ?? [], glossary)}
                </span>
              ) : null}
              <span className="text-small text-fg-muted">Page {finding.page}</span>
            </button>
            {finding.evidence ? (
              <div className="finding-llm-detail px-3 pb-2">
                {/* LLM badge intentionally rendered as <button> (not <Badge>) because
                    Wave 25-B made it the click-to-explain disclosure trigger — it
                    toggles aria-expanded and reveals the model/similarity/threshold
                    detail panel. <Badge> is a non-interactive <span>. */}
                <button
                  type="button"
                  className="finding-llm-badge inline-flex items-center gap-1 text-small text-fg-muted border border-rule rounded-sm px-2 py-0.5 hover:bg-[var(--state-hover)] active:bg-[var(--state-active)] transition-colors focus-visible:focus-ring"
                  aria-expanded={isHybridDetailOpen}
                  aria-pressed={isHybridDetailOpen}
                  aria-label={`Identified by on-device classifier (similarity ${Math.round(
                    finding.evidence.similarity * 100,
                  )}%)`}
                  title={`On-device classifier (similarity ${Math.round(
                    finding.evidence.similarity * 100,
                  )}%)`}
                  onClick={toggleHybridDetail}
                >
                  ~
                </button>
                {onHybridFeedback && leaseId !== undefined ? (
                  <span className="ml-2 inline-flex">
                    <Suspense fallback={null}>
                      <HybridFeedbackButton
                        finding={finding}
                        leaseId={leaseId}
                        onSubmit={onHybridFeedback}
                      />
                    </Suspense>
                  </span>
                ) : null}
                {isHybridDetailOpen ? (
                  <dl className="finding-llm-evidence mt-2 space-y-1 text-small text-fg-body">
                    <dt className="text-fg-muted">Model</dt>
                    <dd className="font-mono text-mono ml-2">{finding.evidence.modelId}</dd>
                    <dt className="text-fg-muted">Similarity</dt>
                    <dd className="ml-2">{Math.round(finding.evidence.similarity * 100)}%</dd>
                    <dt className="text-fg-muted">Threshold</dt>
                    <dd className="ml-2">Above the 70% similarity floor</dd>
                  </dl>
                ) : null}
              </div>
            ) : null}
            {plain ? (
              <div className="finding-plain-english px-3 pb-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-expanded={isExplainerOpen}
                  aria-label={`what this means for ${finding.title}`}
                  onClick={toggleExplainer}
                >
                  What this means
                </Button>
                {isExplainerOpen ? (
                  <p className="mt-1 text-body text-fg-body">{plain}</p>
                ) : null}
              </div>
            ) : null}
            {(onApplySuggestion && suggestedText) || (onPromoteToStandard && leaseId !== undefined) ? (
              <div className="flex gap-2 px-3 pb-3">
                {onApplySuggestion && suggestedText ? (
                  <Button
                    type="button"
                    variant="subtle"
                    size="sm"
                    aria-label={`apply suggestion for ${finding.title}`}
                    onClick={() => onApplySuggestion(finding, finding.paragraphIndex, suggestedText)}
                  >
                    Apply suggestion
                  </Button>
                ) : null}
                {onPromoteToStandard && leaseId !== undefined ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`promote to standard ${finding.title}`}
                    onClick={() => onPromoteToStandard(leaseId, finding.paragraphIndex)}
                  >
                    Promote to standard
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>
      ) : (
        <div
          aria-hidden="true"
          data-finding-placeholder={key}
          style={measuredHeight != null ? { height: `${measuredHeight}px` } : undefined}
        />
      )}
    </li>
  );
}

function toggleInSet<T>(current: Set<T>, value: T, setter: (s: Set<T>) => void): void {
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

function findingKey(f: Finding): string {
  return `${f.ruleId}-${f.paragraphIndex}-${f.span.start}`;
}

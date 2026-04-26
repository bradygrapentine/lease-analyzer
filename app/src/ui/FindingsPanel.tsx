import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Category, Finding, Severity } from '../rules/types';
import type { DefinitionEntry } from '../facts/types';
import type { GlossaryEntry } from '../glossary/loadGlossary';
import { highlightDefinedTerms } from './highlightDefinedTerms';
import { useInViewport } from './useInViewport';

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
        <div ref={fullRef}>
          <button
            type="button"
            className="finding-btn"
            data-finding-key={key}
            ref={btnRef}
            onClick={() => onSelect(finding)}
          >
            <strong>{finding.title}</strong>
            {finding.negated && <span aria-label="negated"> (possibly not applicable)</span>}
            {finding.deviation && (
              <span
                className="finding-deviation-badge"
                aria-label="Deviates from verified baseline"
              >
                {' '}
                deviates from verified pack
              </span>
            )}
            <div>{finding.explanation}</div>
            {(definitions && definitions.length > 0) || (glossary && glossary.length > 0) ? (
              <small className="finding-snippet">
                {highlightDefinedTerms(finding.snippet, definitions ?? [], glossary)}
              </small>
            ) : null}
            <small>Page {finding.page}</small>
          </button>
          {finding.evidence ? (
            <div className="finding-llm-detail">
              <button
                type="button"
                className="finding-llm-badge"
                aria-expanded={isHybridDetailOpen}
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
              {isHybridDetailOpen ? (
                <dl className="finding-llm-evidence">
                  <dt>Model</dt>
                  <dd>{finding.evidence.modelId}</dd>
                  <dt>Similarity</dt>
                  <dd>{Math.round(finding.evidence.similarity * 100)}%</dd>
                  <dt>Threshold</dt>
                  <dd>Above the 70% similarity floor</dd>
                </dl>
              ) : null}
            </div>
          ) : null}
          {plain ? (
            <div className="finding-plain-english">
              <button
                type="button"
                aria-expanded={isExplainerOpen}
                aria-label={`what this means for ${finding.title}`}
                onClick={toggleExplainer}
              >
                What this means
              </button>
              {isExplainerOpen ? <p>{plain}</p> : null}
            </div>
          ) : null}
          {onApplySuggestion && suggestedText ? (
            <button
              type="button"
              aria-label={`apply suggestion for ${finding.title}`}
              onClick={() => onApplySuggestion(finding, finding.paragraphIndex, suggestedText)}
            >
              Apply suggestion
            </button>
          ) : null}
          {onPromoteToStandard && leaseId !== undefined ? (
            <button
              type="button"
              aria-label={`promote to standard ${finding.title}`}
              onClick={() => onPromoteToStandard(leaseId, finding.paragraphIndex)}
            >
              Promote to standard
            </button>
          ) : null}
        </div>
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

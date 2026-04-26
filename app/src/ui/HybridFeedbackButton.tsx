import { useEffect, useState } from 'react';
import type { Finding } from '../rules/types';
import { listAuditEntries } from '../audit/auditLog';

// Wave 29-C — "not relevant" feedback on hybrid findings.
//
// Renders a thumbs-down button next to the existing finding-llm-badge.
// Click writes a `kind: 'hybrid-feedback'` audit entry, idempotent on the
// `(ruleId, paragraphIndex, leaseId, signal)` tuple. Negative signal only
// (no thumbs-up — positive acceptance is implicit per plan §1.5).

export interface HybridFeedbackPayload {
  ruleId: string;
  paragraphIndex: number;
  modelId: string;
  similarity: number;
  leaseId: string;
  signal: 'not-relevant';
}

interface HybridFeedbackButtonProps {
  finding: Finding;
  leaseId: string;
  /**
   * Called when a click writes a new audit entry. Receives the canonical
   * payload that was persisted. Not invoked on idempotent no-ops.
   */
  onSubmit: (payload: HybridFeedbackPayload) => void | Promise<void>;
  /**
   * Test seam — defaults to `listAuditEntries` from the real audit module.
   * Tests pass a stub returning an in-memory chain so we don't pull IDB
   * into the unit test for this component.
   */
  listEntries?: () => Promise<
    Array<{ kind: string; payload: Record<string, unknown> }>
  >;
}

export function HybridFeedbackButton({
  finding,
  leaseId,
  onSubmit,
  listEntries = listAuditEntries,
}: HybridFeedbackButtonProps): JSX.Element | null {
  const evidence = finding.evidence;
  const [submitted, setSubmitted] = useState(false);

  // On mount (and when identity changes), check the audit chain for an
  // existing matching entry so a re-render after a prior session reflects
  // the persisted state. The button stays clickable on its initial paint
  // — the idempotency check at click time is the source of truth.
  useEffect(() => {
    if (!evidence) return;
    let cancelled = false;
    void listEntries()
      .then((entries) => {
        if (cancelled) return;
        if (hasMatchingEntry(entries, finding.ruleId, finding.paragraphIndex, leaseId)) {
          setSubmitted(true);
        }
      })
      .catch(() => {
        /* read-only check; ignore errors and let click handle re-check. */
      });
    return () => {
      cancelled = true;
    };
  }, [evidence, finding.ruleId, finding.paragraphIndex, leaseId, listEntries]);

  if (!evidence) return null;

  const handleClick = async (): Promise<void> => {
    if (submitted) return;
    let entries: Array<{ kind: string; payload: Record<string, unknown> }> = [];
    try {
      entries = await listEntries();
    } catch {
      // Fall through; if listing fails, treat as no prior entry — the
      // append path itself remains the durable record.
    }
    if (hasMatchingEntry(entries, finding.ruleId, finding.paragraphIndex, leaseId)) {
      setSubmitted(true);
      return;
    }
    const payload: HybridFeedbackPayload = {
      ruleId: finding.ruleId,
      paragraphIndex: finding.paragraphIndex,
      modelId: evidence.modelId,
      similarity: evidence.similarity,
      leaseId,
      signal: 'not-relevant',
    };
    setSubmitted(true);
    await onSubmit(payload);
  };

  return (
    <button
      type="button"
      className="finding-hybrid-feedback inline-flex items-center gap-1 text-small text-fg-muted border border-rule rounded-sm px-2 py-0.5 hover:bg-[var(--state-hover)] active:bg-[var(--state-active)] transition-colors focus-visible:focus-ring disabled:opacity-60 disabled:cursor-not-allowed"
      aria-label={
        submitted
          ? `Marked "${finding.title}" as not relevant`
          : `Mark "${finding.title}" as not relevant`
      }
      aria-pressed={submitted}
      disabled={submitted}
      title={submitted ? 'Feedback recorded' : 'Mark as not relevant'}
      onClick={() => {
        void handleClick();
      }}
    >
      <span aria-hidden="true">{submitted ? '✓' : '⌄'}</span>
    </button>
  );
}

function hasMatchingEntry(
  entries: Array<{ kind: string; payload: Record<string, unknown> }>,
  ruleId: string,
  paragraphIndex: number,
  leaseId: string,
): boolean {
  return entries.some(
    (e) =>
      e.kind === 'hybrid-feedback' &&
      e.payload?.ruleId === ruleId &&
      e.payload?.paragraphIndex === paragraphIndex &&
      e.payload?.leaseId === leaseId &&
      e.payload?.signal === 'not-relevant',
  );
}

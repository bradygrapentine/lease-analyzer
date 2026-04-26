// Wave 27-C — design pass rewrite.
// Semantic attributes preserved verbatim (e2e critical — redline-flow.spec.ts):
//   aria-label="redline"                           (section, both branches)
//   aria-label="export redlined html"              (button)
//   data-para-index={i}                            (li)
//   aria-label={`edit paragraph ${i + 1}`}        (form and button)
//   aria-label={`paragraph ${i + 1} text`}        (textarea)
//   aria-label={`paragraph ${i + 1} edited badge`} (span)
//   aria-label={`revert paragraph ${i + 1}`}      (button)
//   aria-label={`accept paragraph ${i + 1}`}      (label in review mode)
//
import { useEffect, useRef, useState } from 'react';
import type { LeaseDocument } from '../parser/types';
import type { RedlineEdit } from '../redline/redline';
import { CounterSignPanel } from './CounterSignPanel';
import { Section } from './system/Section';
import { Button } from './system/Button';

/**
 * Wave 9 Part B — when the lease is being viewed inside a review-mode
 * session (a `.lgreview` archive opened by a reviewer), the panel grows
 * an Accept/Reject toggle next to each existing edit and a "Sign &
 * export patch" pane at the bottom. The hook surface lives in Part A
 * (`useReviewMode`); the panel just consumes a plain `reviewMode` prop
 * so it stays decoupled from that hook's evolving shape.
 */
export interface RedlinePanelReviewMode {
  archiveFingerprint: string;
  /** Stable id per edit, agreed between author and reviewer. */
  editIdByParagraphIndex: Record<number, string>;
  onSignAndExport: (input: {
    passphrase: string;
    decisions: { editId: string; accepted: boolean }[];
  }) => Promise<Uint8Array>;
}

interface RedlinePanelProps {
  doc: LeaseDocument | null;
  edits: RedlineEdit[];
  onEditParagraph: (paragraphIndex: number, after: string) => void;
  onDeleteEdit: (paragraphIndex: number) => void;
  /**
   * Caller is responsible for composing the HTML (via `buildRedlineHtml`)
   * and triggering a file download. Panel just exposes the trigger.
   */
  onExportHtml: () => void;
  /**
   * When set, the panel renders Accept/Reject toggles on each existing
   * edit and a counter-sign pane at the bottom. Omitted in normal
   * (author) mode.
   */
  reviewMode?: RedlinePanelReviewMode;
}

/**
 * Per-paragraph redline editor. Click "Edit" on any paragraph to reveal an
 * in-place textarea; "Save" fires `onEditParagraph` with the full new text.
 * Previously-edited paragraphs show an "(edited)" badge and offer "Revert".
 * Export button bubbles up so the coordinator can build + download HTML.
 */
export function RedlinePanel({
  doc,
  edits,
  onEditParagraph,
  onDeleteEdit,
  onExportHtml,
  reviewMode,
}: RedlinePanelProps): JSX.Element {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editingIndex !== null) {
      textareaRef.current?.focus();
    }
  }, [editingIndex]);

  if (!doc) {
    return (
      <Section label="redline" className="space-y-2 px-4 py-4">
        <h2 className="text-heading uppercase text-fg-muted">Redline</h2>
        <p className="text-body text-fg-faint">Upload a lease to start editing.</p>
      </Section>
    );
  }

  const editsByIndex = new Map<number, RedlineEdit>();
  for (const e of edits) editsByIndex.set(e.paragraphIndex, e);

  function startEditing(index: number, currentText: string): void {
    setEditingIndex(index);
    setDraft(currentText);
  }

  function cancelEditing(): void {
    setEditingIndex(null);
    setDraft('');
  }

  function saveEditing(): void {
    if (editingIndex === null) return;
    const trimmed = draft.trim();
    if (!trimmed) return;
    onEditParagraph(editingIndex, trimmed);
    setEditingIndex(null);
    setDraft('');
  }

  return (
    <Section label="redline" className="space-y-3 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-heading uppercase text-fg-muted">Redline</h2>
        <Button type="button" variant="subtle" size="sm" onClick={onExportHtml} aria-label="export redlined html">
          Export redlined HTML
        </Button>
      </div>

      <ol className="space-y-2">
        {doc.paragraphs.map((p, i) => {
          const edit = editsByIndex.get(i);
          const isEditing = editingIndex === i;
          const displayText = edit ? edit.after : p.text;
          return (
            <li key={i} data-para-index={i} className="rounded-sm border border-rule bg-paper-raised shadow-paper px-3 py-2 space-y-2">
              {isEditing ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveEditing();
                  }}
                  aria-label={`edit paragraph ${i + 1}`}
                  className="space-y-2"
                >
                  <label className="flex flex-col gap-1">
                    <span className="sr-only">
                      Paragraph {i + 1} text
                    </span>
                    <textarea
                      ref={textareaRef}
                      aria-label={`paragraph ${i + 1} text`}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={4}
                      className="border border-rule rounded-sm bg-paper-raised px-2 py-1 text-body text-fg font-sans w-full focus:outline focus:outline-2 focus:outline-ink"
                    />
                  </label>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm">Save</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={cancelEditing}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <p className={`text-body font-sans ${edit ? 'text-fg line-through decoration-severity-high/60' : 'text-fg-body'}`}>
                    {displayText}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {edit ? (
                      <span aria-label={`paragraph ${i + 1} edited badge`}
                        className="inline-flex items-center px-1.5 py-0.5 rounded-sm border border-severity-medium/30 bg-severity-medium/10 text-severity-medium text-small">
                        edited
                      </span>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`edit paragraph ${i + 1}`}
                      onClick={() => startEditing(i, displayText)}
                    >
                      Edit
                    </Button>
                    {edit ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`revert paragraph ${i + 1}`}
                        onClick={() => onDeleteEdit(i)}
                      >
                        Revert
                      </Button>
                    ) : null}
                    {reviewMode && edit ? (() => {
                      const editId = reviewMode.editIdByParagraphIndex[i];
                      if (!editId) return null;
                      const accepted = decisions[editId] ?? false;
                      return (
                        <label aria-label={`accept paragraph ${i + 1}`} className="inline-flex items-center gap-1.5 text-small text-fg-body cursor-pointer">
                          <input
                            type="checkbox"
                            checked={accepted}
                            onChange={(e) =>
                              setDecisions((prev) => ({
                                ...prev,
                                [editId]: e.target.checked,
                              }))
                            }
                          />
                          Accept
                        </label>
                      );
                    })() : null}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ol>

      {reviewMode ? (
        <CounterSignPanel
          decisions={Object.entries(reviewMode.editIdByParagraphIndex).map(
            ([, editId]) => ({
              editId,
              accepted: decisions[editId] ?? false,
            }),
          )}
          archiveFingerprint={reviewMode.archiveFingerprint}
          onSign={reviewMode.onSignAndExport}
        />
      ) : null}
    </Section>
  );
}

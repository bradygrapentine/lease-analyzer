import { useEffect, useRef, useState } from 'react';
import type { LeaseDocument } from '../parser/types';
import type { RedlineEdit } from '../redline/redline';
import { CounterSignPanel } from './CounterSignPanel';

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
      <section aria-label="redline">
        <h2>Redline</h2>
        <p>Upload a lease to start editing.</p>
      </section>
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
    <section aria-label="redline">
      <div className="redline-header">
        <h2>Redline</h2>
        <button type="button" onClick={onExportHtml} aria-label="export redlined html">
          Export redlined HTML
        </button>
      </div>

      <ol className="redline-paragraphs">
        {doc.paragraphs.map((p, i) => {
          const edit = editsByIndex.get(i);
          const isEditing = editingIndex === i;
          const displayText = edit ? edit.after : p.text;
          return (
            <li key={i} data-para-index={i}>
              {isEditing ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveEditing();
                  }}
                  aria-label={`edit paragraph ${i + 1}`}
                >
                  <label>
                    <span className="visually-hidden">
                      Paragraph {i + 1} text
                    </span>
                    <textarea
                      ref={textareaRef}
                      aria-label={`paragraph ${i + 1} text`}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={4}
                    />
                  </label>
                  <button type="submit">Save</button>
                  <button type="button" onClick={cancelEditing}>
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <p className={edit ? 'para para-edited' : 'para'}>
                    {displayText}
                  </p>
                  {edit ? (
                    <span aria-label={`paragraph ${i + 1} edited badge`}>
                      (edited)
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-label={`edit paragraph ${i + 1}`}
                    onClick={() => startEditing(i, displayText)}
                  >
                    Edit
                  </button>
                  {edit ? (
                    <button
                      type="button"
                      aria-label={`revert paragraph ${i + 1}`}
                      onClick={() => onDeleteEdit(i)}
                    >
                      Revert
                    </button>
                  ) : null}
                  {reviewMode && edit ? (() => {
                    const editId = reviewMode.editIdByParagraphIndex[i];
                    if (!editId) return null;
                    const accepted = decisions[editId] ?? false;
                    return (
                      <label aria-label={`accept paragraph ${i + 1}`}>
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
    </section>
  );
}

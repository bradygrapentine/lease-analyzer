import { useEffect, useRef, useState } from 'react';
import type { LeaseDocument } from '../parser/types';
import type { RedlineEdit } from '../redline/redline';

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
}: RedlinePanelProps): JSX.Element {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
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
                </>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

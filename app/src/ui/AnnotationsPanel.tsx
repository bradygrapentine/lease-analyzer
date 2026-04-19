import { useState } from 'react';
import type { Annotation } from '../annotations/annotations';

interface AnnotationsPanelProps {
  leaseId: string;
  paragraphIndex: number | null;
  annotations: Annotation[];
  onSave: (text: string) => void;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}

export function AnnotationsPanel({
  paragraphIndex,
  annotations,
  onSave,
  onUpdate,
  onDelete,
}: AnnotationsPanelProps): JSX.Element {
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  if (paragraphIndex === null) {
    return (
      <section aria-label="annotations">
        <h2>Notes</h2>
        <p>Click a finding to attach a note.</p>
      </section>
    );
  }

  const forParagraph = annotations.filter((a) => a.paragraphIndex === paragraphIndex);

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSave(t);
    setText('');
  }

  function onEditSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!editing) return;
    const t = editing.text.trim();
    if (!t) return;
    onUpdate(editing.id, t);
    setEditing(null);
  }

  return (
    <section aria-label="annotations">
      <h2>Notes</h2>
      {forParagraph.length === 0 ? (
        <p>No notes yet for this paragraph.</p>
      ) : (
        <ul>
          {forParagraph.map((a) => (
            <li key={a.id}>
              {editing?.id === a.id ? (
                <form onSubmit={onEditSubmit} aria-label="edit note">
                  <label>
                    <span className="visually-hidden">Edit note text</span>
                    <textarea
                      aria-label="edit note text"
                      value={editing.text}
                      onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                    />
                  </label>
                  <button type="submit">Save</button>
                  <button type="button" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <p>{a.text}</p>
                  <button
                    type="button"
                    aria-label="edit note"
                    onClick={() => setEditing({ id: a.id, text: a.text })}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    aria-label="delete note"
                    onClick={() => onDelete(a.id)}
                  >
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} aria-label="add note">
        <h3>Add note</h3>
        <label>
          Note
          <textarea
            aria-label="new note"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <button type="submit">Add note</button>
      </form>
    </section>
  );
}

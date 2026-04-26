import { useState } from 'react';
import type { Annotation } from '../annotations/annotations';
import { Section } from './system/Section';
import { Button } from './system/Button';
import { Field } from './system/Field';

// Aria/data inventory (preserved verbatim):
//   aria-label="annotations" (section)
//   aria-label="edit note" (form)
//   aria-label="edit note text" (textarea)
//   aria-label="edit note" (button)
//   aria-label="delete note" (button)
//   aria-label="add note" (form)
//   aria-label="new note" (textarea)
//   className="visually-hidden" (span) — handled by Field's label rendering

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
      <Section label="annotations">
        <h3 className="text-heading uppercase text-fg-muted mb-3">Notes</h3>
        <p className="text-body text-fg-muted">Click a finding to attach a note.</p>
      </Section>
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
    <Section label="annotations" className="space-y-3">
      <h3 className="text-heading uppercase text-fg-muted mb-3">Notes</h3>
      {forParagraph.length === 0 ? (
        <p className="text-body text-fg-muted">No notes yet for this paragraph.</p>
      ) : (
        <ul className="space-y-2">
          {forParagraph.map((a) => (
            <li key={a.id} className="bg-paper-sunken border border-rule rounded-sm p-3">
              {editing?.id === a.id ? (
                <form onSubmit={onEditSubmit} aria-label="edit note" className="space-y-2">
                  <label>
                    <span className="visually-hidden">Edit note text</span>
                    <textarea
                      aria-label="edit note text"
                      value={editing.text}
                      onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                      className="w-full border border-rule rounded-sm bg-paper-raised px-2 py-1 text-body text-fg focus:outline focus:outline-2 focus:outline-ink"
                    />
                  </label>
                  <div className="flex gap-2">
                    <Button type="submit" variant="subtle" size="sm">Save</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="text-body text-fg-body mb-2">{a.text}</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="edit note"
                      onClick={() => setEditing({ id: a.id, text: a.text })}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="delete note"
                      onClick={() => onDelete(a.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} aria-label="add note" className="space-y-2">
        <h4 className="text-heading uppercase text-fg-muted">Add note</h4>
        <Field
          as="textarea"
          label="Note"
          aria-label="new note"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" variant="subtle" size="sm">Add note</Button>
      </form>
    </Section>
  );
}

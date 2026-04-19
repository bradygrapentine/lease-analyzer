import { useState } from 'react';
import type { ClauseTemplate } from '../templates/types';

interface TemplatesPanelProps {
  templates: ClauseTemplate[];
  onSave: (input: { name: string; text: string }) => void;
  onUpdate: (id: string, patch: { name?: string; text?: string }) => void;
  onDelete: (id: string) => void;
}

export function TemplatesPanel({
  templates,
  onSave,
  onUpdate,
  onDelete,
}: TemplatesPanelProps): JSX.Element {
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string; text: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const n = name.trim();
    const t = text.trim();
    if (!n || !t) return;
    onSave({ name: n, text: t });
    setName('');
    setText('');
  }

  function onEditSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!editing) return;
    const n = editing.name.trim();
    const t = editing.text.trim();
    if (!n || !t) return;
    onUpdate(editing.id, { name: n, text: t });
    setEditing(null);
  }

  return (
    <section aria-label="clause templates">
      <h2>Clause templates</h2>
      {templates.length === 0 ? (
        <p>No clause templates saved yet.</p>
      ) : (
        <ul>
          {templates.map((t) => (
            <li key={t.id}>
              {editing?.id === t.id ? (
                <form onSubmit={onEditSubmit} aria-label={`edit ${t.name}`}>
                  <label>
                    <span className="visually-hidden">Template name</span>
                    <input
                      type="text"
                      aria-label="template name"
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    />
                  </label>
                  <label>
                    <span className="visually-hidden">Template text</span>
                    <textarea
                      aria-label="template text"
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
                  <strong>{t.name}</strong>
                  <p>{t.text}</p>
                  <button
                    type="button"
                    aria-label={`Edit ${t.name}`}
                    onClick={() => setEditing({ id: t.id, name: t.name, text: t.text })}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${t.name}`}
                    onClick={() => onDelete(t.id)}
                  >
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} aria-label="add clause template">
        <h3>Add template</h3>
        <label>
          Name
          <input
            type="text"
            aria-label="new template name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Clause text
          <textarea
            aria-label="new template text"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <button type="submit">Add template</button>
      </form>
    </section>
  );
}

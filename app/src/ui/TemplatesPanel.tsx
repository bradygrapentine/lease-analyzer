// Wave 27-C — design pass rewrite.
// Semantic attributes preserved verbatim:
//   aria-label="clause templates"        (section)
//   aria-label={`edit ${t.name}`}        (form)
//   aria-label="template name"           (input)
//   aria-label="template text"           (textarea)
//   aria-label={`Edit ${t.name}`}        (button)
//   aria-label={`Delete ${t.name}`}      (button)
//   aria-label="add clause template"     (form)
//   aria-label="new template name"       (input)
//   aria-label="new template text"       (textarea)
//
import { useState } from 'react';
import type { ClauseTemplate } from '../templates/types';
import { Section } from './system/Section';
import { Button } from './system/Button';
import { Field } from './system/Field';
import { EmptyState } from './system/EmptyState';

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
    <Section label="clause templates" className="space-y-4 px-4 py-4">
      <h2 className="text-heading uppercase text-fg-muted">Clause templates</h2>
      {templates.length === 0 ? (
        <EmptyState
          title="No clause templates saved yet."
          description="Add a template below to reuse standard clauses across leases."
        />
      ) : (
        <ul className="space-y-2">
          {templates.map((t) => (
            <li key={t.id} className="rounded-sm border border-rule bg-paper-raised shadow-paper p-3">
              {editing?.id === t.id ? (
                <form onSubmit={onEditSubmit} aria-label={`edit ${t.name}`} className="space-y-2">
                  <Field
                    as="input"
                    label="Template name"
                    type="text"
                    aria-label="template name"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                  <Field
                    as="textarea"
                    label="Template text"
                    aria-label="template text"
                    value={editing.text}
                    onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm">Save</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <strong className="text-body text-fg font-sans">{t.name}</strong>
                  <p className="text-body text-fg-body mt-1">{t.text}</p>
                  <div className="flex gap-2 mt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Edit ${t.name}`}
                      onClick={() => setEditing({ id: t.id, name: t.name, text: t.text })}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${t.name}`}
                      onClick={() => onDelete(t.id)}
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

      <form onSubmit={onSubmit} aria-label="add clause template" className="space-y-2 border-t border-rule pt-3">
        <h3 className="text-heading uppercase text-fg-muted">Add template</h3>
        <Field
          as="input"
          label="Name"
          type="text"
          aria-label="new template name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Field
          as="textarea"
          label="Clause text"
          aria-label="new template text"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" size="sm">Add template</Button>
      </form>
    </Section>
  );
}

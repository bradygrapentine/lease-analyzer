import { useEffect, useState } from 'react';
import type { CounterOffer } from '../negotiation/counterOffers';
import type { Finding } from '../rules/types';
import { Section } from './system/Section';
import { Button } from './system/Button';
import { Field } from './system/Field';

// Aria/data inventory (preserved verbatim):
//   aria-label="counter-offers" (section)
//   aria-label="add counter-offer" (form)
//   aria-label="new counter-offer name" (input)
//   aria-label="new counter-offer text" (textarea)
//   aria-label="Apply ${c.name}" (button)
//   aria-label="Delete ${c.name}" (button)

interface CounterOfferPanelProps {
  finding: Finding | null;
  counters: CounterOffer[];
  onSave: (ruleId: string, name: string, text: string) => void;
  onDelete: (id: string) => void;
  onApply?: (counter: CounterOffer) => void;
  /**
   * Optional `rule.suggestedEdit` for the currently-selected finding's rule.
   * When the user hasn't started typing AND no counter-offer is saved for
   * this rule yet, the textarea pre-fills with this as a starting point.
   * Pre-fill is NOT auto-saved.
   */
  suggestedEdit?: string;
}

export function CounterOfferPanel({
  finding,
  counters,
  onSave,
  onDelete,
  onApply,
  suggestedEdit,
}: CounterOfferPanelProps): JSX.Element {
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);

  // Seed the textarea with `suggestedEdit` once per (rule, no-saved-counter)
  // transition. We only auto-fill when the current text is empty — any user
  // typing wins, and we never clobber their draft on re-render.
  useEffect(() => {
    if (!finding || !suggestedEdit) return;
    const hasSaved = counters.some((c) => c.ruleId === finding.ruleId);
    if (hasSaved) return;
    if (prefilledFor === finding.ruleId) return;
    if (text !== '') return;
    setText(suggestedEdit);
    setPrefilledFor(finding.ruleId);
  }, [finding, suggestedEdit, counters, text, prefilledFor]);

  if (!finding) {
    return (
      <Section label="counter-offers">
        <h3 className="text-heading uppercase text-fg-muted mb-3">Counter-offers</h3>
        <p className="text-body text-fg-muted">Select a finding to see or add counter-offers.</p>
      </Section>
    );
  }

  const forRule = counters.filter((c) => c.ruleId === finding.ruleId);

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (!finding) return;
    const n = name.trim();
    const t = text.trim();
    if (!n || !t) return;
    onSave(finding.ruleId, n, t);
    setName('');
    setText('');
  }

  return (
    <Section label="counter-offers" className="space-y-3">
      <h3 className="text-heading uppercase text-fg-muted mb-3">Counter-offers</h3>
      <p className="text-small text-fg-muted">For rule: {finding.title}</p>
      {forRule.length === 0 ? (
        <p className="text-body text-fg-muted">No counter-offers saved for this rule.</p>
      ) : (
        <ul className="space-y-2">
          {forRule.map((c) => (
            <li key={c.id} className="bg-paper-sunken border border-rule rounded-sm p-3 space-y-2">
              <span className="text-body text-fg-body font-sans font-semibold">{c.name}</span>
              <p className="text-body text-fg-body">{c.text}</p>
              <div className="flex gap-2">
                {onApply ? (
                  <Button
                    type="button"
                    variant="subtle"
                    size="sm"
                    aria-label={`Apply ${c.name}`}
                    onClick={() => onApply(c)}
                  >
                    Apply
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete ${c.name}`}
                  onClick={() => onDelete(c.id)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} aria-label="add counter-offer" className="space-y-2">
        <h4 className="text-heading uppercase text-fg-muted">Add counter-offer</h4>
        <Field
          as="input"
          label="Name"
          type="text"
          aria-label="new counter-offer name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Field
          as="textarea"
          label="Suggested replacement"
          aria-label="new counter-offer text"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" variant="subtle" size="sm">Add counter-offer</Button>
      </form>
    </Section>
  );
}

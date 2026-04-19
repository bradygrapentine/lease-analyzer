import { useState } from 'react';
import type { CounterOffer } from '../negotiation/counterOffers';
import type { Finding } from '../rules/types';

interface CounterOfferPanelProps {
  finding: Finding | null;
  counters: CounterOffer[];
  onSave: (ruleId: string, name: string, text: string) => void;
  onDelete: (id: string) => void;
  onApply?: (counter: CounterOffer) => void;
}

export function CounterOfferPanel({
  finding,
  counters,
  onSave,
  onDelete,
  onApply,
}: CounterOfferPanelProps): JSX.Element {
  const [name, setName] = useState('');
  const [text, setText] = useState('');

  if (!finding) {
    return (
      <section aria-label="counter-offers">
        <h2>Counter-offers</h2>
        <p>Select a finding to see or add counter-offers.</p>
      </section>
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
    <section aria-label="counter-offers">
      <h2>Counter-offers</h2>
      <p>For rule: {finding.title}</p>
      {forRule.length === 0 ? (
        <p>No counter-offers saved for this rule.</p>
      ) : (
        <ul>
          {forRule.map((c) => (
            <li key={c.id}>
              <strong>{c.name}</strong>
              <p>{c.text}</p>
              {onApply ? (
                <button
                  type="button"
                  aria-label={`Apply ${c.name}`}
                  onClick={() => onApply(c)}
                >
                  Apply
                </button>
              ) : null}
              <button
                type="button"
                aria-label={`Delete ${c.name}`}
                onClick={() => onDelete(c.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} aria-label="add counter-offer">
        <h3>Add counter-offer</h3>
        <label>
          Name
          <input
            type="text"
            aria-label="new counter-offer name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Suggested replacement
          <textarea
            aria-label="new counter-offer text"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <button type="submit">Add counter-offer</button>
      </form>
    </section>
  );
}

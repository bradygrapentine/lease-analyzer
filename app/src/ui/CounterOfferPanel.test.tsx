import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CounterOfferPanel } from './CounterOfferPanel';
import type { CounterOffer } from '../negotiation/counterOffers';
import type { Finding } from '../rules/types';

function finding(over: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'r-auto-renew',
    severity: 'high',
    category: 'termination',
    title: 'Auto-renewal clause',
    explanation: 'This lease auto-renews.',
    citation: null,
    page: 1,
    paragraphIndex: 3,
    snippet: 'This lease shall automatically renew…',
    span: { start: 0, end: 10 },
    confidence: 0.9,
    negated: false,
    rulePackVersion: 'v1',
    ...over,
  };
}

function co(over: Partial<CounterOffer>): CounterOffer {
  return {
    id: 'c1',
    ruleId: 'r-auto-renew',
    name: 'Strike auto-renewal',
    text: 'Section 4 is deleted.',
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

const noop = (): void => {};

describe('CounterOfferPanel', () => {
  it('prompts the user to pick a finding when none is selected', () => {
    render(<CounterOfferPanel finding={null} counters={[]} onSave={noop} onDelete={noop} />);
    expect(screen.getByText(/select a finding/i)).toBeInTheDocument();
  });

  it('shows "no counter-offers" when a finding is selected but none exist for that rule', () => {
    render(
      <CounterOfferPanel
        finding={finding()}
        counters={[co({ ruleId: 'other-rule' })]}
        onSave={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText(/no counter-offers/i)).toBeInTheDocument();
  });

  it('renders only counters whose ruleId matches the finding', () => {
    render(
      <CounterOfferPanel
        finding={finding()}
        counters={[
          co({ id: 'keep', ruleId: 'r-auto-renew', name: 'Keep me' }),
          co({ id: 'drop', ruleId: 'other-rule', name: 'Hide me' }),
        ]}
        onSave={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText('Keep me')).toBeInTheDocument();
    expect(screen.queryByText('Hide me')).not.toBeInTheDocument();
  });

  it('calls onSave with (ruleId, trimmed name, trimmed text) from the add form', async () => {
    const onSave = vi.fn();
    render(
      <CounterOfferPanel finding={finding()} counters={[]} onSave={onSave} onDelete={noop} />,
    );
    await userEvent.type(screen.getByLabelText(/new counter-offer name/i), '  Strike it  ');
    await userEvent.type(screen.getByLabelText(/new counter-offer text/i), '  Section 4 deleted.  ');
    await userEvent.click(screen.getByRole('button', { name: /add counter-offer/i }));
    expect(onSave).toHaveBeenCalledWith('r-auto-renew', 'Strike it', 'Section 4 deleted.');
  });

  it('does not call onSave when name or text are blank', async () => {
    const onSave = vi.fn();
    render(
      <CounterOfferPanel finding={finding()} counters={[]} onSave={onSave} onDelete={noop} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /add counter-offer/i }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not render the add form when finding is null', () => {
    render(<CounterOfferPanel finding={null} counters={[]} onSave={noop} onDelete={noop} />);
    expect(screen.queryByLabelText(/new counter-offer name/i)).not.toBeInTheDocument();
  });

  it('fires onDelete with the counter id', async () => {
    const onDelete = vi.fn();
    render(
      <CounterOfferPanel
        finding={finding()}
        counters={[co({ id: 'gone', name: 'Gone' })]}
        onSave={noop}
        onDelete={onDelete}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /delete gone/i }));
    expect(onDelete).toHaveBeenCalledWith('gone');
  });

  it('renders an Apply button when onApply is provided, and wires it to the counter', async () => {
    const onApply = vi.fn();
    const counter = co({ id: 'a', name: 'A' });
    render(
      <CounterOfferPanel
        finding={finding()}
        counters={[counter]}
        onSave={noop}
        onDelete={noop}
        onApply={onApply}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /apply a/i }));
    expect(onApply).toHaveBeenCalledWith(counter);
  });

  it('does NOT render Apply buttons when onApply is omitted', () => {
    render(
      <CounterOfferPanel
        finding={finding()}
        counters={[co({ id: 'a', name: 'A' })]}
        onSave={noop}
        onDelete={noop}
      />,
    );
    expect(screen.queryByRole('button', { name: /apply/i })).not.toBeInTheDocument();
  });
});

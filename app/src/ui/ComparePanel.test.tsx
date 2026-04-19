import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComparePanel } from './ComparePanel';
import type { Finding } from '../rules/types';

function f(over: Partial<Finding>): Finding {
  return {
    ruleId: 'x',
    severity: 'medium',
    category: 'general',
    title: 'X',
    explanation: 'e',
    citation: null,
    page: 1,
    paragraphIndex: 0,
    snippet: 's',
    span: { start: 0, end: 1 },
    confidence: 0.9,
    negated: false,
    rulePackVersion: '1.0.0',
    ...over,
  };
}

describe('ComparePanel', () => {
  it('lists added, removed, and changed findings', () => {
    const a = [f({ ruleId: 'late-fees', title: 'Late fees', severity: 'low' })];
    const b = [
      f({ ruleId: 'late-fees', title: 'Late fees', severity: 'high' }),
      f({ ruleId: 'arbitration', title: 'Arbitration', severity: 'high' }),
    ];
    render(<ComparePanel aName="Old.pdf" bName="New.pdf" aFindings={a} bFindings={b} />);
    expect(screen.getByText('Old.pdf')).toBeInTheDocument();
    expect(screen.getByText('New.pdf')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /added/i })).toBeInTheDocument();
    expect(screen.getByText(/arbitration/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /changed/i })).toBeInTheDocument();
    expect(screen.getByText(/late fees/i)).toBeInTheDocument();
  });

  it('shows a "no changes" message when both sides are identical', () => {
    const findings = [f({ ruleId: 'same' })];
    render(
      <ComparePanel aName="A" bName="B" aFindings={findings} bFindings={findings} />,
    );
    expect(screen.getByText(/no differences/i)).toBeInTheDocument();
  });

  it('renders only the Removed section when rules disappeared', () => {
    render(
      <ComparePanel
        aName="Old"
        bName="New"
        aFindings={[f({ ruleId: 'gone', title: 'Old clause' })]}
        bFindings={[]}
      />,
    );
    expect(screen.getByRole('heading', { name: /removed/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /added/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /changed/i })).not.toBeInTheDocument();
  });

  it('does not render the pack-version warning when the prop is absent', () => {
    render(
      <ComparePanel
        aName="A"
        bName="B"
        aFindings={[f({ ruleId: 's' })]}
        bFindings={[f({ ruleId: 's' })]}
      />,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders a dismissable warning when packVersionMismatch is supplied', async () => {
    render(
      <ComparePanel
        aName="A"
        bName="B"
        aFindings={[f({ ruleId: 's' })]}
        bFindings={[f({ ruleId: 's' })]}
        packVersionMismatch={{ a: '1.0.0', b: '2.0.0' }}
      />,
    );
    const alert = screen.getByRole('alert', { name: /pack version mismatch/i });
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/different rule-pack versions/i);
    expect(alert).toHaveTextContent(/v1\.0\.0/);
    expect(alert).toHaveTextContent(/v2\.0\.0/);

    const dismiss = screen.getByRole('button', {
      name: /dismiss pack version mismatch warning/i,
    });
    await userEvent.click(dismiss);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('surfaces a negation flip in the Changed section', () => {
    render(
      <ComparePanel
        aName="Old"
        bName="New"
        aFindings={[f({ ruleId: 'n', title: 'Arb', negated: true })]}
        bFindings={[f({ ruleId: 'n', title: 'Arb', negated: false })]}
      />,
    );
    expect(screen.getByRole('heading', { name: /changed/i })).toBeInTheDocument();
    expect(screen.getByText(/negated yes→no/i)).toBeInTheDocument();
  });
});

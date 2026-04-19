import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});

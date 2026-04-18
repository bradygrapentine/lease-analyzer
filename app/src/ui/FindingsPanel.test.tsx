import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FindingsPanel } from './FindingsPanel';
import type { Finding } from '../rules/types';

function f(over: Partial<Finding>): Finding {
  return {
    ruleId: 'rule',
    severity: 'medium',
    category: 'general',
    title: 'Generic title',
    explanation: 'Generic explanation.',
    citation: null,
    page: 1,
    paragraphIndex: 0,
    snippet: 'snippet',
    span: { start: 0, end: 7 },
    confidence: 0.9,
    negated: false,
    rulePackVersion: '1.0.0',
    ...over,
  };
}

describe('FindingsPanel', () => {
  it('groups findings under High / Medium / Low headings', () => {
    const findings = [
      f({ ruleId: 'a', severity: 'high', title: 'Arbitration' }),
      f({ ruleId: 'b', severity: 'medium', title: 'Late fee' }),
      f({ ruleId: 'c', severity: 'low', title: 'Pet policy' }),
    ];
    render(<FindingsPanel findings={findings} onSelect={() => {}} />);
    expect(screen.getByRole('heading', { name: /high/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /medium/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /low/i })).toBeInTheDocument();
    expect(screen.getByText('Arbitration')).toBeInTheDocument();
  });

  it('renders an empty state when no findings', () => {
    render(<FindingsPanel findings={[]} onSelect={() => {}} />);
    expect(screen.getByText(/no findings/i)).toBeInTheDocument();
  });

  it('calls onSelect with the finding when a row is clicked', async () => {
    const onSelect = vi.fn();
    const finding = f({ ruleId: 'picked', title: 'Picked one' });
    render(<FindingsPanel findings={[finding]} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /picked one/i }));
    expect(onSelect).toHaveBeenCalledWith(finding);
  });

  it('shows a "negated" badge on negated findings', () => {
    render(
      <FindingsPanel
        findings={[f({ ruleId: 'n', title: 'Maybe', negated: true })]}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(/not applicable/i)).toBeInTheDocument();
  });
});

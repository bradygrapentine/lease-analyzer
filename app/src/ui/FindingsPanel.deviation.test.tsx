import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FindingsPanel } from './FindingsPanel';
import type { Finding } from '../rules/types';

// Wave 8 Part B — additive tests for the "deviates from verified pack"
// badge. Lives in a separate file so the existing FindingsPanel.test.tsx
// is left untouched. The implementer extends the Finding type with an
// optional `deviation?: { fromFingerprint: string }` and wires the badge
// in FindingsPanel.tsx.

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

describe('FindingsPanel — deviation badge (Wave 8 Part B)', () => {
  it('renders a "deviates from verified baseline" badge when finding.deviation is set', () => {
    const finding = f({
      ruleId: 'edited',
      title: 'Edited rule',
      // The implementer must extend `Finding` with this optional field.
      deviation: { fromFingerprint: 'a'.repeat(64) },
    } as Partial<Finding>);
    render(<FindingsPanel findings={[finding]} onSelect={() => {}} />);
    const badge = screen.getByLabelText(/deviates from verified baseline/i);
    expect(badge).toBeInTheDocument();
  });

  it('does NOT render a deviation badge when finding.deviation is absent', () => {
    const finding = f({ ruleId: 'clean', title: 'Clean rule' });
    render(<FindingsPanel findings={[finding]} onSelect={() => {}} />);
    expect(
      screen.queryByLabelText(/deviates from verified baseline/i),
    ).not.toBeInTheDocument();
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FindingsPanel } from './FindingsPanel';
import type { Finding } from '../rules/types';

// Wave 28-D — hybrid finding badge polish:
//   - aria-pressed reflects toggled state
//   - focus-visible:focus-ring class present (for the design-system
//     focus halo).

function f(over: Partial<Finding>): Finding {
  return {
    ruleId: 'rule',
    severity: 'medium',
    category: 'general',
    title: 'Some finding',
    explanation: 'explanation',
    citation: null,
    page: 1,
    paragraphIndex: 0,
    snippet: 'snippet',
    span: { start: 0, end: 7 },
    confidence: 0.9,
    negated: false,
    rulePackVersion: '1.0.0',
    evidence: { modelId: 'classifier-x', similarity: 0.82 },
    ...over,
  };
}

describe('FindingsPanel — hybrid badge (Wave 28-D)', () => {
  it('renders the hybrid badge with aria-pressed=false initially', () => {
    render(<FindingsPanel findings={[f({})]} onSelect={() => {}} />);
    const badge = screen.getByRole('button', {
      name: /identified by on-device similarity match/i,
    });
    expect(badge).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles aria-pressed=true after click', async () => {
    render(<FindingsPanel findings={[f({})]} onSelect={() => {}} />);
    const badge = screen.getByRole('button', {
      name: /identified by on-device similarity match/i,
    });
    await userEvent.click(badge);
    expect(badge).toHaveAttribute('aria-pressed', 'true');
  });

  it('applies the focus-ring utility for keyboard focus', () => {
    render(<FindingsPanel findings={[f({})]} onSelect={() => {}} />);
    const badge = screen.getByRole('button', {
      name: /identified by on-device similarity match/i,
    });
    expect(badge.className).toMatch(/focus-visible:focus-ring/);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FindingsPanel } from './FindingsPanel';
import type { Finding } from '../rules/types';

// Wave 10 Part C — FindingsPanel gains an optional onPromoteToStandard
// callback. When provided, a "Promote to standard" button renders next to
// each finding's paragraph; when omitted, behavior is identical to today.

function f(over: Partial<Finding>): Finding {
  return {
    ruleId: 'rule',
    severity: 'medium',
    category: 'general',
    title: 'Generic title',
    explanation: 'Generic explanation.',
    citation: null,
    page: 1,
    paragraphIndex: 3,
    snippet: 'snippet',
    span: { start: 0, end: 7 },
    confidence: 0.9,
    negated: false,
    rulePackVersion: '1.0.0',
    ...over,
  };
}

// Cast to bypass TS until the optional prop is added in the impl branch.
// This is intentional — Vitest runs the JS, TS errors don't fail the suite.
type ExtendedProps = React.ComponentProps<typeof FindingsPanel> & {
  onPromoteToStandard?: (leaseId: string, paragraphIndex: number) => void;
  leaseId?: string;
};
const Panel = FindingsPanel as unknown as (
  props: ExtendedProps,
) => JSX.Element;

describe('FindingsPanel + onPromoteToStandard', () => {
  it('does NOT render a promote button when onPromoteToStandard is undefined', () => {
    render(
      <Panel
        findings={[f({ ruleId: 'r1', title: 'Auto-renewal' })]}
        onSelect={() => {}}
      />,
    );
    expect(
      screen.queryByRole('button', { name: /promote.*standard/i }),
    ).toBeNull();
  });

  it('renders a "Promote to standard" button on each finding when callback is provided', () => {
    const onPromote = vi.fn();
    render(
      <Panel
        findings={[f({ ruleId: 'r1', title: 'Auto-renewal' })]}
        onSelect={() => {}}
        onPromoteToStandard={onPromote}
        leaseId="L1"
      />,
    );
    expect(
      screen.getByRole('button', { name: /promote.*standard/i }),
    ).toBeInTheDocument();
  });

  it('invokes onPromoteToStandard(leaseId, paragraphIndex) on click', async () => {
    const onPromote = vi.fn();
    render(
      <Panel
        findings={[
          f({ ruleId: 'r1', title: 'Auto-renewal', paragraphIndex: 7 }),
        ]}
        onSelect={() => {}}
        onPromoteToStandard={onPromote}
        leaseId="L1"
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: /promote.*standard/i }),
    );
    expect(onPromote).toHaveBeenCalledWith('L1', 7);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SeverityOverridesPanel } from './SeverityOverridesPanel';

// Wave 10 Part D — SeverityOverridesPanel gains an "Apply across portfolio"
// toggle next to each row. The new props are additive; existing call sites
// (no portfolioOverrides prop) keep working unchanged.

const RULES = [
  { id: 'r1', title: 'Auto-renewal clause', severity: 'warn' as const },
  { id: 'r2', title: 'Holdover penalty', severity: 'error' as const },
];

type ExtendedProps = React.ComponentProps<typeof SeverityOverridesPanel> & {
  portfolioOverrides?: Record<string, 'info' | 'warn' | 'error'>;
  onScopeChange?: (
    ruleId: string,
    scope: 'lease' | 'portfolio',
  ) => void;
};
const Panel = SeverityOverridesPanel as unknown as (
  p: ExtendedProps,
) => JSX.Element;

describe('SeverityOverridesPanel + portfolio toggle', () => {
  it('renders an "Apply across portfolio" toggle per rule when portfolio props are provided', () => {
    render(
      <Panel
        rules={RULES}
        overrides={{ r1: 'error' }}
        portfolioOverrides={{}}
        onChange={() => {}}
        onScopeChange={() => {}}
      />,
    );
    expect(
      screen.getByRole('checkbox', {
        name: /apply across portfolio for r1/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', {
        name: /apply across portfolio for r2/i,
      }),
    ).toBeInTheDocument();
  });

  it('reflects the portfolio-scope state per rule (checked when portfolioOverrides has the rule)', () => {
    render(
      <Panel
        rules={RULES}
        overrides={{}}
        portfolioOverrides={{ r1: 'warn' }}
        onChange={() => {}}
        onScopeChange={() => {}}
      />,
    );
    const r1 = screen.getByRole('checkbox', {
      name: /apply across portfolio for r1/i,
    }) as HTMLInputElement;
    const r2 = screen.getByRole('checkbox', {
      name: /apply across portfolio for r2/i,
    }) as HTMLInputElement;
    expect(r1.checked).toBe(true);
    expect(r2.checked).toBe(false);
  });

  it('fires onScopeChange(ruleId, "portfolio") when the toggle is checked', async () => {
    const onScopeChange = vi.fn();
    render(
      <Panel
        rules={RULES}
        overrides={{ r1: 'warn' }}
        portfolioOverrides={{}}
        onChange={() => {}}
        onScopeChange={onScopeChange}
      />,
    );
    await userEvent.click(
      screen.getByRole('checkbox', {
        name: /apply across portfolio for r1/i,
      }),
    );
    expect(onScopeChange).toHaveBeenCalledWith('r1', 'portfolio');
  });

  it('fires onScopeChange(ruleId, "lease") when an already-portfolio toggle is unchecked', async () => {
    const onScopeChange = vi.fn();
    render(
      <Panel
        rules={RULES}
        overrides={{}}
        portfolioOverrides={{ r1: 'warn' }}
        onChange={() => {}}
        onScopeChange={onScopeChange}
      />,
    );
    await userEvent.click(
      screen.getByRole('checkbox', {
        name: /apply across portfolio for r1/i,
      }),
    );
    expect(onScopeChange).toHaveBeenCalledWith('r1', 'lease');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SeverityOverridesPanel } from './SeverityOverridesPanel';

const RULES = [
  { id: 'r1', title: 'Auto-renewal clause', severity: 'warn' as const },
  { id: 'r2', title: 'Holdover penalty', severity: 'error' as const },
  { id: 'r3', title: 'Notice to enter', severity: 'info' as const },
];

describe('SeverityOverridesPanel', () => {
  it('renders an empty state when no rules are present', () => {
    render(
      <SeverityOverridesPanel rules={[]} overrides={{}} onChange={() => {}} />,
    );
    expect(
      screen.getByText(/no rules available to override/i),
    ).toBeInTheDocument();
  });

  it('renders a row per rule with built-in severity visible', () => {
    render(
      <SeverityOverridesPanel rules={RULES} overrides={{}} onChange={() => {}} />,
    );
    // Rule titles appear both in the row header and the hidden select label,
    // so assert on presence rather than singleton matches.
    expect(screen.getAllByText(/Auto-renewal clause/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Holdover penalty/).length).toBeGreaterThan(0);
    // Built-in severity column must render label, not the raw token.
    expect(screen.getAllByText(/^Warn$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Error$/).length).toBeGreaterThan(0);
  });

  it('shows the current override value in the select when present', () => {
    render(
      <SeverityOverridesPanel
        rules={RULES}
        overrides={{ r1: 'error' }}
        onChange={() => {}}
      />,
    );
    const select = screen.getByRole('combobox', {
      name: /override severity for r1/i,
    }) as HTMLSelectElement;
    expect(select.value).toBe('error');
  });

  it('fires onChange(ruleId, severity) when the user picks an override', async () => {
    const onChange = vi.fn();
    render(
      <SeverityOverridesPanel rules={RULES} overrides={{}} onChange={onChange} />,
    );
    const select = screen.getByRole('combobox', {
      name: /override severity for r1/i,
    });
    await userEvent.selectOptions(select, 'error');
    expect(onChange).toHaveBeenCalledWith('r1', 'error');
  });

  it('fires onChange(ruleId, null) when the user picks the "use built-in" option', async () => {
    const onChange = vi.fn();
    render(
      <SeverityOverridesPanel
        rules={RULES}
        overrides={{ r1: 'warn' }}
        onChange={onChange}
      />,
    );
    const select = screen.getByRole('combobox', {
      name: /override severity for r1/i,
    });
    await userEvent.selectOptions(select, '__clear__');
    expect(onChange).toHaveBeenCalledWith('r1', null);
  });

  it('fires onChange(ruleId, null) when the Clear button is pressed', async () => {
    const onChange = vi.fn();
    render(
      <SeverityOverridesPanel
        rules={RULES}
        overrides={{ r2: 'info' }}
        onChange={onChange}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: /clear override for r2/i }),
    );
    expect(onChange).toHaveBeenCalledWith('r2', null);
  });

  it('disables the Clear button when no override is set on that rule', () => {
    render(
      <SeverityOverridesPanel
        rules={RULES}
        overrides={{ r1: 'warn' }}
        onChange={() => {}}
      />,
    );
    // r1 has an override -> clear button enabled
    expect(
      screen.getByRole('button', { name: /clear override for r1/i }),
    ).not.toBeDisabled();
    // r2 has no override -> clear button disabled
    expect(
      screen.getByRole('button', { name: /clear override for r2/i }),
    ).toBeDisabled();
  });

  it('renders without crashing when overrides reference unknown ids', () => {
    // Stale entries from uninstalled packs should not blow up the panel.
    render(
      <SeverityOverridesPanel
        rules={RULES}
        overrides={{ 'orphan-id': 'error' }}
        onChange={() => {}}
      />,
    );
    expect(screen.getAllByText(/Auto-renewal clause/).length).toBeGreaterThan(0);
  });
});

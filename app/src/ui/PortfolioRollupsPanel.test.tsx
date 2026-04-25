import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PortfolioRollupsPanel } from './PortfolioRollupsPanel';
import type { RuleRollup } from '../portfolio/ruleRollups';

const ROLLUPS: RuleRollup[] = [
  {
    ruleId: 'auto-renewal',
    leaseCount: 3,
    severityCounts: { high: 1, medium: 2, low: 0, info: 0 },
    leaseIds: ['L1', 'L2', 'L3'],
  },
  {
    ruleId: 'holdover',
    leaseCount: 2,
    severityCounts: { high: 0, medium: 0, low: 2, info: 0 },
    leaseIds: ['L1', 'L2'],
  },
  {
    ruleId: 'notice',
    leaseCount: 1,
    severityCounts: { high: 0, medium: 0, low: 0, info: 1 },
    leaseIds: ['L3'],
  },
];

describe('PortfolioRollupsPanel', () => {
  it('renders an empty state when there are no rollups', () => {
    render(<PortfolioRollupsPanel rollups={[]} onDrillThrough={() => {}} />);
    expect(screen.getByText(/no portfolio findings/i)).toBeInTheDocument();
  });

  it('renders one row per rule with rule id and lease count', () => {
    render(
      <PortfolioRollupsPanel rollups={ROLLUPS} onDrillThrough={() => {}} />,
    );
    expect(screen.getByText('auto-renewal')).toBeInTheDocument();
    expect(screen.getByText('holdover')).toBeInTheDocument();
    expect(screen.getByText('notice')).toBeInTheDocument();
  });

  it('preserves the input ordering (caller-sorted by aggregateFindings)', () => {
    render(
      <PortfolioRollupsPanel rollups={ROLLUPS} onDrillThrough={() => {}} />,
    );
    const rows = screen.getAllByRole('row');
    // first row is the table header; data rows follow
    const dataRowText = rows.slice(1).map((r) => r.textContent ?? '');
    const idxAuto = dataRowText.findIndex((t) => t.includes('auto-renewal'));
    const idxHold = dataRowText.findIndex((t) => t.includes('holdover'));
    const idxNotice = dataRowText.findIndex((t) => t.includes('notice'));
    expect(idxAuto).toBeLessThan(idxHold);
    expect(idxHold).toBeLessThan(idxNotice);
  });

  it('fires onDrillThrough(leaseIds) when the user clicks a rollup row', async () => {
    const onDrillThrough = vi.fn();
    render(
      <PortfolioRollupsPanel
        rollups={ROLLUPS}
        onDrillThrough={onDrillThrough}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: /drill into auto-renewal/i }),
    );
    expect(onDrillThrough).toHaveBeenCalledWith(['L1', 'L2', 'L3']);
  });

  it('renders the lease-count for each rollup', () => {
    render(
      <PortfolioRollupsPanel rollups={ROLLUPS} onDrillThrough={() => {}} />,
    );
    // 3 leases for auto-renewal; rendered somewhere in that row
    const autoRow = screen
      .getByText('auto-renewal')
      .closest('tr');
    expect(autoRow?.textContent).toMatch(/3/);
  });
});

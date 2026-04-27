import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HybridPrecisionPanel } from './HybridPrecisionPanel';
import type { HybridRuleStats } from '../audit/hybridStats';

const populated: HybridRuleStats[] = [
  { ruleId: 'auto-renewal', fires: 12, notRelevant: 2, precision: 1 - 2 / 12 },
  { ruleId: 'late-fee-cap', fires: 9, notRelevant: 6, precision: 1 - 6 / 9 },
  { ruleId: 'security-deposit', fires: 4, notRelevant: 0, precision: 1 },
  { ruleId: 'orphan', fires: 0, notRelevant: 1, precision: null },
];

// Stats where no row meets demotion thresholds (all fires < 10 or precision >= 0.70)
const noCandidates: HybridRuleStats[] = [
  { ruleId: 'auto-renewal', fires: 12, notRelevant: 2, precision: 1 - 2 / 12 }, // 83% precision — good
  { ruleId: 'late-fee-cap', fires: 9, notRelevant: 6, precision: 1 - 6 / 9 },   // only 9 fires — below floor
];

// Stats where one row is a demotion candidate (fires >= 10 AND precision < 0.70)
const withCandidate: HybridRuleStats[] = [
  { ruleId: 'auto-renewal', fires: 12, notRelevant: 2, precision: 1 - 2 / 12 }, // 83% precision — good
  { ruleId: 'rule.indemnity', fires: 14, notRelevant: 5, precision: 0.643 },     // candidate
];

describe('HybridPrecisionPanel', () => {
  it('renders an empty state when stats is empty', () => {
    render(<HybridPrecisionPanel stats={[]} />);
    expect(
      screen.getByText(/no hybrid feedback yet/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('table', { name: /hybrid precision/i }),
    ).not.toBeInTheDocument();
  });

  it('renders one row per rule with fires, not-relevant, and rounded precision', () => {
    render(<HybridPrecisionPanel stats={populated} />);
    const table = screen.getByRole('table', { name: /hybrid precision/i });
    const row = within(table).getByTestId('hybrid-precision-row-late-fee-cap');
    // 1 - 6/9 = 0.333… → 33%
    expect(within(row).getByText('33%')).toBeInTheDocument();
    expect(within(row).getByText('9')).toBeInTheDocument();
    expect(within(row).getByText('6')).toBeInTheDocument();

    // 2/3-style row (auto-renewal): 1 - 2/12 = 83%
    const autoRow = within(table).getByTestId(
      'hybrid-precision-row-auto-renewal',
    );
    expect(within(autoRow).getByText('83%')).toBeInTheDocument();

    // fires=0 → "—"
    const orphan = within(table).getByTestId('hybrid-precision-row-orphan');
    expect(within(orphan).getByText('—')).toBeInTheDocument();
  });

  it('defaults to precision-asc (worst-first) ordering with null sinking last', () => {
    render(<HybridPrecisionPanel stats={populated} />);
    const rows = screen
      .getAllByTestId(/^hybrid-precision-row-/)
      .map((el) => el.getAttribute('data-testid'));
    expect(rows).toEqual([
      'hybrid-precision-row-late-fee-cap', // 33%
      'hybrid-precision-row-auto-renewal', // 83%
      'hybrid-precision-row-security-deposit', // 100%
      'hybrid-precision-row-orphan', // null → last
    ]);
  });

  it('renders the empty-state copy when no rules meet demotion thresholds', () => {
    render(<HybridPrecisionPanel stats={noCandidates} />);
    expect(screen.getByText(/No rules currently meet demotion thresholds/i)).toBeInTheDocument();
    expect(screen.getByText(/≥10 fires AND <70% precision/)).toBeInTheDocument();
  });

  it('lists demotion candidates with rule id, fires, and precision', () => {
    render(<HybridPrecisionPanel stats={withCandidate} />);
    expect(screen.getByText(/Demotion candidates \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/rule\.indemnity — 14 fires, 64\.3%/)).toBeInTheDocument();
    expect(screen.getByText(/remove `hybridAnchors`/)).toBeInTheDocument();
  });

  it('switches to fires-desc ordering on user request', async () => {
    const user = userEvent.setup();
    render(<HybridPrecisionPanel stats={populated} />);
    await user.selectOptions(
      screen.getByLabelText(/sort hybrid precision rows/i),
      'fires-desc',
    );
    const rows = screen
      .getAllByTestId(/^hybrid-precision-row-/)
      .map((el) => el.getAttribute('data-testid'));
    expect(rows[0]).toBe('hybrid-precision-row-auto-renewal'); // 12 fires
    expect(rows[1]).toBe('hybrid-precision-row-late-fee-cap'); // 9
    expect(rows[2]).toBe('hybrid-precision-row-security-deposit'); // 4
    expect(rows[3]).toBe('hybrid-precision-row-orphan'); // 0
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PortfolioPanel } from './PortfolioPanel';
import type { LeaseMetadata } from '../storage/storage';
import type { Finding } from '../rules/types';

function meta(over: Partial<LeaseMetadata>): LeaseMetadata {
  return {
    id: 'id',
    name: 'Lease.pdf',
    createdAt: Date.parse('2026-04-18T12:00:00Z'),
    updatedAt: Date.parse('2026-04-18T12:00:00Z'),
    rulePackVersion: '1.0.0',
    pageCount: 5,
    findingCount: 1,
    ...over,
  };
}

function f(over: Partial<Finding>): Finding {
  return {
    ruleId: 'r',
    severity: 'medium',
    category: 'general',
    title: 'R',
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

describe('PortfolioPanel', () => {
  it('renders an empty state when no leases supplied', () => {
    render(
      <PortfolioPanel leases={[]} findingsByLease={new Map()} onOpenLease={() => {}} />,
    );
    expect(screen.getByText(/no leases in portfolio/i)).toBeInTheDocument();
  });

  it('renders a row per lease and a column per unique rule id', () => {
    const leases = [
      meta({ id: 'a', name: 'A.pdf' }),
      meta({ id: 'b', name: 'B.pdf' }),
    ];
    const findingsByLease = new Map<string, Finding[]>([
      ['a', [f({ ruleId: 'late-fees', severity: 'high' })]],
      ['b', [f({ ruleId: 'arbitration', severity: 'low' })]],
    ]);
    render(
      <PortfolioPanel
        leases={leases}
        findingsByLease={findingsByLease}
        onOpenLease={() => {}}
      />,
    );
    const table = screen.getByRole('table', { name: /portfolio/i });
    expect(within(table).getAllByRole('row').length).toBe(3); // header + 2 leases
    expect(within(table).getByText(/A\.pdf/)).toBeInTheDocument();
    expect(within(table).getByText(/B\.pdf/)).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'late-fees' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'arbitration' })).toBeInTheDocument();
  });

  it('orders rule columns by frequency across leases (most common first)', () => {
    const leases = [
      meta({ id: 'a', name: 'A.pdf' }),
      meta({ id: 'b', name: 'B.pdf' }),
      meta({ id: 'c', name: 'C.pdf' }),
    ];
    const findingsByLease = new Map<string, Finding[]>([
      ['a', [f({ ruleId: 'popular' }), f({ ruleId: 'rare' })]],
      ['b', [f({ ruleId: 'popular' })]],
      ['c', [f({ ruleId: 'popular' })]],
    ]);
    render(
      <PortfolioPanel
        leases={leases}
        findingsByLease={findingsByLease}
        onOpenLease={() => {}}
      />,
    );
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    // First column is the lease header; rule columns start at index 1.
    const ruleCols = headers.slice(1);
    expect(ruleCols[0]).toBe('popular');
    expect(ruleCols[1]).toBe('rare');
  });

  it('shows severity badges in hit cells and em-dash in missing cells', () => {
    const leases = [
      meta({ id: 'a', name: 'A.pdf' }),
      meta({ id: 'b', name: 'B.pdf' }),
    ];
    const findingsByLease = new Map<string, Finding[]>([
      ['a', [f({ ruleId: 'shared', severity: 'high' })]],
      ['b', []],
    ]);
    render(
      <PortfolioPanel
        leases={leases}
        findingsByLease={findingsByLease}
        onOpenLease={() => {}}
      />,
    );
    const rowA = screen.getByRole('row', { name: /A\.pdf/ });
    expect(within(rowA).getByText(/high/i)).toBeInTheDocument();
    const rowB = screen.getByRole('row', { name: /B\.pdf/ });
    // B has no hit on 'shared' — expect dash.
    expect(within(rowB).getByText('—')).toBeInTheDocument();
  });

  it('shows page count and date in the lease cell', () => {
    const leases = [
      meta({
        id: 'a',
        name: 'Lease A.pdf',
        pageCount: 12,
        createdAt: Date.parse('2026-04-18T00:00:00Z'),
      }),
    ];
    const findingsByLease = new Map<string, Finding[]>([
      ['a', [f({ ruleId: 'r1' })]],
    ]);
    render(
      <PortfolioPanel
        leases={leases}
        findingsByLease={findingsByLease}
        onOpenLease={() => {}}
      />,
    );
    expect(screen.getByText(/12 pages/i)).toBeInTheDocument();
  });

  it('invokes onOpenLease with the lease id when the lease name is clicked', async () => {
    const onOpenLease = vi.fn();
    const leases = [meta({ id: 'pick', name: 'Pick.pdf' })];
    const findingsByLease = new Map<string, Finding[]>([
      ['pick', [f({ ruleId: 'r1' })]],
    ]);
    render(
      <PortfolioPanel
        leases={leases}
        findingsByLease={findingsByLease}
        onOpenLease={onOpenLease}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /open pick\.pdf/i }));
    expect(onOpenLease).toHaveBeenCalledWith('pick');
  });

  it('uses the first-listed severity if multiple findings share a rule id on one lease', () => {
    const leases = [meta({ id: 'a', name: 'A.pdf' })];
    const findingsByLease = new Map<string, Finding[]>([
      [
        'a',
        [
          f({ ruleId: 'dup', severity: 'low' }),
          f({ ruleId: 'dup', severity: 'high' }),
        ],
      ],
    ]);
    render(
      <PortfolioPanel
        leases={leases}
        findingsByLease={findingsByLease}
        onOpenLease={() => {}}
      />,
    );
    const row = screen.getByRole('row', { name: /A\.pdf/ });
    expect(within(row).getByText(/low/i)).toBeInTheDocument();
  });

  it('marks the lease column as sticky via a data-sticky attribute', () => {
    const leases = [meta({ id: 'a', name: 'A.pdf' })];
    const findingsByLease = new Map<string, Finding[]>([
      ['a', [f({ ruleId: 'r1' })]],
    ]);
    render(
      <PortfolioPanel
        leases={leases}
        findingsByLease={findingsByLease}
        onOpenLease={() => {}}
      />,
    );
    const firstHeader = screen.getAllByRole('columnheader')[0]!;
    expect(firstHeader.getAttribute('data-sticky')).toBe('true');
  });
});

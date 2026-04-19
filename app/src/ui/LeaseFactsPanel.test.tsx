import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { LeaseFactsPanel } from './LeaseFactsPanel';
import type { LeaseFacts } from '../facts/types';

function makeFacts(overrides: Partial<LeaseFacts> = {}): LeaseFacts {
  return {
    baseRent: null,
    securityDeposit: null,
    termMonths: null,
    noticePeriodDays: null,
    commencementDate: null,
    expirationDate: null,
    definitions: [],
    crossReferences: [],
    ...overrides,
  };
}

describe('LeaseFactsPanel', () => {
  it('renders an empty state when every fact is missing', () => {
    render(<LeaseFactsPanel facts={makeFacts()} />);
    expect(
      screen.getByText(/no structured facts detected/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders the lease facts table when at least one fact is present', () => {
    render(
      <LeaseFactsPanel
        facts={makeFacts({
          baseRent: { amount: 2500, currency: 'USD', raw: '$2,500', page: 1 },
        })}
      />,
    );
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    expect(within(table).getByText('Base rent')).toBeInTheDocument();
    expect(within(table).getByText(/\$2,500/)).toBeInTheDocument();
  });

  it('shows em-dashes for missing primitive fields when others are present', () => {
    render(
      <LeaseFactsPanel
        facts={makeFacts({
          termMonths: 12,
        })}
      />,
    );
    const baseRentRow = screen.getByRole('rowheader', { name: 'Base rent' }).closest('tr');
    expect(baseRentRow).not.toBeNull();
    expect(within(baseRentRow as HTMLElement).getByText('—')).toBeInTheDocument();
  });

  it('formats term in months and years when evenly divisible', () => {
    render(<LeaseFactsPanel facts={makeFacts({ termMonths: 24 })} />);
    expect(screen.getByText(/24 months \(2 years\)/)).toBeInTheDocument();
  });

  it('singularizes "year" when the term is exactly 12 months', () => {
    render(<LeaseFactsPanel facts={makeFacts({ termMonths: 12 })} />);
    expect(screen.getByText(/12 months \(1 year\)/)).toBeInTheDocument();
  });

  it('renders a non-year-aligned term in months only', () => {
    render(<LeaseFactsPanel facts={makeFacts({ termMonths: 13 })} />);
    expect(screen.getByText(/^13 months$/)).toBeInTheDocument();
  });

  it('renders the notice period in days', () => {
    render(<LeaseFactsPanel facts={makeFacts({ noticePeriodDays: 30 })} />);
    expect(screen.getByText('30 days')).toBeInTheDocument();
  });

  it('renders commencement and expiration dates', () => {
    render(
      <LeaseFactsPanel
        facts={makeFacts({
          commencementDate: '2026-01-01',
          expirationDate: '2026-12-31',
        })}
      />,
    );
    expect(screen.getByText('2026-01-01')).toBeInTheDocument();
    expect(screen.getByText('2026-12-31')).toBeInTheDocument();
  });

  it('renders the definitions list when entries exist', () => {
    render(
      <LeaseFactsPanel
        facts={makeFacts({
          definitions: [
            { term: 'Premises', definition: 'the real property', page: 1, paragraphIndex: 0 },
            { term: 'Base Rent', definition: 'the monthly rent', page: 2, paragraphIndex: 3 },
          ],
        })}
      />,
    );
    expect(screen.getByRole('heading', { name: /definitions \(2\)/i })).toBeInTheDocument();
    expect(screen.getByText('Premises')).toBeInTheDocument();
    expect(screen.getByText(/the real property/)).toBeInTheDocument();
    expect(screen.getByText('Base Rent')).toBeInTheDocument();
  });

  it('renders the cross-references list when entries exist', () => {
    render(
      <LeaseFactsPanel
        facts={makeFacts({
          crossReferences: [
            { text: 'Section 4.2', target: 'section:Section 4.2', page: 1, paragraphIndex: 0 },
            { text: 'Exhibit A', target: 'exhibit:Exhibit A', page: 2, paragraphIndex: 1 },
          ],
        })}
      />,
    );
    expect(screen.getByRole('heading', { name: /cross-references \(2\)/i })).toBeInTheDocument();
    expect(screen.getByText('Section 4.2')).toBeInTheDocument();
    expect(screen.getByText('Exhibit A')).toBeInTheDocument();
  });

  it('does not render the definitions section when the list is empty', () => {
    render(
      <LeaseFactsPanel
        facts={makeFacts({ termMonths: 12 })}
      />,
    );
    expect(screen.queryByRole('heading', { name: /definitions/i })).not.toBeInTheDocument();
  });

  it('does not render the cross-references section when the list is empty', () => {
    render(
      <LeaseFactsPanel
        facts={makeFacts({ termMonths: 12 })}
      />,
    );
    expect(screen.queryByRole('heading', { name: /cross-references/i })).not.toBeInTheDocument();
  });

  it('exposes an accessible region label', () => {
    render(<LeaseFactsPanel facts={makeFacts()} />);
    expect(screen.getByRole('region', { name: /lease facts/i })).toBeInTheDocument();
  });
});

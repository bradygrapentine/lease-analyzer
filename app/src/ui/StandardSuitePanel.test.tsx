import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StandardSuitePanel } from './StandardSuitePanel';
import type { StandardClause } from '../clauseStandard/standardSuite';

const SUITE: StandardClause[] = [
  {
    id: 's1',
    name: 'Auto-renewal standard',
    sourceLeaseId: 'L1',
    sourceParagraphIndex: 2,
    normalizedText: 'auto renewal text',
    createdAt: 1,
  },
  {
    id: 's2',
    name: 'Indemnification standard',
    sourceLeaseId: 'L2',
    sourceParagraphIndex: 5,
    normalizedText: 'indemnification text',
    createdAt: 2,
  },
];

describe('StandardSuitePanel', () => {
  it('renders an empty state when no standards exist', () => {
    render(<StandardSuitePanel standards={[]} onDelete={() => {}} />);
    expect(screen.getByText(/no standards/i)).toBeInTheDocument();
  });

  it('renders each standard by name', () => {
    render(<StandardSuitePanel standards={SUITE} onDelete={() => {}} />);
    expect(screen.getByText(/Auto-renewal standard/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Indemnification standard/i),
    ).toBeInTheDocument();
  });

  it('shows a delete button per standard', () => {
    render(<StandardSuitePanel standards={SUITE} onDelete={() => {}} />);
    expect(
      screen.getByRole('button', { name: /delete Auto-renewal standard/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /delete Indemnification standard/i }),
    ).toBeInTheDocument();
  });

  it('fires onDelete(id) when a delete button is clicked', async () => {
    const onDelete = vi.fn();
    render(<StandardSuitePanel standards={SUITE} onDelete={onDelete} />);
    await userEvent.click(
      screen.getByRole('button', { name: /delete Auto-renewal standard/i }),
    );
    expect(onDelete).toHaveBeenCalledWith('s1');
  });
});

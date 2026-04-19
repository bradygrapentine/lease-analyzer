import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LibraryPanel } from './LibraryPanel';
import type { LeaseMetadata } from '../storage/storage';

function meta(over: Partial<LeaseMetadata>): LeaseMetadata {
  return {
    id: 'abc',
    name: 'Lease.pdf',
    createdAt: Date.parse('2026-04-18T12:00:00Z'),
    updatedAt: Date.parse('2026-04-18T12:00:00Z'),
    rulePackVersion: '1.0.0',
    pageCount: 5,
    findingCount: 3,
    ...over,
  };
}

describe('LibraryPanel', () => {
  it('renders an entry per saved lease', () => {
    render(
      <LibraryPanel
        leases={[meta({ id: '1', name: 'One.pdf' }), meta({ id: '2', name: 'Two.pdf' })]}
        onOpen={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText('One.pdf')).toBeInTheDocument();
    expect(screen.getByText('Two.pdf')).toBeInTheDocument();
  });

  it('shows an empty-state message when list is empty', () => {
    render(<LibraryPanel leases={[]} onOpen={() => {}} onDelete={() => {}} />);
    expect(screen.getByText(/no saved leases/i)).toBeInTheDocument();
  });

  it('fires onOpen with the lease id', async () => {
    const onOpen = vi.fn();
    render(
      <LibraryPanel
        leases={[meta({ id: 'picked', name: 'Pick.pdf' })]}
        onOpen={onOpen}
        onDelete={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /open pick\.pdf/i }));
    expect(onOpen).toHaveBeenCalledWith('picked');
  });

  it('fires onDelete with the lease id', async () => {
    const onDelete = vi.fn();
    render(
      <LibraryPanel
        leases={[meta({ id: 'gone', name: 'Gone.pdf' })]}
        onOpen={() => {}}
        onDelete={onDelete}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /delete gone\.pdf/i }));
    expect(onDelete).toHaveBeenCalledWith('gone');
  });
});

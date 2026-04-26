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

const noop = (): void => {};

describe('LibraryPanel', () => {
  it('renders an entry per saved lease', () => {
    render(
      <LibraryPanel
        leases={[meta({ id: '1', name: 'One.pdf' }), meta({ id: '2', name: 'Two.pdf' })]}
        standardId={null}
        onOpen={noop}
        onDelete={noop}
        onSetStandard={noop}
        onRename={noop}
      />,
    );
    expect(screen.getByText('One.pdf')).toBeInTheDocument();
    expect(screen.getByText('Two.pdf')).toBeInTheDocument();
  });

  it('shows an empty-state message when list is empty (Wave 28-D EmptyState)', () => {
    const { container } = render(
      <LibraryPanel
        leases={[]}
        standardId={null}
        onOpen={noop}
        onDelete={noop}
        onSetStandard={noop}
        onRename={noop}
      />,
    );
    expect(screen.getByText(/no saved leases/i)).toBeInTheDocument();
    // Wave 28-D: the empty branch now uses the EmptyState primitive,
    // which renders a description slot via [data-empty-description].
    expect(container.querySelector('[data-empty-description]')).not.toBeNull();
  });

  it('fires onOpen with the lease id', async () => {
    const onOpen = vi.fn();
    render(
      <LibraryPanel
        leases={[meta({ id: 'picked', name: 'Pick.pdf' })]}
        standardId={null}
        onOpen={onOpen}
        onDelete={noop}
        onSetStandard={noop}
        onRename={noop}
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
        standardId={null}
        onOpen={noop}
        onDelete={onDelete}
        onSetStandard={noop}
        onRename={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /delete gone\.pdf/i }));
    expect(onDelete).toHaveBeenCalledWith('gone');
  });

  it('shows a standard badge on the current standard and no "Set as standard" button for it', () => {
    render(
      <LibraryPanel
        leases={[meta({ id: 's', name: 'Standard.pdf' }), meta({ id: 'o', name: 'Other.pdf' })]}
        standardId="s"
        onOpen={noop}
        onDelete={noop}
        onSetStandard={noop}
        onRename={noop}
      />,
    );
    const stdBtn = screen.getByRole('button', { name: /open standard\.pdf/i });
    expect(stdBtn.textContent).toMatch(/★/);
    expect(
      screen.queryByRole('button', { name: /set standard\.pdf as standard/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /set other\.pdf as standard/i }),
    ).toBeInTheDocument();
  });

  it('fires onRename with the new name when user confirms the prompt', async () => {
    const onRename = vi.fn();
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Renamed.pdf');
    render(
      <LibraryPanel
        leases={[meta({ id: 'r', name: 'Old.pdf' })]}
        standardId={null}
        onOpen={noop}
        onDelete={noop}
        onSetStandard={noop}
        onRename={onRename}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /rename old\.pdf/i }));
    expect(onRename).toHaveBeenCalledWith('r', 'Renamed.pdf');
    promptSpy.mockRestore();
  });

  it('does not fire onRename if user cancels the prompt', async () => {
    const onRename = vi.fn();
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
    render(
      <LibraryPanel
        leases={[meta({ id: 'r', name: 'Old.pdf' })]}
        standardId={null}
        onOpen={noop}
        onDelete={noop}
        onSetStandard={noop}
        onRename={onRename}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /rename old\.pdf/i }));
    expect(onRename).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it('fires onSetStandard with the lease id', async () => {
    const onSet = vi.fn();
    render(
      <LibraryPanel
        leases={[meta({ id: 'p', name: 'Promote.pdf' })]}
        standardId={null}
        onOpen={noop}
        onDelete={noop}
        onSetStandard={onSet}
        onRename={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /set promote\.pdf as standard/i }));
    expect(onSet).toHaveBeenCalledWith('p');
  });
});

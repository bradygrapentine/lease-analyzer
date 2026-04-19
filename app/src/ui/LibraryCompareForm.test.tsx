import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LibraryCompareForm } from './LibraryCompareForm';
import type { LeaseMetadata } from '../storage/storage';

function meta(id: string, name: string): LeaseMetadata {
  return {
    id,
    name,
    createdAt: 0,
    updatedAt: 0,
    rulePackVersion: '1.0.0',
    pageCount: 1,
    findingCount: 0,
  };
}

describe('LibraryCompareForm', () => {
  it('renders nothing when fewer than two leases exist', () => {
    const { container } = render(
      <LibraryCompareForm leases={[meta('a', 'A')]} onCompare={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('disables submit until two distinct leases are selected', async () => {
    const onCompare = vi.fn();
    render(
      <LibraryCompareForm
        leases={[meta('a', 'A.pdf'), meta('b', 'B.pdf')]}
        onCompare={onCompare}
      />,
    );
    const submit = screen.getByRole('button', { name: /compare/i });
    expect(submit).toBeDisabled();

    await userEvent.selectOptions(screen.getByLabelText(/lease a/i), 'a');
    await userEvent.selectOptions(screen.getByLabelText(/lease b/i), 'b');
    expect(submit).not.toBeDisabled();

    await userEvent.click(submit);
    expect(onCompare).toHaveBeenCalledWith('a', 'b');
  });

  it('keeps submit disabled when both sides pick the same lease', async () => {
    render(
      <LibraryCompareForm
        leases={[meta('a', 'A.pdf'), meta('b', 'B.pdf')]}
        onCompare={() => {}}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText(/lease a/i), 'a');
    await userEvent.selectOptions(screen.getByLabelText(/lease b/i), 'a');
    expect(screen.getByRole('button', { name: /compare/i })).toBeDisabled();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// Wave 9 Part A — component does not exist yet; failing import is the red
// signal. The implementer creates `app/src/ui/ShareReviewPanel.tsx`
// exporting a `ShareReviewPanel` React component with this prop shape:
//
//   interface ShareReviewPanelProps {
//     // The currently-selected lease record. Null means "no lease picked".
//     lease: { id: string; name: string; signedPack: boolean } | null;
//     // Called when the user clicks "Generate review link" with a valid
//     // passphrase + future expiry; receives the encoded `.lgreview` bytes.
//     onGenerate: (input: {
//       leaseId: string;
//       passphrase: string;
//       expiresAt: string;
//     }) => Promise<Uint8Array>;
//   }
import { ShareReviewPanel } from './ShareReviewPanel';

function lease(over: Partial<{ id: string; name: string; signedPack: boolean }> = {}) {
  return { id: 'lease-1', name: 'Apt 4B Lease.pdf', signedPack: true, ...over };
}

describe('ShareReviewPanel', () => {
  it('happy path: generates a review archive when passphrase + expiry are valid', async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn<
      [{ leaseId: string; passphrase: string; expiresAt: string }],
      Promise<Uint8Array>
    >(async () => new Uint8Array([1, 2, 3]));
    render(<ShareReviewPanel lease={lease()} onGenerate={onGenerate} />);
    await user.type(screen.getByLabelText(/passphrase/i), 'a-strong-passphrase-12345');
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    await user.clear(screen.getByLabelText(/expir/i));
    await user.type(screen.getByLabelText(/expir/i), future);
    await user.click(screen.getByRole('button', { name: /generate/i }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onGenerate.mock.calls[0]?.[0]?.leaseId).toBe('lease-1');
  });

  it('refuses to submit a passphrase that fails the strength check', async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    render(<ShareReviewPanel lease={lease()} onGenerate={onGenerate} />);
    await user.type(screen.getByLabelText(/passphrase/i), 'short');
    await user.click(screen.getByRole('button', { name: /generate/i }));
    expect(onGenerate).not.toHaveBeenCalled();
    expect(screen.getByText(/passphrase/i)).toBeInTheDocument();
  });

  it('refuses to submit an expiry date in the past', async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    render(<ShareReviewPanel lease={lease()} onGenerate={onGenerate} />);
    await user.type(screen.getByLabelText(/passphrase/i), 'a-strong-passphrase-12345');
    await user.clear(screen.getByLabelText(/expir/i));
    await user.type(screen.getByLabelText(/expir/i), '2000-01-01');
    await user.click(screen.getByRole('button', { name: /generate/i }));
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it('disables generation when the lease is not backed by a signed pack', async () => {
    const onGenerate = vi.fn();
    render(<ShareReviewPanel lease={lease({ signedPack: false })} onGenerate={onGenerate} />);
    expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled();
  });
});

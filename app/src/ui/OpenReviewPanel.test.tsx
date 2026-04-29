import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// Wave 9 Part A — component does not exist yet; failing import is the red
// signal. The implementer creates `app/src/ui/OpenReviewPanel.tsx`
// exporting a `OpenReviewPanel` React component with this prop shape:
//
//   interface OpenReviewPanelProps {
//     // Recipient drops a `.lgreview` file. The panel reads its bytes,
//     // prompts for the passphrase, and calls `onOpen`.
//     onOpen: (input: {
//       bytes: Uint8Array;
//       passphrase: string;
//     }) => Promise<{ ok: true; archiveId: string; expiresAt: string }
//                  | { ok: false; reason: 'wrong-passphrase' | 'expired' | 'missing-pack' | 'malformed' }>;
//   }
import { OpenReviewPanel } from './OpenReviewPanel';

function file(): File {
  return new File([new Uint8Array([1, 2, 3, 4])], 'review.lgreview', {
    type: 'application/octet-stream',
  });
}

describe('OpenReviewPanel', () => {
  it('happy path: drops a file, types passphrase, mounts the lease in review mode', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn(async () => ({ ok: true as const, archiveId: 'a1', expiresAt: 'z' }));
    render(<OpenReviewPanel onOpen={onOpen} />);
    await user.upload(screen.getByLabelText(/file|archive/i) as HTMLInputElement, file());
    await user.type(screen.getByLabelText(/passphrase/i), 'a-strong-passphrase-12345');
    await user.click(screen.getByRole('button', { name: /open/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/review mode|read-only/i)).toBeInTheDocument();
  });

  it('surfaces a clear "wrong passphrase" error', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn(async () => ({ ok: false as const, reason: 'wrong-passphrase' as const }));
    render(<OpenReviewPanel onOpen={onOpen} />);
    await user.upload(screen.getByLabelText(/file|archive/i) as HTMLInputElement, file());
    await user.type(screen.getByLabelText(/passphrase/i), 'wrong-pass-123');
    await user.click(screen.getByRole('button', { name: /open/i }));
    expect(await screen.findByText(/wrong|incorrect/i)).toBeInTheDocument();
    // Wave 45-BE — error paragraph paired with "Error" badge.
    expect(screen.getAllByText(/^error$/i).length).toBeGreaterThan(0);
  });

  it('surfaces a clear "expired" error', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn(async () => ({ ok: false as const, reason: 'expired' as const }));
    render(<OpenReviewPanel onOpen={onOpen} />);
    await user.upload(screen.getByLabelText(/file|archive/i) as HTMLInputElement, file());
    await user.type(screen.getByLabelText(/passphrase/i), 'a-strong-passphrase-12345');
    await user.click(screen.getByRole('button', { name: /open/i }));
    expect(await screen.findByText(/expired/i)).toBeInTheDocument();
  });

  it('surfaces a clear "missing pack" error when recipient lacks the signed pack', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn(async () => ({ ok: false as const, reason: 'missing-pack' as const }));
    render(<OpenReviewPanel onOpen={onOpen} />);
    await user.upload(screen.getByLabelText(/file|archive/i) as HTMLInputElement, file());
    await user.type(screen.getByLabelText(/passphrase/i), 'a-strong-passphrase-12345');
    await user.click(screen.getByRole('button', { name: /open/i }));
    expect(await screen.findByText(/missing.*pack|install.*pack/i)).toBeInTheDocument();
  });

  it('surfaces a clear "malformed" error when the file is not a review archive', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn(async () => ({ ok: false as const, reason: 'malformed' as const }));
    render(<OpenReviewPanel onOpen={onOpen} />);
    await user.upload(screen.getByLabelText(/file|archive/i) as HTMLInputElement, file());
    await user.type(screen.getByLabelText(/passphrase/i), 'a-strong-passphrase-12345');
    await user.click(screen.getByRole('button', { name: /open/i }));
    expect(
      await screen.findByText(/not a leaseguard review archive|malformed/i),
    ).toBeInTheDocument();
  });

  it('errors when the user clicks Open without selecting a file', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<OpenReviewPanel onOpen={onOpen} />);
    await user.type(screen.getByLabelText(/passphrase/i), 'pp');
    await user.click(screen.getByRole('button', { name: /open/i }));
    expect(onOpen).not.toHaveBeenCalled();
    expect(await screen.findByText(/choose a .*review file/i)).toBeInTheDocument();
  });

  it('errors when the user submits without a passphrase', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<OpenReviewPanel onOpen={onOpen} />);
    await user.upload(screen.getByLabelText(/file|archive/i) as HTMLInputElement, file());
    await user.click(screen.getByRole('button', { name: /open/i }));
    expect(onOpen).not.toHaveBeenCalled();
  });
});

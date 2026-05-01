import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// Wave 9 Part B — component does not yet exist; failing import is the red
// signal. The implementer creates `app/src/ui/CounterSignPanel.tsx`
// exporting `CounterSignPanel` with this prop shape:
//
//   interface CounterSignPanelProps {
//     decisions: { editId: string; accepted: boolean }[];
//     archiveFingerprint: string;
//     // Called when the user enters a passphrase to unlock their signing
//     // key and presses "Sign & export". Returns the .lgpatch bytes.
//     onSign: (input: {
//       passphrase: string;
//       decisions: { editId: string; accepted: boolean }[];
//     }) => Promise<Uint8Array>;
//   }
import { CounterSignPanel, type CounterSignDecision } from './CounterSignPanel';

describe('CounterSignPanel', () => {
  it('renders a signing button that is disabled until a passphrase is entered', () => {
    render(
      <CounterSignPanel
        decisions={[{ editId: 'e1', accepted: true }]}
        archiveFingerprint={'a'.repeat(64)}
        onSign={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /sign/i })).toBeDisabled();
  });

  it('happy path: passphrase + click invokes onSign with the decisions list', async () => {
    const user = userEvent.setup();
    const onSign = vi.fn<
      (input: { passphrase: string; decisions: CounterSignDecision[] }) => Promise<Uint8Array>
    >(async () => new Uint8Array([9, 9, 9]));
    render(
      <CounterSignPanel
        decisions={[
          { editId: 'e1', accepted: true },
          { editId: 'e2', accepted: false },
        ]}
        archiveFingerprint={'a'.repeat(64)}
        onSign={onSign}
      />,
    );
    await user.type(screen.getByLabelText(/passphrase/i), 'a-strong-passphrase-12345');
    await user.click(screen.getByRole('button', { name: /sign/i }));
    expect(onSign).toHaveBeenCalledTimes(1);
    expect(onSign.mock.calls[0]?.[0]?.decisions).toHaveLength(2);
  });

  it('surfaces an error when onSign rejects (e.g. wrong passphrase)', async () => {
    const user = userEvent.setup();
    const onSign = vi.fn(async () => {
      throw new Error('bad passphrase');
    });
    render(
      <CounterSignPanel
        decisions={[{ editId: 'e1', accepted: true }]}
        archiveFingerprint={'a'.repeat(64)}
        onSign={onSign}
      />,
    );
    await user.type(screen.getByLabelText(/passphrase/i), 'a-strong-passphrase-12345');
    await user.click(screen.getByRole('button', { name: /sign/i }));
    expect(await screen.findByText(/bad passphrase/i)).toBeInTheDocument();
    // Wave 45-BE — error paragraph paired with "Sign failed" badge.
    expect(screen.getAllByText(/^sign failed$/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('alert')).toHaveTextContent(/bad passphrase/);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// Wave 9 Part C — component does not yet exist; failing import is the red
// signal. The implementer creates `app/src/ui/OpenDeltaPanel.tsx`
// exporting `OpenDeltaPanel` with this prop shape:
//
//   interface OpenDeltaPanelProps {
//     // Recipient drops a `.lgdelta` file. The panel reads its bytes,
//     // verifies the signature, previews the changes, and on confirm
//     // calls onApply.
//     onPreview: (bytes: Uint8Array) => Promise<{ ok: true; preview: string }
//                                              | { ok: false; reason: string }>;
//     onApply: () => Promise<void>;
//   }
import { OpenDeltaPanel } from './OpenDeltaPanel';

function file(): File {
  return new File([new Uint8Array([1, 2, 3])], 'patch.lgdelta');
}

describe('OpenDeltaPanel', () => {
  it('previews the changes after a successful drop + verify', async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn(async () => ({ ok: true as const, preview: '+ rent: 1100' }));
    render(<OpenDeltaPanel onPreview={onPreview} onApply={vi.fn()} />);
    await user.upload(screen.getByLabelText(/file|delta/i) as HTMLInputElement, file());
    expect(await screen.findByText(/\+ rent: 1100/)).toBeInTheDocument();
  });

  it('surfaces a clear error when verification fails', async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn(async () => ({ ok: false as const, reason: 'signature invalid' }));
    render(<OpenDeltaPanel onPreview={onPreview} onApply={vi.fn()} />);
    await user.upload(screen.getByLabelText(/file|delta/i) as HTMLInputElement, file());
    expect(await screen.findByText(/signature invalid/i)).toBeInTheDocument();
    // Wave 45-BE — error paragraph paired with "Verification failed" badge.
    expect(screen.getAllByText(/^verification failed$/i).length).toBeGreaterThan(0);
  });

  it('surfaces a clear error when readBytes throws (FileReader path failure)', async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn(async () => {
      throw new Error('decode failed');
    });
    render(<OpenDeltaPanel onPreview={onPreview} onApply={vi.fn()} />);
    await user.upload(screen.getByLabelText(/file|delta/i) as HTMLInputElement, file());
    expect(await screen.findByText(/decode failed/i)).toBeInTheDocument();
  });

  it('Accept-and-merge button calls onApply when previewed', async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn(async () => ({ ok: true as const, preview: '+ x' }));
    const onApply = vi.fn(async () => undefined);
    render(<OpenDeltaPanel onPreview={onPreview} onApply={onApply} />);
    await user.upload(screen.getByLabelText(/file|delta/i) as HTMLInputElement, file());
    await screen.findByText(/\+ x/);
    await user.click(screen.getByRole('button', { name: /accept and merge/i }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// Wave 8 Part D — SigningKeyPanel gains a "Rotate key" button + a
// per-key history list. The implementer extends SigningKeyPanelProps
// with `keys: KeyHistoryEntry[]` and `onRotateKey: (passphrase) => void`.
import {
  SigningKeyPanel,
  type SigningKeyPanelProps,
} from './SigningKeyPanel';

interface KeyHistoryEntry {
  id: string;
  publicKey: string;
  fingerprint: string;
  createdAt: number;
  retiredAt: number | null;
}

function renderPanel(over: Partial<SigningKeyPanelProps> = {}): {
  onCreateKey: ReturnType<typeof vi.fn>;
  onExportPublicKey: ReturnType<typeof vi.fn>;
  onRotateKey: ReturnType<typeof vi.fn>;
} {
  const onCreateKey = vi.fn();
  const onExportPublicKey = vi.fn();
  const onRotateKey = vi.fn();
  const defaults = {
    state: { publicKey: 'AAA-pub-key-base64==' },
    onCreateKey,
    onExportPublicKey,
    onRotateKey,
    keys: [
      {
        id: 'k0',
        publicKey: 'AAA-pub-key-base64==',
        fingerprint: 'a'.repeat(64),
        createdAt: 1_700_000_000_000,
        retiredAt: null,
      },
    ] satisfies KeyHistoryEntry[],
  } as unknown as SigningKeyPanelProps;
  render(<SigningKeyPanel {...defaults} {...over} />);
  return { onCreateKey, onExportPublicKey, onRotateKey };
}

describe('SigningKeyPanel — rotation (Wave 8 Part D)', () => {
  it('renders a "Rotate key" button when a key exists', () => {
    renderPanel();
    expect(
      screen.getByRole('button', { name: /rotate key/i }),
    ).toBeInTheDocument();
  });

  it('calls onRotateKey with the prompted passphrase', async () => {
    const { onRotateKey } = renderPanel();
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('new-pass');
    await userEvent.click(screen.getByRole('button', { name: /rotate key/i }));
    expect(promptSpy).toHaveBeenCalled();
    expect(onRotateKey).toHaveBeenCalledWith('new-pass');
    promptSpy.mockRestore();
  });

  it('renders a key-history list with each key id, fingerprint, and retired status', () => {
    renderPanel({
      keys: [
        {
          id: 'k0',
          publicKey: 'OLDpub==',
          fingerprint: 'a'.repeat(64),
          createdAt: 1_700_000_000_000,
          retiredAt: 1_710_000_000_000,
        },
        {
          id: 'k1',
          publicKey: 'NEWpub==',
          fingerprint: 'b'.repeat(64),
          createdAt: 1_710_000_000_000,
          retiredAt: null,
        },
      ],
    } as Partial<SigningKeyPanelProps>);
    const history = screen.getByRole('list', { name: /key history/i });
    expect(history).toBeInTheDocument();
    expect(screen.getByText(/k0/)).toBeInTheDocument();
    expect(screen.getByText(/k1/)).toBeInTheDocument();
    // Fingerprint shown (truncated is fine — assert at least the prefix).
    expect(screen.getByText(/aaaaaaaa/i)).toBeInTheDocument();
    expect(screen.getByText(/bbbbbbbb/i)).toBeInTheDocument();
    // Retired marker.
    expect(screen.getByText(/retired/i)).toBeInTheDocument();
  });

  it('still surfaces the retired key so callers can verify historical signatures', () => {
    renderPanel({
      keys: [
        {
          id: 'k0',
          publicKey: 'OLDpub==',
          fingerprint: 'a'.repeat(64),
          createdAt: 1_700_000_000_000,
          retiredAt: 1_710_000_000_000,
        },
        {
          id: 'k1',
          publicKey: 'NEWpub==',
          fingerprint: 'b'.repeat(64),
          createdAt: 1_710_000_000_000,
          retiredAt: null,
        },
      ],
    } as Partial<SigningKeyPanelProps>);
    // The retired key's id remains visible (callers verify against its
    // public key elsewhere); this asserts the panel doesn't drop it.
    const retiredRow = screen.getByText(/k0/).closest('li');
    expect(retiredRow).not.toBeNull();
    expect(retiredRow?.textContent ?? '').toMatch(/retired/i);
  });
});

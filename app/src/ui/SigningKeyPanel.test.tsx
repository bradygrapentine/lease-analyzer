import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SigningKeyPanel } from './SigningKeyPanel';

const noop = (): void => {};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SigningKeyPanel', () => {
  it('shows "No signing key" and a Create button when state.publicKey is null', () => {
    render(
      <SigningKeyPanel
        state={{ publicKey: null }}
        onCreateKey={noop}
        onExportPublicKey={noop}
      />,
    );
    expect(screen.getByText(/no signing key/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create key/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export public key/i })).not.toBeInTheDocument();
  });

  it('shows the truncated public key and Export button when a key exists', () => {
    render(
      <SigningKeyPanel
        state={{ publicKey: 'AAAAAAAABBBBBBBBCCCCCCCCDDDDDDDD' }}
        onCreateKey={noop}
        onExportPublicKey={noop}
      />,
    );
    expect(screen.getByLabelText(/public key/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export public key/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create key/i })).not.toBeInTheDocument();
  });

  it('calls onCreateKey with the passphrase the user enters', async () => {
    const onCreateKey = vi.fn();
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('hunter2');
    render(
      <SigningKeyPanel
        state={{ publicKey: null }}
        onCreateKey={onCreateKey}
        onExportPublicKey={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /create key/i }));
    expect(onCreateKey).toHaveBeenCalledWith('hunter2');
    promptSpy.mockRestore();
  });

  it('does not call onCreateKey if the user cancels the passphrase prompt', async () => {
    const onCreateKey = vi.fn();
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
    render(
      <SigningKeyPanel
        state={{ publicKey: null }}
        onCreateKey={onCreateKey}
        onExportPublicKey={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /create key/i }));
    expect(onCreateKey).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it('does not call onCreateKey on an empty passphrase', async () => {
    const onCreateKey = vi.fn();
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('');
    render(
      <SigningKeyPanel
        state={{ publicKey: null }}
        onCreateKey={onCreateKey}
        onExportPublicKey={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /create key/i }));
    expect(onCreateKey).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it('calls onExportPublicKey with the current public key when Export is clicked', async () => {
    const onExport = vi.fn();
    render(
      <SigningKeyPanel
        state={{ publicKey: 'PUBKEYBASE64==' }}
        onCreateKey={noop}
        onExportPublicKey={onExport}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /export public key/i }));
    expect(onExport).toHaveBeenCalledWith('PUBKEYBASE64==');
  });

  it('truncates long public keys visually while still being accessible as code', () => {
    const longKey = 'A'.repeat(44);
    const { container } = render(
      <SigningKeyPanel
        state={{ publicKey: longKey }}
        onCreateKey={noop}
        onExportPublicKey={noop}
      />,
    );
    const code = container.querySelector('code');
    expect(code).toBeTruthy();
    // Truncated rendering should be shorter than the full key.
    expect(code?.textContent?.length ?? 0).toBeLessThan(longKey.length);
  });
});

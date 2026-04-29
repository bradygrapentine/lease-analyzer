import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SigningKeyPanel } from './SigningKeyPanel';

const noop = (): void => {};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SigningKeyPanel', () => {
  it('shows "No signing key" and a Create button when state.publicKey is null', () => {
    render(
      <SigningKeyPanel state={{ publicKey: null }} onCreateKey={noop} onExportPublicKey={noop} />,
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
    expect(screen.getByLabelText(/^public key$/i)).toBeInTheDocument();
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
    // First code element is the truncated public key.
    const code = container.querySelector('code');
    expect(code).toBeTruthy();
    expect(code?.textContent?.length ?? 0).toBeLessThan(longKey.length);
  });

  it('renders the public-key fingerprint as 8 hex chars', async () => {
    render(
      <SigningKeyPanel
        state={{ publicKey: btoa('hello') }}
        onCreateKey={noop}
        onExportPublicKey={noop}
      />,
    );
    const fp = await screen.findByLabelText(/public key fingerprint/i);
    await waitFor(() => {
      expect(fp.textContent).toMatch(/^[0-9a-f]{8}$/);
    });
  });

  it('shows a transient success status when Export public key copies', async () => {
    const onExport = vi.fn(async () => ({ status: 'copied' as const }));
    render(
      <SigningKeyPanel
        state={{ publicKey: btoa('hello') }}
        onCreateKey={noop}
        onExportPublicKey={onExport}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /export public key/i }));
    expect(onExport).toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent(/public key copied to clipboard/i);
  });

  it('shows a persistent failure status with a Copy failed badge when Export is denied', async () => {
    const onExport = vi.fn(async () => ({
      status: 'denied' as const,
      reason: 'NotAllowedError',
    }));
    render(
      <SigningKeyPanel
        state={{ publicKey: btoa('hello') }}
        onCreateKey={noop}
        onExportPublicKey={onExport}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /export public key/i }));
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(/could not copy: notallowederror/i);
    expect(status).toHaveTextContent(/copy failed/i);
  });

  it('Copy fingerprint surfaces success status via the same role=status pattern', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(
      <SigningKeyPanel
        state={{ publicKey: btoa('hello') }}
        onCreateKey={noop}
        onExportPublicKey={noop}
      />,
    );
    await screen.findByLabelText(/public key fingerprint/i);
    await userEvent.click(screen.getByRole('button', { name: /copy fingerprint/i }));
    expect(writeText).toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent(/fingerprint copied to clipboard/i);
  });

  it('Copy fingerprint surfaces a denied status when the clipboard API is missing', async () => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    render(
      <SigningKeyPanel
        state={{ publicKey: btoa('hello') }}
        onCreateKey={noop}
        onExportPublicKey={noop}
      />,
    );
    await screen.findByLabelText(/public key fingerprint/i);
    await userEvent.click(screen.getByRole('button', { name: /copy fingerprint/i }));
    expect(await screen.findByRole('status')).toHaveTextContent(/could not copy/i);
  });
});

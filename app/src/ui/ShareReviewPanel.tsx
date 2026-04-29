import { useState, type FormEvent } from 'react';
import { Badge } from './system/Badge';

export interface ShareReviewPanelProps {
  lease: { id: string; name: string; signedPack: boolean } | null;
  onGenerate: (input: {
    leaseId: string;
    passphrase: string;
    expiresAt: string;
  }) => Promise<Uint8Array>;
}

const MIN_PASSPHRASE_LEN = 16;

function defaultExpiry(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export function ShareReviewPanel({ lease, onGenerate }: ShareReviewPanelProps): JSX.Element {
  const [passphrase, setPassphrase] = useState('');
  const [expiry, setExpiry] = useState<string>(defaultExpiry());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signedPack = lease?.signedPack ?? false;
  const disabled = !lease || !signedPack || busy;

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    if (!lease) {
      setError('Pick a lease first.');
      return;
    }
    if (passphrase.length < MIN_PASSPHRASE_LEN) {
      setError(`Passphrase must be at least ${MIN_PASSPHRASE_LEN} characters.`);
      return;
    }
    const expiresMs = Date.parse(`${expiry}T23:59:59Z`);
    if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
      setError('Expiry must be a future date.');
      return;
    }
    setBusy(true);
    try {
      await onGenerate({
        leaseId: lease.id,
        passphrase,
        expiresAt: new Date(expiresMs).toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate archive.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="share-review-panel" onSubmit={handleSubmit} aria-label="Share review">
      <h3>Share for review</h3>
      <p>
        Generates an expiring, key-protected <code>.lgreview</code> file.
        The recipient opens it locally; nothing leaves your device.
      </p>
      {lease ? (
        <p>
          Lease: <strong>{lease.name}</strong>
          {!signedPack && (
            <>
              {' '}
              <Badge variant="severity" severity="info">
                Signed pack required
              </Badge>{' '}
              <span role="alert">Requires a signed pack to share.</span>
            </>
          )}
        </p>
      ) : (
        <>
          <Badge variant="severity" severity="high">
            Error
          </Badge>{' '}
          <p role="alert">No lease selected.</p>
        </>
      )}
      <input
        type="password"
        aria-label="Passphrase"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        autoComplete="new-password"
      />
      <label>
        Expires on
        <input
          type="date"
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
        />
      </label>
      {error && (
        <>
          <Badge variant="severity" severity="high">
            Error
          </Badge>{' '}
          <p role="alert" className="error">
            {error}
          </p>
        </>
      )}
      <button type="submit" disabled={disabled}>
        {busy ? 'Generating…' : 'Generate review link'}
      </button>
    </form>
  );
}

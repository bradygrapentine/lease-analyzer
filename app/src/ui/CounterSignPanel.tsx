import { useState } from 'react';
import { Badge } from './system/Badge';
import { StatusMessage } from './primitives/StatusMessage';
import { MIN_PASSPHRASE_LEN } from '../security/passphrase';

/**
 * Wave 9 Part B — passphrase prompt + sign-and-export trigger for a
 * counter-signed redline patch. Pure presentational: the parent owns the
 * actual `.lgpatch` byte production via the `onSign` callback so this
 * component never touches IDB or `crypto.subtle` directly.
 */

export interface CounterSignDecision {
  editId: string;
  accepted: boolean;
}

export interface CounterSignPanelProps {
  decisions: CounterSignDecision[];
  archiveFingerprint: string;
  onSign: (input: {
    passphrase: string;
    decisions: CounterSignDecision[];
  }) => Promise<Uint8Array>;
}

export function CounterSignPanel({
  decisions,
  archiveFingerprint,
  onSign,
}: CounterSignPanelProps): JSX.Element {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSign = passphrase.trim().length >= MIN_PASSPHRASE_LEN && !busy;

  async function handleSign(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      await onSign({ passphrase, decisions });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Sign failed';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="counter-sign">
      <h3>Sign &amp; export patch</h3>
      <p>
        <span aria-label="archive fingerprint">{archiveFingerprint.slice(0, 12)}…</span>
        {' · '}
        {decisions.length} decision{decisions.length === 1 ? '' : 's'}
      </p>
      <label>
        Passphrase
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          autoComplete="off"
          minLength={MIN_PASSPHRASE_LEN}
        />
      </label>
      <button
        type="button"
        onClick={() => {
          void handleSign();
        }}
        disabled={!canSign}
      >
        Sign &amp; export
      </button>
      {error ? (
        <>
          <Badge variant="severity" severity="high">
            Sign failed
          </Badge>{' '}
          <StatusMessage tone="error">{error}</StatusMessage>
        </>
      ) : null}
    </section>
  );
}

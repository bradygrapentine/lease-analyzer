export interface SigningKeyState {
  /** base64 raw public key, or null if no key exists. */
  publicKey: string | null;
}

/**
 * Wave 8 Part D — per-key history row surfaced in the panel. The fingerprint
 * is a stable hex digest of the public key (caller computes it; the panel
 * just renders).
 */
export interface KeyHistoryEntry {
  id: string;
  publicKey: string;
  fingerprint: string;
  createdAt: number;
  retiredAt: number | null;
}

export interface SigningKeyPanelProps {
  state: SigningKeyState;
  /** Prompted-for-passphrase create-key callback; panel calls with the passphrase. */
  onCreateKey: (passphrase: string) => void | Promise<void>;
  /** Copy the current public key somewhere (clipboard). Only called when key exists. */
  onExportPublicKey: (publicKey: string) => void | Promise<void>;
  /** Wave 8 Part D — rotate the active signing key, generating a new keypair. */
  onRotateKey?: (passphrase: string) => void | Promise<void>;
  /** Wave 8 Part D — full key history (active + retired) for display. */
  keys?: KeyHistoryEntry[];
}

export function SigningKeyPanel({
  state,
  onCreateKey,
  onExportPublicKey,
  onRotateKey,
  keys,
}: SigningKeyPanelProps): JSX.Element {
  const hasKey = state.publicKey !== null;
  return (
    <section aria-label="signing key">
      <h2>Signing key</h2>
      {hasKey ? (
        <p>
          <span aria-label="public key">Key: </span>
          <code>{truncate(state.publicKey ?? '')}</code>
        </p>
      ) : (
        <p>No signing key.</p>
      )}
      {!hasKey && (
        <button
          type="button"
          onClick={() => {
            const pp = window.prompt('Set a passphrase for the new signing key:');
            if (!pp) return;
            void onCreateKey(pp);
          }}
        >
          Create key
        </button>
      )}
      {hasKey && (
        <button
          type="button"
          onClick={() => {
            if (state.publicKey) void onExportPublicKey(state.publicKey);
          }}
        >
          Export public key
        </button>
      )}
      {hasKey && onRotateKey && (
        <button
          type="button"
          onClick={() => {
            const pp = window.prompt(
              'Set a passphrase for the new (rotated) signing key:',
            );
            if (!pp) return;
            void onRotateKey(pp);
          }}
        >
          Rotate key
        </button>
      )}
      {keys && keys.length > 0 && (
        <ul aria-label="key history">
          {keys.map((k) => (
            <li key={k.id}>
              <span>{k.id}</span>
              {' — '}
              <code>{truncate(k.fingerprint)}</code>
              {' — '}
              {k.retiredAt === null ? (
                <span>active</span>
              ) : (
                <span>retired @ {new Date(k.retiredAt).toISOString()}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function truncate(s: string): string {
  if (s.length <= 16) return s;
  return `${s.slice(0, 8)}…${s.slice(-6)}`;
}

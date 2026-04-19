export interface SigningKeyState {
  /** base64 raw public key, or null if no key exists. */
  publicKey: string | null;
}

export interface SigningKeyPanelProps {
  state: SigningKeyState;
  /** Prompted-for-passphrase create-key callback; panel calls with the passphrase. */
  onCreateKey: (passphrase: string) => void | Promise<void>;
  /** Copy the current public key somewhere (clipboard). Only called when key exists. */
  onExportPublicKey: (publicKey: string) => void | Promise<void>;
}

export function SigningKeyPanel({
  state,
  onCreateKey,
  onExportPublicKey,
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
    </section>
  );
}

function truncate(s: string): string {
  if (s.length <= 16) return s;
  return `${s.slice(0, 8)}…${s.slice(-6)}`;
}

// Wave 27-C — design pass rewrite.
// Semantic attributes preserved verbatim:
//   aria-label="signing key"   (section)
//   aria-label="public key"    (span)
//   aria-label="key history"   (ul)
//
import { Section } from './system/Section';
import { Button } from './system/Button';

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
    <Section label="signing key" className="space-y-3 px-4 py-4">
      <h2 className="text-heading uppercase text-fg-muted">Signing key</h2>
      <details className="text-small text-fg-muted">
        <summary className="cursor-pointer select-none">Why does signing matter?</summary>
        <p className="mt-1 max-w-prose">
          A signed export pairs your findings with a signature derived from a key only you control.
          Anyone you share the file with can verify it came from you and has not been altered. The
          key never leaves your browser.
        </p>
      </details>
      {hasKey ? (
        <p className="text-body text-fg-body">
          <span aria-label="public key" className="text-small text-fg-muted">
            Key:{' '}
          </span>
          <code className="font-mono text-mono text-fg-muted">
            {truncate(state.publicKey ?? '')}
          </code>
        </p>
      ) : (
        <p className="text-body text-fg-muted">No signing key.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {!hasKey && (
          <Button
            variant="subtle"
            size="sm"
            onClick={() => {
              const pp = window.prompt('Set a passphrase for the new signing key:');
              if (!pp) return;
              void onCreateKey(pp);
            }}
          >
            Create key
          </Button>
        )}
        {hasKey && (
          <Button
            variant="subtle"
            size="sm"
            onClick={() => {
              if (state.publicKey) void onExportPublicKey(state.publicKey);
            }}
          >
            Export public key
          </Button>
        )}
        {hasKey && onRotateKey && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const pp = window.prompt('Set a passphrase for the new (rotated) signing key:');
              if (!pp) return;
              void onRotateKey(pp);
            }}
          >
            Rotate key
          </Button>
        )}
      </div>
      {keys && keys.length > 0 && (
        <ul aria-label="key history" className="space-y-1 mt-2">
          {keys.map((k) => (
            <li key={k.id} className="text-small text-fg-muted">
              <span>{k.id}</span>
              {' — '}
              <code className="font-mono text-mono">{truncate(k.fingerprint)}</code>
              {' — '}
              {k.retiredAt === null ? (
                <span className="text-positive">active</span>
              ) : (
                <span>retired @ {new Date(k.retiredAt).toISOString()}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function truncate(s: string): string {
  if (s.length <= 16) return s;
  return `${s.slice(0, 8)}…${s.slice(-6)}`;
}

// Wave 27-C — design pass rewrite.
// Wave 46 — fingerprint row + clipboard status (success / denied) for
// Export public key and Copy fingerprint.
// Semantic attributes preserved verbatim:
//   aria-label="signing key"   (section)
//   aria-label="public key"    (span)
//   aria-label="key history"   (ul)
//
import { useEffect, useRef, useState } from 'react';
import { Section } from './system/Section';
import { Button } from './system/Button';
import { Badge } from './system/Badge';
import { computeShortFingerprintFromBase64 } from '../security/fingerprint';
import type { ClipboardWriteStatus } from '../App/useSigningKey';

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
  /**
   * Copy the current public key to the clipboard. Only called when key
   * exists. Returns a discriminated status the panel renders as a transient
   * `role="status"` confirmation (success) or persistent failure message.
   * When the caller cannot return a status (legacy void / Promise<void>),
   * the panel treats the call as success.
   */
  onExportPublicKey: (publicKey: string) => void | Promise<void> | Promise<ClipboardWriteStatus>;
  /** Wave 8 Part D — rotate the active signing key, generating a new keypair. */
  onRotateKey?: (passphrase: string) => void | Promise<void>;
  /** Wave 8 Part D — full key history (active + retired) for display. */
  keys?: KeyHistoryEntry[];
}

type CopyStatus = { kind: 'idle' } | { kind: 'copied' } | { kind: 'denied'; reason: string };

const COPIED_TIMEOUT_MS = 4000;

export function SigningKeyPanel({
  state,
  onCreateKey,
  onExportPublicKey,
  onRotateKey,
  keys,
}: SigningKeyPanelProps): JSX.Element {
  const hasKey = state.publicKey !== null;

  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<CopyStatus>({ kind: 'idle' });
  const [fingerprintStatus, setFingerprintStatus] = useState<CopyStatus>({ kind: 'idle' });
  const exportTimer = useRef<number | null>(null);
  const fingerprintTimer = useRef<number | null>(null);

  // Compute the short fingerprint whenever publicKey changes.
  useEffect(() => {
    let cancelled = false;
    if (!state.publicKey) {
      setFingerprint(null);
      return;
    }
    void computeShortFingerprintFromBase64(state.publicKey).then((fp) => {
      if (!cancelled) setFingerprint(fp);
    });
    return () => {
      cancelled = true;
    };
  }, [state.publicKey]);

  // Auto-clear the success status after COPIED_TIMEOUT_MS. Failures persist
  // until the next user action (handled in the click handlers below).
  useEffect(() => {
    if (exportStatus.kind !== 'copied') return;
    exportTimer.current = window.setTimeout(() => {
      setExportStatus({ kind: 'idle' });
    }, COPIED_TIMEOUT_MS);
    return () => {
      if (exportTimer.current !== null) window.clearTimeout(exportTimer.current);
      exportTimer.current = null;
    };
  }, [exportStatus]);
  useEffect(() => {
    if (fingerprintStatus.kind !== 'copied') return;
    fingerprintTimer.current = window.setTimeout(() => {
      setFingerprintStatus({ kind: 'idle' });
    }, COPIED_TIMEOUT_MS);
    return () => {
      if (fingerprintTimer.current !== null) window.clearTimeout(fingerprintTimer.current);
      fingerprintTimer.current = null;
    };
  }, [fingerprintStatus]);

  async function handleExportPublicKey(): Promise<void> {
    if (!state.publicKey) return;
    setExportStatus({ kind: 'idle' });
    try {
      const out = await onExportPublicKey(state.publicKey);
      if (out && typeof out === 'object' && 'status' in out) {
        if (out.status === 'copied') setExportStatus({ kind: 'copied' });
        else setExportStatus({ kind: 'denied', reason: out.reason });
      } else {
        // Caller did not return a status (legacy void). Treat as success.
        setExportStatus({ kind: 'copied' });
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      setExportStatus({ kind: 'denied', reason });
    }
  }

  async function handleCopyFingerprint(): Promise<void> {
    if (!fingerprint) return;
    setFingerprintStatus({ kind: 'idle' });
    const nav = globalThis.navigator as
      | { clipboard?: { writeText?: (s: string) => Promise<void> } }
      | undefined;
    const writeText = nav?.clipboard?.writeText;
    if (typeof writeText !== 'function') {
      setFingerprintStatus({
        kind: 'denied',
        reason: 'Clipboard API unavailable in this context.',
      });
      return;
    }
    try {
      await writeText.call(nav!.clipboard, fingerprint);
      setFingerprintStatus({ kind: 'copied' });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      setFingerprintStatus({ kind: 'denied', reason });
    }
  }

  return (
    <Section label="signing key" className="space-y-3 px-4 py-4">
      <h2 className="text-heading uppercase text-fg-muted">Signing key</h2>
      <details className="text-small text-fg-muted">
        <summary className="cursor-pointer select-none">Why does signing matter?</summary>
        <p className="mt-1 max-w-prose">
          A signed export carries a digital signature made with this local key. The 8-character
          fingerprint shown below is the first 4 bytes of SHA-256 over the public key, in hex. To
          use a signed export as proof of origin, share that fingerprint with the recipient
          out-of-band (phone, encrypted message, paper). The recipient computes the same SHA-256
          fingerprint over the public key embedded in the signed export and checks the match. A
          match is evidence the embedded key was not substituted; it does not by itself prove
          identity.
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
      {hasKey && (
        <div className="text-small text-fg-muted">
          <span>Fingerprint: </span>
          <code aria-label="public key fingerprint" className="font-mono text-mono text-fg-body">
            {fingerprint ?? '...'}
          </code>{' '}
          <Button
            type="button"
            variant="subtle"
            size="sm"
            onClick={() => void handleCopyFingerprint()}
            disabled={fingerprint === null}
          >
            Copy fingerprint
          </Button>
          {fingerprintStatus.kind === 'copied' && (
            <p role="status" className="text-small text-fg-muted mt-1">
              Fingerprint copied to clipboard.
            </p>
          )}
          {fingerprintStatus.kind === 'denied' && (
            <p
              role="status"
              className="text-small text-severity-high mt-1 inline-flex items-center gap-2"
            >
              <Badge severity="high" variant="severity">
                Copy failed
              </Badge>
              <span>
                Could not copy: {fingerprintStatus.reason}. Copy the fingerprint manually from the
                field above.
              </span>
            </p>
          )}
        </div>
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
          <Button variant="subtle" size="sm" onClick={() => void handleExportPublicKey()}>
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
      {exportStatus.kind === 'copied' && (
        <p role="status" className="text-small text-fg-muted mt-1">
          Public key copied to clipboard.
        </p>
      )}
      {exportStatus.kind === 'denied' && (
        <p
          role="status"
          className="text-small text-severity-high mt-1 inline-flex items-center gap-2"
        >
          <Badge severity="high" variant="severity">
            Copy failed
          </Badge>
          <span>
            Could not copy: {exportStatus.reason}. Copy the key manually from the field above.
          </span>
        </p>
      )}
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

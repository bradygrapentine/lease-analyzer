import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Badge } from './system/Badge';
import { StatusMessage } from './primitives/StatusMessage';
import { MIN_PASSPHRASE_LEN } from '../security/passphrase';

export type OpenReviewResult =
  | { ok: true; archiveId: string; expiresAt: string }
  | { ok: false; reason: 'wrong-passphrase' | 'expired' | 'missing-pack' | 'malformed' };

export interface OpenReviewPanelProps {
  onOpen: (input: { bytes: Uint8Array; passphrase: string }) => Promise<OpenReviewResult>;
}

const REASON_MESSAGES: Record<
  Extract<OpenReviewResult, { ok: false }>['reason'],
  string
> = {
  'wrong-passphrase': 'Wrong or incorrect key — check what you typed.',
  expired: 'This review archive has expired.',
  'missing-pack': 'Missing rule pack — install the matching signed pack.',
  malformed: 'This file is not a LeaseGuard review archive.',
};

async function readFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    try {
      return new Uint8Array(await file.arrayBuffer());
    } catch {
      // fall through to FileReader
    }
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const buf = reader.result;
      if (buf instanceof ArrayBuffer) resolve(new Uint8Array(buf));
      else reject(new Error('Could not read file.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file.'));
    reader.readAsArrayBuffer(file);
  });
}

export function OpenReviewPanel({ onOpen }: OpenReviewPanelProps): JSX.Element {
  const [file, setFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ archiveId: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function handleFile(event: ChangeEvent<HTMLInputElement>): void {
    setError(null);
    setSuccess(null);
    const next = event.target.files?.[0] ?? null;
    setFile(next);
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError('Choose a .lgreview file first.');
      return;
    }
    if (!passphrase) {
      setError('Enter the passphrase.');
      return;
    }
    setBusy(true);
    try {
      const bytes = await readFileBytes(file);
      const result = await onOpen({ bytes, passphrase });
      if (result.ok) {
        setSuccess({ archiveId: result.archiveId, expiresAt: result.expiresAt });
      } else {
        setError(REASON_MESSAGES[result.reason]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open archive.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="open-review-panel" onSubmit={handleSubmit} aria-label="Open review">
      <h3>Open a review archive</h3>
      <p>
        Drop a <code>.lgreview</code> file. The lease will mount as a
        non-editable session — your audit log records this session separately
        and writes back to the original lease are gated off.
      </p>
      <label>
        Review archive file
        <input
          type="file"
          accept=".lgreview,application/octet-stream"
          onChange={handleFile}
        />
      </label>
      <input
        type="password"
        aria-label="Passphrase"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        autoComplete="current-password"
        minLength={MIN_PASSPHRASE_LEN}
      />
      {error && (
        <>
          <Badge variant="severity" severity="high">
            Error
          </Badge>{' '}
          <StatusMessage tone="error">{error}</StatusMessage>
        </>
      )}
      {success && (
        <StatusMessage tone="success">
          Mounted in review mode (archive {success.archiveId}, expires{' '}
          {success.expiresAt}).
        </StatusMessage>
      )}
      <button type="submit" disabled={busy || passphrase.length < MIN_PASSPHRASE_LEN}>
        {busy ? 'Opening…' : 'Open review'}
      </button>
    </form>
  );
}

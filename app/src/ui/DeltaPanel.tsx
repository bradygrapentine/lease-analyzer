import { useState } from 'react';

interface VersionRow {
  id: string;
  label: string;
}

interface DeltaPanelProps {
  versions: VersionRow[];
  onGenerate: (input: {
    baseVersionId: string;
    targetVersionId: string;
    passphrase: string;
  }) => Promise<Uint8Array>;
}

export function DeltaPanel({ versions, onGenerate }: DeltaPanelProps): JSX.Element {
  const [baseId, setBaseId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready =
    baseId !== '' && targetId !== '' && baseId !== targetId && passphrase.length >= 12;

  async function handleGenerate(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      await onGenerate({ baseVersionId: baseId, targetVersionId: targetId, passphrase });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="delta-panel-heading">
      <h2 id="delta-panel-heading">Generate delta packet</h2>
      <p>
        Pick two saved versions to produce a signed `.lgdelta` patch the
        recipient can verify and apply on their local copy.
      </p>
      <div>
        <label htmlFor="delta-base">Base version</label>
        <select
          id="delta-base"
          value={baseId}
          onChange={(e): void => setBaseId(e.target.value)}
        >
          <option value="">Select base…</option>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="delta-target">Target version</label>
        <select
          id="delta-target"
          value={targetId}
          onChange={(e): void => setTargetId(e.target.value)}
        >
          <option value="">Select target…</option>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="delta-passphrase">Signing passphrase</label>
        <input
          id="delta-passphrase"
          type="password"
          value={passphrase}
          onChange={(e): void => setPassphrase(e.target.value)}
          autoComplete="off"
        />
      </div>
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        disabled={!ready || busy}
        onClick={(): void => {
          void handleGenerate();
        }}
      >
        {busy ? 'Generating…' : 'Generate delta'}
      </button>
    </section>
  );
}

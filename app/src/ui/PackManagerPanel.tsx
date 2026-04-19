import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { RulePackFile } from '../rules/packSchema';

interface PackManagerPanelProps {
  builtInName: string;
  installed: RulePackFile[];
  enabled: Set<string>;
  onImport: (file: File) => Promise<void>;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
}

export function PackManagerPanel({
  builtInName,
  installed,
  enabled,
  onImport,
  onToggle,
  onDelete,
}: PackManagerPanelProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    // Reset so selecting the same file twice re-triggers onChange.
    e.target.value = '';
    if (!file) return;
    setStatus(null);
    setError(null);
    try {
      await onImport(file);
      setStatus(`Imported ${file.name}`);
    } catch (err) {
      setError((err as Error).message || 'Import failed');
    }
  }

  return (
    <section aria-label="rule packs">
      <h2>Rule packs</h2>
      <ul>
        <li>
          <strong>{builtInName}</strong> <em>(built-in)</em>
        </li>
        {installed.map((p) => (
          <li key={p.id}>
            <label>
              <input
                type="checkbox"
                aria-label={`Enable pack ${p.id}`}
                checked={enabled.has(p.id)}
                onChange={(e) => onToggle(p.id, e.target.checked)}
              />
              <strong>{p.name}</strong>{' '}
              <small>
                v{p.version} · {p.rules.length} rule{p.rules.length === 1 ? '' : 's'}
              </small>
            </label>
            <button
              type="button"
              onClick={() => onDelete(p.id)}
              aria-label={`Delete pack ${p.id}`}
            >
              Delete
            </button>
          </li>
        ))}
        {installed.length === 0 && (
          <li>
            <em>No additional packs installed.</em>
          </li>
        )}
      </ul>

      <label htmlFor="pack-import-input">Import rule pack</label>
      <input
        id="pack-import-input"
        ref={inputRef}
        type="file"
        accept=".lgpack.json,application/json"
        onChange={(e) => {
          void handleFile(e);
        }}
      />

      {status !== null && <p role="status">{status}</p>}
      {error !== null && <p role="status">Error: {error}</p>}
    </section>
  );
}

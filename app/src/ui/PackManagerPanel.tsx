import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { RulePackFile } from '../rules/packSchema';
import {
  MarketplacePanel,
  type MarketplacePanelProps,
} from './MarketplacePanel';

/**
 * Signature trust vocabulary surfaced in the panel. Intentionally a
 * superset of the storage-layer statuses: "community" covers packs that
 * were imported without an envelope (storage calls those "unsigned"),
 * while "verified" and "invalid" mean exactly what they do on disk.
 * Anything outside this set (including missing) falls back to
 * "community" so legacy callers keep rendering.
 */
export type PackSignatureBadge = 'verified' | 'community' | 'invalid' | 'unknown';

interface PackManagerPanelProps {
  builtInName: string;
  installed: RulePackFile[];
  enabled: Set<string>;
  onImport: (file: File) => Promise<void>;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  /**
   * Per-pack signature badge. Optional so existing call sites (notably
   * App.tsx until its wire-up pass) stay valid; any pack missing from
   * the map renders as "community".
   */
  signatureStatusByPackId?: Record<string, PackSignatureBadge>;
  /**
   * Optional curated marketplace wiring. When provided, the panel
   * exposes a "Browse included packs" toggle that mounts the
   * MarketplacePanel inline. Same-origin only — no network egress.
   */
  marketplace?: MarketplacePanelProps;
}

function badgeLabel(status: PackSignatureBadge): string {
  switch (status) {
    case 'verified':
      return 'Verified';
    case 'invalid':
      return 'Invalid signature';
    case 'unknown':
      return 'Unknown';
    case 'community':
    default:
      return 'Community';
  }
}

export function PackManagerPanel({
  builtInName,
  installed,
  enabled,
  onImport,
  onToggle,
  onDelete,
  signatureStatusByPackId,
  marketplace,
}: PackManagerPanelProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);

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
        {installed.map((p) => {
          const status: PackSignatureBadge =
            signatureStatusByPackId?.[p.id] ?? 'community';
          return (
            <li key={p.id}>
              <label>
                <input
                  type="checkbox"
                  aria-label={`Enable pack ${p.id}`}
                  checked={enabled.has(p.id)}
                  onChange={(e) => onToggle(p.id, e.target.checked)}
                />
                <strong>{p.name}</strong>{' '}
                <span
                  aria-label={`Signature status: ${badgeLabel(status)}`}
                  data-signature-status={status}
                >
                  [{badgeLabel(status)}]
                </span>{' '}
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
          );
        })}
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

      {marketplace !== undefined && (
        <div>
          <button
            type="button"
            onClick={() => setBrowseOpen((v) => !v)}
            aria-expanded={browseOpen}
          >
            {browseOpen ? 'Hide included packs' : 'Browse included packs'}
          </button>
          {browseOpen && <MarketplacePanel {...marketplace} />}
        </div>
      )}
    </section>
  );
}

// Wave 27-C — design pass rewrite.
// Semantic attributes preserved verbatim:
//   aria-label="rule packs"                          (section)
//   aria-label={`Enable pack ${p.id}`}               (checkbox)
//   aria-label={`Signature status: ${badgeLabel(status)}`} (span)
//   data-signature-status={status}                   (span)
//   aria-label={`Delete pack ${p.id}`}               (button)
//   role="status"                                    (p — status/error messages)
//   aria-expanded={browseOpen}                       (button — marketplace toggle)
//
import { useState } from 'react';
import type { RulePackFile } from '../rules/packSchema';
import { MarketplacePanel, type MarketplacePanelProps } from './MarketplacePanel';
import { Section } from './system/Section';
import { Button } from './system/Button';
import { FileButton } from './system/FileButton';

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

const BADGE_CLASS: Record<PackSignatureBadge, string> = {
  verified: 'bg-positive/10 text-positive border-positive/30',
  invalid: 'bg-severity-high/10 text-severity-high border-severity-high/30',
  unknown: 'bg-paper-sunken text-fg-muted border-rule',
  community: 'bg-paper-sunken text-fg-muted border-rule',
};

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
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);

  async function handleFiles(files: FileList): Promise<void> {
    const file = files[0];
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
    <Section label="rule packs" className="space-y-3 px-4 py-4">
      <h2 className="text-heading uppercase text-fg-muted">Rule packs</h2>
      <ul className="space-y-2">
        <li className="rounded-sm border border-rule bg-paper-raised shadow-paper px-3 py-2 text-body text-fg-muted">
          <strong className="text-fg-body">{builtInName}</strong> <em>(built-in)</em>
        </li>
        {installed.map((p) => {
          const sig: PackSignatureBadge = signatureStatusByPackId?.[p.id] ?? 'community';
          return (
            <li
              key={p.id}
              className="rounded-sm border border-rule bg-paper-raised shadow-paper px-3 py-2 flex items-start gap-2"
            >
              <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                <input
                  type="checkbox"
                  aria-label={`Enable pack ${p.id}`}
                  checked={enabled.has(p.id)}
                  className="rounded-sm"
                  onChange={(e) => onToggle(p.id, e.target.checked)}
                />
                <span className="text-body text-fg-body font-sans">
                  <strong>{p.name}</strong>
                </span>
                <span
                  aria-label={`Signature status: ${badgeLabel(sig)}`}
                  data-signature-status={sig}
                  className={`inline-flex items-center px-1.5 py-0.5 rounded-sm border text-small font-sans ${BADGE_CLASS[sig]}`}
                >
                  {badgeLabel(sig)}
                </span>
                <small className="text-small text-fg-muted">
                  v{p.version} · {p.rules.length} rule{p.rules.length === 1 ? '' : 's'}
                </small>
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onDelete(p.id)}
                aria-label={`Delete pack ${p.id}`}
              >
                Delete
              </Button>
            </li>
          );
        })}
        {installed.length === 0 && (
          <li className="text-body text-fg-muted">
            <em>No additional packs installed.</em>
          </li>
        )}
      </ul>

      <div className="space-y-1">
        <p className="text-small text-fg-muted font-sans">Import rule pack</p>
        <FileButton
          variant="subtle"
          size="md"
          accept=".lgpack.json,application/json"
          aria-label="Import rule pack"
          onFiles={(files) => void handleFiles(files)}
        >
          Choose pack file
        </FileButton>
      </div>

      {status !== null && (
        <p role="status" className="text-small text-positive">
          {status}
        </p>
      )}
      {error !== null && (
        <p role="status" className="text-small text-severity-high">
          Error: {error}
        </p>
      )}

      {marketplace !== undefined && (
        <div className="border-t border-rule pt-3 space-y-2">
          <Button
            type="button"
            variant="subtle"
            size="sm"
            onClick={() => setBrowseOpen((v) => !v)}
            aria-expanded={browseOpen}
          >
            {browseOpen ? 'Hide included packs' : 'Browse included packs'}
          </Button>
          {browseOpen && <MarketplacePanel {...marketplace} />}
        </div>
      )}
    </Section>
  );
}

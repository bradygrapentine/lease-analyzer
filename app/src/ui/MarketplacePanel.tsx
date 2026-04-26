import { useEffect, useState } from 'react';
import type { CuratedPackEntry } from '../rules/curatedPacks';

export interface MarketplaceDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

export interface MarketplaceInstallResult {
  ok: boolean;
  signature: 'verified' | 'invalid';
}

export interface MarketplacePanelProps {
  loadManifest: () => Promise<CuratedPackEntry[]>;
  onInstall: (entry: CuratedPackEntry) => Promise<MarketplaceInstallResult>;
  onPreviewDiff: (entry: CuratedPackEntry) => Promise<MarketplaceDiff>;
}

type InstallState =
  | { kind: 'idle' }
  | { kind: 'installing' }
  | { kind: 'success'; signature: 'verified' | 'invalid' }
  | { kind: 'error'; message: string; signature?: 'invalid' };

interface PerEntryState {
  install: InstallState;
  diff: MarketplaceDiff | null;
}

function emptyState(): PerEntryState {
  return { install: { kind: 'idle' }, diff: null };
}

export function MarketplacePanel({
  loadManifest,
  onInstall,
  onPreviewDiff,
}: MarketplacePanelProps): JSX.Element {
  const [entries, setEntries] = useState<CuratedPackEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [perEntry, setPerEntry] = useState<Record<string, PerEntryState>>({});

  useEffect(() => {
    let cancelled = false;
    loadManifest()
      .then((list) => {
        if (cancelled) return;
        setEntries(list);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError((err as Error).message || 'failed to load manifest');
      });
    return () => {
      cancelled = true;
    };
  }, [loadManifest]);

  function setEntryState(id: string, next: Partial<PerEntryState>): void {
    setPerEntry((prev) => {
      const cur = prev[id] ?? emptyState();
      return { ...prev, [id]: { ...cur, ...next } };
    });
  }

  async function handleInstall(entry: CuratedPackEntry): Promise<void> {
    setEntryState(entry.id, { install: { kind: 'installing' } });
    try {
      const result = await onInstall(entry);
      setEntryState(entry.id, {
        install: { kind: 'success', signature: result.signature },
      });
    } catch (err) {
      setEntryState(entry.id, {
        install: {
          kind: 'error',
          message: (err as Error).message || 'install failed',
        },
      });
    }
  }

  async function handleDiff(entry: CuratedPackEntry): Promise<void> {
    const diff = await onPreviewDiff(entry);
    setEntryState(entry.id, { diff });
  }

  if (loadError !== null) {
    return (
      <section aria-label="curated rule packs">
        <h2>Curated rule packs</h2>
        <p role="status">Error: {loadError}</p>
      </section>
    );
  }

  if (entries === null) {
    return (
      <section aria-label="curated rule packs">
        <h2>Curated rule packs</h2>
        <p role="status">Loading curated packs…</p>
      </section>
    );
  }

  if (entries.length === 0) {
    return (
      <section aria-label="curated rule packs">
        <h2>Curated rule packs</h2>
        <p role="status">No curated packs are currently available.</p>
      </section>
    );
  }

  return (
    <section aria-label="curated rule packs">
      <h2>Curated rule packs</h2>
      <ul>
        {entries.map((entry) => {
          const state = perEntry[entry.id] ?? emptyState();
          const sig: 'verified' | 'invalid' =
            state.install.kind === 'success' ? state.install.signature : 'verified';
          return (
            <li key={entry.id}>
              <strong>{entry.name}</strong>{' '}
              <span aria-label={`Signature status: ${sig}`} data-signature-status={sig}>
                [{sig === 'verified' ? 'Verified' : 'Invalid signature'}]
              </span>
              <p>{entry.description}</p>
              <small>
                {entry.jurisdictions.join(', ')} · by {entry.author}
              </small>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    void handleInstall(entry);
                  }}
                  aria-label={`Install ${entry.name}`}
                  disabled={state.install.kind === 'installing'}
                >
                  Install
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleDiff(entry);
                  }}
                  aria-label={`View diff vs current for ${entry.name}`}
                >
                  View diff vs current
                </button>
              </div>
              {state.install.kind === 'success' && (
                <p role="status">Installed ({state.install.signature}).</p>
              )}
              {state.install.kind === 'error' && (
                <p role="status">Install failed: {state.install.message}</p>
              )}
              {state.diff !== null && (
                <dl>
                  <dt>Added</dt>
                  <dd>{state.diff.added.join(', ') || '(none)'}</dd>
                  <dt>Removed</dt>
                  <dd>{state.diff.removed.join(', ') || '(none)'}</dd>
                  <dt>Changed</dt>
                  <dd>{state.diff.changed.join(', ') || '(none)'}</dd>
                </dl>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

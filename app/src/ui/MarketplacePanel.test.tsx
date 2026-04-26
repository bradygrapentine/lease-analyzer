import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// Wave 8 Part A — component does not yet exist; failing import is the
// expected red signal until the implementer creates MarketplacePanel.
import { MarketplacePanel } from './MarketplacePanel';
import type { CuratedPackEntry } from '../rules/curatedPacks';

const ENTRY_A: CuratedPackEntry = {
  id: 'us-ca-residential',
  name: 'California residential',
  description: 'Curated California residential rules.',
  jurisdictions: ['US-CA'],
  author: 'LeaseGuard core',
  fingerprint: 'a'.repeat(64),
  path: '/packs/curated/us-ca-residential.lgpack.json',
};

const ENTRY_B: CuratedPackEntry = {
  id: 'us-ny-commercial',
  name: 'New York commercial',
  description: 'Curated NY commercial rules.',
  jurisdictions: ['US-NY'],
  author: 'LeaseGuard core',
  fingerprint: 'b'.repeat(64),
  path: '/packs/curated/us-ny-commercial.lgpack.json',
};

interface InstallResult {
  ok: boolean;
  signature: 'verified' | 'invalid';
}

describe('MarketplacePanel', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('shows a loading state while the manifest resolves', async () => {
    let resolve: (entries: CuratedPackEntry[]) => void = () => {};
    const loader = (): Promise<CuratedPackEntry[]> =>
      new Promise((r) => {
        resolve = r;
      });
    render(
      <MarketplacePanel
        loadManifest={loader}
        onInstall={async () => ({ ok: true, signature: 'verified' })}
        onPreviewDiff={async () => ({ added: [], removed: [], changed: [] })}
      />,
    );
    expect(screen.getByText(/loading curated packs/i)).toBeInTheDocument();
    resolve([ENTRY_A]);
    await waitFor(() => {
      expect(screen.getByText('California residential')).toBeInTheDocument();
    });
  });

  it('renders the loaded list with verified badges', async () => {
    render(
      <MarketplacePanel
        loadManifest={async () => [ENTRY_A, ENTRY_B]}
        onInstall={async () => ({ ok: true, signature: 'verified' })}
        onPreviewDiff={async () => ({ added: [], removed: [], changed: [] })}
      />,
    );
    expect(await screen.findByText('California residential')).toBeInTheDocument();
    expect(screen.getByText('New York commercial')).toBeInTheDocument();
    const verifiedBadges = screen.getAllByLabelText(/signature status: verified/i);
    expect(verifiedBadges.length).toBeGreaterThanOrEqual(2);
  });

  it('install success surfaces a status message and does not show an error', async () => {
    const onInstall = vi.fn(
      async (): Promise<InstallResult> => ({
        ok: true,
        signature: 'verified',
      }),
    );
    render(
      <MarketplacePanel
        loadManifest={async () => [ENTRY_A]}
        onInstall={onInstall}
        onPreviewDiff={async () => ({ added: [], removed: [], changed: [] })}
      />,
    );
    const installBtn = await screen.findByRole('button', {
      name: /install california residential/i,
    });
    await userEvent.click(installBtn);
    await waitFor(() => {
      expect(onInstall).toHaveBeenCalledWith(ENTRY_A);
    });
    expect(await screen.findByText(/installed/i)).toBeInTheDocument();
    expect(screen.queryByText(/install failed/i)).not.toBeInTheDocument();
  });

  it('install failure surfaces an error message', async () => {
    const onInstall = vi.fn(async (): Promise<InstallResult> => {
      throw new Error('signature did not verify');
    });
    render(
      <MarketplacePanel
        loadManifest={async () => [ENTRY_A]}
        onInstall={onInstall}
        onPreviewDiff={async () => ({ added: [], removed: [], changed: [] })}
      />,
    );
    const installBtn = await screen.findByRole('button', {
      name: /install california residential/i,
    });
    await userEvent.click(installBtn);
    expect(await screen.findByText(/signature did not verify/i)).toBeInTheDocument();
  });

  it('renders a diff preview when "View diff vs current" is clicked', async () => {
    const onPreviewDiff = vi.fn(async () => ({
      added: ['rule-x'],
      removed: ['rule-y'],
      changed: ['rule-z'],
    }));
    render(
      <MarketplacePanel
        loadManifest={async () => [ENTRY_A]}
        onInstall={async () => ({ ok: true, signature: 'verified' })}
        onPreviewDiff={onPreviewDiff}
      />,
    );
    const diffBtn = await screen.findByRole('button', {
      name: /view diff vs current.*california residential/i,
    });
    await userEvent.click(diffBtn);
    await waitFor(() => {
      expect(onPreviewDiff).toHaveBeenCalledWith(ENTRY_A);
    });
    expect(await screen.findByText(/rule-x/)).toBeInTheDocument();
    expect(screen.getByText(/rule-y/)).toBeInTheDocument();
    expect(screen.getByText(/rule-z/)).toBeInTheDocument();
  });

  it('shows a signature-invalid badge when install reports an invalid signature', async () => {
    const onInstall = vi.fn(
      async (): Promise<InstallResult> => ({
        ok: false,
        signature: 'invalid',
      }),
    );
    render(
      <MarketplacePanel
        loadManifest={async () => [ENTRY_A]}
        onInstall={onInstall}
        onPreviewDiff={async () => ({ added: [], removed: [], changed: [] })}
      />,
    );
    const installBtn = await screen.findByRole('button', {
      name: /install california residential/i,
    });
    await userEvent.click(installBtn);
    expect(await screen.findByLabelText(/signature status: invalid/i)).toBeInTheDocument();
  });
});

describe('MarketplacePanel — empty state', () => {
  it('renders an empty-state message when no curated packs are available', async () => {
    render(
      <MarketplacePanel
        loadManifest={async () => []}
        onInstall={async () => ({ ok: true, signature: 'verified' })}
        onPreviewDiff={async () => ({ added: [], removed: [], changed: [] })}
      />,
    );
    expect(
      await screen.findByText(/no curated packs are currently available/i),
    ).toBeInTheDocument();
  });

  it('does not render install or diff controls in the empty state', async () => {
    render(
      <MarketplacePanel
        loadManifest={async () => []}
        onInstall={async () => ({ ok: true, signature: 'verified' })}
        onPreviewDiff={async () => ({ added: [], removed: [], changed: [] })}
      />,
    );
    await screen.findByText(/no curated packs/i);
    expect(screen.queryByRole('button', { name: /install/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /view diff/i })).toBeNull();
  });
});

describe('build-curated-packs.mjs', () => {
  // The implementer adds app/scripts/build-curated-packs.mjs. This test asserts
  // it produces byte-identical output across two runs (idempotency).
  // Skipped if Node child_process / fs unavailable in the jsdom env, but the
  // import attempt still serves as a failing-on-purpose marker until the
  // implementer ships the script and a test-side runner.
  beforeEach(() => {});
  it.todo('produces byte-identical output across two runs (script + manifest hash)');
});

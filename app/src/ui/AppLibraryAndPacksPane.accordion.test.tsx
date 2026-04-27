import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppLibraryAndPacksPane } from './AppLibraryAndPacksPane';
import { I18nProvider } from '../i18n/I18nProvider';

// Wave 28 Part C — covers the accordion grouping behavior on the
// bottom pane. Three SectionGroup disclosures: `this-lease`, `library`,
// `governance`.
// Wave 30 Part B — all three groups now default *closed* and persist
// open/closed state to localStorage; tests install a working in-memory
// localStorage shim per-run (jsdom's stub lacks working get/set in this
// project) and expand groups before asserting on inner panel content.

function installMemoryLocalStorage(): void {
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      get length() {
        return store.size;
      },
      clear: () => store.clear(),
      getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      removeItem: (k: string) => {
        store.delete(k);
      },
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
    } satisfies Storage,
  });
}

function renderPane(over: Partial<React.ComponentProps<typeof AppLibraryAndPacksPane>> = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fakePacks: any = {
    installedPacks: [],
    enabledPacks: new Set(),
    importPackFile: vi.fn(async () => undefined),
    togglePack: vi.fn(),
    deletePack: vi.fn(),
    packSignatureStatus: {},
    activeRules: [],
    selectedJurisdictions: [],
    setSelectedJurisdictions: vi.fn(),
    severityOverrides: {},
    setSeverityOverride: vi.fn(),
    existingRuleIds: [],
    saveCustomRule: vi.fn(),
    comparePackFile: vi.fn(async () => undefined),
    packDiff: null,
    bulkImportFiles: vi.fn(async () => ({ summary: [], total: 0 })),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fakeSigning: any = { publicKey: null, createKey: vi.fn(), exportKeyToClipboard: vi.fn() };
  const props: React.ComponentProps<typeof AppLibraryAndPacksPane> = {
    library: [],
    standardId: null,
    templates: [],
    packs: fakePacks,
    marketplace: undefined,
    jurisdictionOptions: [],
    severityOverridesPanelRows: [],
    severityOverridesPanelMap: {},
    severityOverridesPanelOnChange: vi.fn(),
    customRuleBuilderDoc: null,
    auditEntries: [],
    auditVerification: null,
    signingKey: fakeSigning,
    comparison: null,
    onOpenLibrary: vi.fn(),
    onDeleteLibrary: vi.fn(),
    onSetStandard: vi.fn(),
    onRenameLibrary: vi.fn(),
    onCompare: vi.fn(),
    onSaveTemplate: vi.fn(),
    onUpdateTemplate: vi.fn(),
    onDeleteTemplate: vi.fn(),
    onRefreshAuditLog: vi.fn(),
    onVerifyAuditChain: vi.fn(),
    onDownloadAuditLog: vi.fn(),
    ...over,
  };
  return render(
    <I18nProvider>
      <AppLibraryAndPacksPane {...props} />
    </I18nProvider>,
  );
}

describe('AppLibraryAndPacksPane accordion grouping (Wave 28 Part C / Wave 30 Part B)', () => {
  beforeEach(() => {
    // Wave 30 B: SectionGroup persists state in localStorage. Install a
    // working in-memory shim and start each case from the fresh-install
    // all-closed default.
    installMemoryLocalStorage();
  });

  it('renders three SectionGroup disclosures with stable ids', () => {
    renderPane();
    expect(screen.getByRole('button', { name: /this lease/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^library$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /governance/i })).toBeInTheDocument();
  });

  it('all three groups are closed by default on a fresh install (Wave 30 Part B)', () => {
    renderPane();
    expect(screen.getByRole('button', { name: /this lease/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: /^library$/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: /governance/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('library group expands on header click — children enter the DOM', async () => {
    renderPane();
    expect(screen.queryByRole('heading', { name: /my leases/i })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /^library$/i }));
    expect(screen.getByRole('button', { name: /^library$/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('heading', { name: /my leases/i })).toBeInTheDocument();
  });

  it('governance group expands on header click — AuditLog enters the DOM', async () => {
    renderPane();
    // AuditLogPanel renders <div role="group" aria-label="audit log actions">.
    expect(screen.queryByRole('group', { name: /audit log actions/i })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /governance/i }));
    expect(screen.getByRole('button', { name: /governance/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('group', { name: /audit log actions/i })).toBeInTheDocument();
  });

  it('toggling a group is reversible and persists to localStorage', async () => {
    renderPane();
    const lib = screen.getByRole('button', { name: /^library$/i });
    expect(lib).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(lib);
    expect(lib).toHaveAttribute('aria-expanded', 'true');
    expect(window.localStorage.getItem('lg.accordion.bottom-pane-library.open')).toBe('1');
    expect(screen.getByRole('heading', { name: /my leases/i })).toBeInTheDocument();
    await userEvent.click(lib);
    expect(lib).toHaveAttribute('aria-expanded', 'false');
    expect(window.localStorage.getItem('lg.accordion.bottom-pane-library.open')).toBe('0');
    expect(screen.queryByRole('heading', { name: /my leases/i })).toBeNull();
  });

  it('honors a stored preference of "1" by mounting the group expanded', () => {
    window.localStorage.setItem('lg.accordion.bottom-pane-library.open', '1');
    renderPane();
    expect(screen.getByRole('button', { name: /^library$/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('heading', { name: /my leases/i })).toBeInTheDocument();
  });

  it('library group renders a count badge when leases are present', () => {
    renderPane({
      library: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: 'a', name: 'a.pdf', createdAt: 0, updatedAt: 0 } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: 'b', name: 'b.pdf', createdAt: 0, updatedAt: 0 } as any,
      ],
    });
    // The SectionGroup renders count via [data-section-count]; the label
    // for the library group reads "Library 2".
    const libBtn = screen.getByRole('button', { name: /^library 2$/i });
    expect(libBtn).toBeInTheDocument();
  });
});

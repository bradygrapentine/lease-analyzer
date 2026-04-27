import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppLibraryAndPacksPane } from './AppLibraryAndPacksPane';
import { I18nProvider } from '../i18n/I18nProvider';

// Wave 30 Part B: SectionGroup defaults closed and reads localStorage.
// jsdom's localStorage in this project lacks working get/set (see
// `I18nProvider.test.tsx` for the same fixup); install a memory shim and
// pre-seed it so tests that still poke at inner panel content see the
// sections expanded.
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

function expandAllSectionsViaStorage(): void {
  window.localStorage.setItem('lg.accordion.bottom-pane-this-lease.open', '1');
  window.localStorage.setItem('lg.accordion.bottom-pane-library.open', '1');
  window.localStorage.setItem('lg.accordion.bottom-pane-governance.open', '1');
}

function defaults(over: Partial<React.ComponentProps<typeof AppLibraryAndPacksPane>> = {}) {
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

describe('AppLibraryAndPacksPane', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    expandAllSectionsViaStorage();
  });

  it('renders the library / templates / pack-manager / audit-log panels', () => {
    defaults();
    expect(screen.getByRole('heading', { name: /my leases/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /diff rule pack/i })).toBeInTheDocument();
    // Wave 28 Part C: SectionGroup wrappers also expose role="region";
    // AuditLogPanel renders its own region with the same accessible name,
    // so we assert at least one match.
    expect(screen.getAllByRole('region', { name: /audit log/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('hides the ComparePanel when comparison is null', () => {
    defaults({ comparison: null });
    expect(screen.queryByRole('region', { name: /^compare$/i })).toBeNull();
  });

  it('fires onRefreshAuditLog when the audit-log refresh button is clicked', async () => {
    const onRefreshAuditLog = vi.fn();
    defaults({ onRefreshAuditLog });
    await userEvent.click(screen.getByRole('button', { name: /^refresh$/i }));
    expect(onRefreshAuditLog).toHaveBeenCalledTimes(1);
  });
});

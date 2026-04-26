import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppLibraryAndPacksPane } from './AppLibraryAndPacksPane';
import { I18nProvider } from '../i18n/I18nProvider';

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

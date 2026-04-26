import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppLibraryAndPacksPane } from './AppLibraryAndPacksPane';
import { I18nProvider } from '../i18n/I18nProvider';

// Wave 28 Part C — covers the new accordion grouping behavior on the
// bottom pane. Three SectionGroup disclosures: `this-lease` (default
// open), `library` and `governance` (both default closed). State is
// in-memory only.

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

describe('AppLibraryAndPacksPane accordion grouping (Wave 28 Part C)', () => {
  it('renders three SectionGroup disclosures with stable ids', () => {
    renderPane();
    expect(screen.getByRole('button', { name: /this lease/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^library$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /governance/i })).toBeInTheDocument();
  });

  it('all three groups are open by default (Wave 28 Part C round-1 — see SECTION_GROUPS for the rationale)', () => {
    renderPane();
    expect(screen.getByRole('button', { name: /this lease/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: /^library$/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: /governance/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('library group can be collapsed by clicking the header — children leave the DOM', async () => {
    renderPane();
    // Open by default — LibraryPanel's "My Leases" heading is mounted.
    expect(screen.getByRole('heading', { name: /my leases/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^library$/i }));
    expect(screen.getByRole('button', { name: /^library$/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('heading', { name: /my leases/i })).toBeNull();
  });

  it('governance group can be collapsed by clicking the header — AuditLog leaves the DOM', async () => {
    renderPane();
    // AuditLogPanel renders <div role="group" aria-label="audit log actions">.
    expect(screen.getByRole('group', { name: /audit log actions/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /governance/i }));
    expect(screen.getByRole('button', { name: /governance/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('group', { name: /audit log actions/i })).toBeNull();
  });

  it('toggling a group is reversible (in-memory state)', async () => {
    renderPane();
    const lib = screen.getByRole('button', { name: /^library$/i });
    expect(lib).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(lib);
    expect(lib).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('heading', { name: /my leases/i })).toBeNull();
    await userEvent.click(lib);
    expect(lib).toHaveAttribute('aria-expanded', 'true');
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

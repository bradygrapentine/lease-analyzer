// Wave 28 Part F — axe-core sweep across the bottom-pane accordion.
//
// Per plan §5 Part F.3 / F.4: every SectionGroup disclosure must satisfy
// aria-expanded / aria-controls pairing in BOTH expanded and collapsed
// states. Round-2 deviation: all three groups ship default-OPEN, so we
// also need to verify the collapsed state by toggling.
import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppLibraryAndPacksPane } from '../AppLibraryAndPacksPane';
import { I18nProvider } from '../../i18n/I18nProvider';
import { expectAxeClean } from '../../test/axe';

function renderPane(over: Partial<ComponentProps<typeof AppLibraryAndPacksPane>> = {}) {
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
  const props: ComponentProps<typeof AppLibraryAndPacksPane> = {
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

describe('Accordion axe-core sweep (Wave 28 Part F)', () => {
  it('all three SectionGroups expanded — zero axe violations', async () => {
    const { container } = renderPane();
    // sanity — confirm all open
    expect(screen.getByRole('button', { name: /this lease/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expectAxeClean(container);
  });

  it('library + governance collapsed — zero axe violations (covers Round-2 deferred default-closed state)', async () => {
    const { container } = renderPane();
    await userEvent.click(screen.getByRole('button', { name: /^library$/i }));
    await userEvent.click(screen.getByRole('button', { name: /governance/i }));
    expect(screen.getByRole('button', { name: /^library$/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: /governance/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expectAxeClean(container);
  });

  it('every SectionGroup header carries paired aria-expanded + aria-controls', () => {
    renderPane();
    const headers = [
      screen.getByRole('button', { name: /this lease/i }),
      screen.getByRole('button', { name: /^library$/i }),
      screen.getByRole('button', { name: /governance/i }),
    ];
    for (const h of headers) {
      expect(h).toHaveAttribute('aria-expanded');
      const controls = h.getAttribute('aria-controls');
      expect(controls, `aria-controls missing on ${h.textContent}`).toBeTruthy();
      // The disclosure panel must exist with the matching id and be
      // labelled by the header. (Wave 28 Part F dropped role="region"
      // from the panel to avoid landmark-unique collisions with
      // descendant <Section> landmarks; the disclosure pattern itself
      // stays intact.)
      const panel = document.getElementById(controls!);
      expect(panel, `panel #${controls} missing for header ${h.textContent}`).not.toBeNull();
      expect(panel).toHaveAttribute('aria-labelledby', h.id);
    }
  });
});

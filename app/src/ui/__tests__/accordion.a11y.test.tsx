// Wave 28 Part F — axe-core sweep across the bottom-pane accordion.
// Wave 30 Part B — flipped fixtures for default-closed sections; the
// expanded-state sweep now opens all three groups before asserting,
// while the collapsed-state sweep relies on the new default. Storage
// is cleared per-test to keep the localStorage-backed defaults
// deterministic in jsdom.
//
// Per plan §5 Part F.3 / F.4: every SectionGroup disclosure must satisfy
// aria-expanded / aria-controls pairing in BOTH expanded and collapsed
// states.
import { beforeEach, describe, it, expect, vi } from 'vitest';
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
    ...over,
  };
  return render(
    <I18nProvider>
      <AppLibraryAndPacksPane {...props} />
    </I18nProvider>,
  );
}

describe('Accordion axe-core sweep (Wave 28 Part F / Wave 30 Part B)', () => {
  beforeEach(() => {
    // Wave 30 B: SectionGroup reads localStorage on mount. jsdom's stub
    // lacks working get/set in this project (see `I18nProvider.test.tsx`),
    // so install a working in-memory shim and start each case from the
    // fresh-install default (no key set → all collapsed).
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
  });

  it('all three SectionGroups expanded — zero axe violations', async () => {
    const { container } = renderPane();
    // Wave 30 B: open the three groups (default-closed) before sweeping.
    await userEvent.click(screen.getByRole('button', { name: /this lease/i }));
    await userEvent.click(screen.getByRole('button', { name: /saved leases/i }));
    await userEvent.click(screen.getByRole('button', { name: /advanced rule/i }));
    expect(screen.getByRole('button', { name: /this lease/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expectAxeClean(container);
  });

  it('all three SectionGroups collapsed (fresh-install default) — zero axe violations', async () => {
    const { container } = renderPane();
    expect(screen.getByRole('button', { name: /this lease/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: /saved leases/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: /advanced rule/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expectAxeClean(container);
  });

  it('every SectionGroup header carries paired aria-expanded + aria-controls', () => {
    renderPane();
    const headers = [
      screen.getByRole('button', { name: /this lease/i }),
      screen.getByRole('button', { name: /saved leases/i }),
      screen.getByRole('button', { name: /advanced rule/i }),
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

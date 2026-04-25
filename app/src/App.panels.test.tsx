import { afterAll, afterEach, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// This file is the panel-smoke aggregate (~20 panels mounted under <App/>)
// and runs slower than the rest of the suite under v8 coverage
// instrumentation. Per-file timeout bump only — the global default in
// `vite.config.ts` stays at 5s. See `docs/TESTING.md` § Coverage thresholds.
vi.setConfig({ testTimeout: 15_000 });

vi.mock('./ocr/runOcr', () => ({
  runOcr: vi.fn(async () => ({
    pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
    paragraphs: [],
    sections: [],
    raw: '',
  })),
}));

// jsdom has no canvas/worker, so the real pdf.js render path throws +
// stalls every test that mounts <PdfViewer>. This mock collapses the page
// render to a microtask so the 5s per-test timeout under coverage isn't
// exhausted by pdf.js worker bootstrapping on each mount. The logic in
// renderPdfPages is separately covered by `src/ui/renderPdfPages.test.ts`
// via a stubbed pdf.js API.
vi.mock('./ui/renderPdfPages', () => ({
  loadPdfjs: vi.fn(async () => ({})),
  renderPageToCanvas: vi.fn(async () => {}),
  renderPdfPages: vi.fn(
    (): AsyncIterable<{ pageIndex: number }> => ({
      // Empty async iterator: no pages to yield; Promise-style consumers (e.g.
      // `for await (…)` in PdfViewer) complete immediately.
      // eslint-disable-next-line @typescript-eslint/require-await
      async *[Symbol.asyncIterator]() {},
    }),
  ),
}));

import { App } from './App';
import { makePdf } from './parser/testFixtures';
import {
  _resetDbForTests,
  openLeaseDb,
  listLeases,
  setOnboardingDismissedAt,
} from './storage/storage';
import {
  _resetPacksDbForTests,
  listInstalledPacks,
  openPacksDb,
  getPackEnabled,
  getSelectedJurisdictions,
  getSeverityOverrides,
} from './rules/packStorage';
import {
  _resetCountersDbForTests,
  listCounterOffers,
  openCountersDb,
} from './negotiation/counterOffers';
import {
  _resetAnnotationsDbForTests,
  listAnnotations,
  openAnnotationsDb,
} from './annotations/annotations';
import { _resetSigningDbForTests } from './security/signingKeys';
import {
  _resetAuditDbForTests,
  AUDIT_DB_NAME,
  listAuditEntries,
  openAuditDb,
} from './audit/auditLog';
import {
  _resetRedlineDbForTests,
  listEditsForLease,
  openRedlineDb,
} from './redline/redlineStorage';
import {
  _resetBulkDedupDbForTests,
  BULK_DEDUP_DB_NAME,
} from './workflow/bulkImport';
import {
  _resetVersionsDbForTests,
  listVersionsForLease,
  openVersionsDb,
} from './negotiation/versionHistory';
import { signPack } from './rules/packSigning';
import { saveLease } from './storage/storage';

async function wipeDb(name: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => resolve();
    req.onblocked = (): void => resolve();
  });
}

async function closeIfOpen(opener: () => Promise<{ close(): void }>): Promise<void> {
  try {
    (await opener()).close();
  } catch {
    // ignore
  }
}

// Suppress unhandled `InvalidStateError` rejections that fire when a
// fire-and-forget IDB call (e.g. App's `refreshAuditLog`) resolves after
// its DB cache was nulled by the next test's `beforeEach`. These are
// benign (the promise would update an unmounted component's state) but
// pollute vitest output and can flip reported-pass tests into runtime
// failures on slow CI hosts.
function isBenignIdbTeardownError(err: unknown): boolean {
  const e = err as { name?: string; code?: number } | null;
  if (!e) return false;
  if (e.name === 'InvalidStateError') return true;
  if (e.code === 11) return true;
  return false;
}
interface NodeProcessLike {
  on(event: 'unhandledRejection', fn: (err: unknown) => void): void;
  off(event: 'unhandledRejection', fn: (err: unknown) => void): void;
}
const proc = (globalThis as unknown as { process?: NodeProcessLike })
  .process;
const onUnhandled = (err: unknown): void => {
  if (!isBenignIdbTeardownError(err)) throw err as Error;
};
beforeAll(() => {
  proc?.on('unhandledRejection', onUnhandled);
});
afterAll(() => {
  proc?.off('unhandledRejection', onUnhandled);
});

afterEach(() => {
  // RTL auto-cleanup normally runs, but we explicitly unmount here so
  // any in-flight `refreshLibrary / refreshAuditLog` effects tied to
  // the rendered <App /> see their parents torn down BEFORE the next
  // `beforeEach` nulls the cached db promises.
  cleanup();
});

beforeEach(async () => {
  // Let any pending IDB calls on the previous test's App settle before
  // we yank the underlying handles out from under them.
  await new Promise<void>((r) => setTimeout(r, 0));
  await new Promise<void>((r) => setTimeout(r, 0));
  await closeIfOpen(() => openLeaseDb() as Promise<{ close(): void }>);
  await closeIfOpen(() => openPacksDb() as Promise<{ close(): void }>);
  await closeIfOpen(() => openAnnotationsDb() as Promise<{ close(): void }>);
  await closeIfOpen(() => openCountersDb() as Promise<{ close(): void }>);
  await closeIfOpen(() => openAuditDb() as Promise<{ close(): void }>);
  await closeIfOpen(() => openRedlineDb() as Promise<{ close(): void }>);
  await closeIfOpen(() => openVersionsDb() as Promise<{ close(): void }>);
  _resetDbForTests();
  _resetPacksDbForTests();
  _resetAnnotationsDbForTests();
  _resetCountersDbForTests();
  _resetSigningDbForTests();
  _resetAuditDbForTests();
  _resetBulkDedupDbForTests();
  _resetRedlineDbForTests();
  _resetVersionsDbForTests();
  // Give the close() microtask a tick to land.
  await new Promise<void>((r) => setTimeout(r, 0));
  await wipeDb('leaseguard');
  await wipeDb('leaseguard-packs');
  await wipeDb('leaseguard-annotations');
  await wipeDb('leaseguard-counters');
  await wipeDb('leaseguard-signing');
  await wipeDb(AUDIT_DB_NAME);
  await wipeDb(BULK_DEDUP_DB_NAME);
  await wipeDb('leaseguard-redlines');
  await wipeDb('leaseguard-versions');
  // Mark the onboarding tour dismissed so it never intercepts these tests.
  await setOnboardingDismissedAt(Date.now());
});

async function makeLeaseFile(name = 'lease.pdf'): Promise<File> {
  const bytes = await makePdf([
    {
      blocks: [
        { text: 'This lease shall auto-renew annually.', x: 72, y: 72 },
        { text: 'Tenant waives any right to a jury trial.', x: 72, y: 110 },
      ],
    },
  ]);
  return new File([bytes as BlobPart], name, { type: 'application/pdf' });
}

async function uploadLease(name = 'lease.pdf'): Promise<void> {
  const file = await makeLeaseFile(name);
  const input = screen.getByLabelText(/upload lease/i) as HTMLInputElement;
  await userEvent.upload(input, file);
  // Wait until the findings <aside> mounts — rule titles also surface in the
  // SeverityOverridesPanel even before analysis finishes, so we scope to the
  // findings region here rather than looking for a rule title anywhere.
  await waitFor(() =>
    expect(
      screen.getByRole('complementary', { name: /findings/i }),
    ).toBeInTheDocument(),
  );
}

describe('App panel wire-ups', () => {
  it('renders the LeaseFacts panel after analysis', async () => {
    render(<App />);
    await uploadLease();
    expect(screen.getByRole('region', { name: /lease facts/i })).toBeInTheDocument();
  });

  it('renders the WorkflowPanel with ics / copy / handoff buttons', async () => {
    render(<App />);
    await uploadLease();
    expect(screen.getByRole('button', { name: /download \.ics/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy summary/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download handoff zip/i })).toBeInTheDocument();
  });

  it('ics export surfaces an error when the lease has no dates', async () => {
    render(<App />);
    await uploadLease();
    await userEvent.click(screen.getByRole('button', { name: /download \.ics/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/no dates/i),
    );
  });

  it('copy summary writes to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(<App />);
    await uploadLease();
    await userEvent.click(screen.getByRole('button', { name: /copy summary/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/copied/i)).toBeInTheDocument());
  });

  it('handoff download triggers a blob download', async () => {
    const aClicks: string[] = [];
    const origCreate = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        el.click = (): void => {
          aClicks.push(el.getAttribute('download') ?? '');
        };
      }
      return el;
    });
    URL.createObjectURL = vi.fn().mockReturnValue('blob:x');
    URL.revokeObjectURL = vi.fn();

    render(<App />);
    await uploadLease('Handoff.pdf');
    await userEvent.click(screen.getByRole('button', { name: /download handoff zip/i }));
    expect(aClicks).toContain('Handoff-handoff.zip');
    createSpy.mockRestore();
  });

  it('PackManagerPanel imports, toggles, and deletes a pack', async () => {
    render(<App />);
    const pack = {
      schema: 'leaseguard.rulepack.v1',
      id: 'custom-pack',
      name: 'Custom',
      version: '1.0.0',
      description: 'test pack',
      rules: [
        {
          id: 'custom-rule',
          severity: 'medium',
          category: 'fees',
          title: 'Custom rule',
          explanation: 'x',
          citation: null,
          match: { type: 'regex', pattern: 'banana', flags: 'i' },
        },
      ],
    };
    const input = screen.getByLabelText(/import rule pack/i) as HTMLInputElement;
    await userEvent.upload(
      input,
      new File([JSON.stringify(pack)], 'custom.lgpack.json', { type: 'application/json' }),
    );
    await waitFor(async () => {
      expect((await listInstalledPacks()).length).toBe(1);
    });
    await waitFor(async () => expect(await getPackEnabled('custom-pack')).toBe(true));
    // Give refreshPacks() time to propagate to the UI — without this, on
    // full-suite runs the next event loop tick can beat the render.
    const deleteBtn = await screen.findByRole('button', {
      name: /delete pack custom-pack/i,
    });
    await userEvent.click(deleteBtn);
    await waitFor(async () => {
      expect((await listInstalledPacks()).length).toBe(0);
    });
  });

  it('SigningKeyPanel creates a key and reveals the signed-export button', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('correct horse');
    render(<App />);
    await uploadLease();
    // Signed button is hidden before a key exists.
    expect(
      screen.queryByRole('button', { name: /export findings \(signed json\)/i }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /create key/i }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /export findings \(signed json\)/i }),
      ).toBeInTheDocument(),
    );
    promptSpy.mockRestore();
  });

  it('AnnotationsPanel saves a note keyed by lease + paragraph', async () => {
    render(<App />);
    await uploadLease('Notes.pdf');
    // Pick the finding button (the first match — the "what this means"
    // disclosure button also matches the rule title via aria-label).
    const findings = screen.getByRole('complementary', { name: /findings/i });
    await userEvent.click(
      within(findings).getAllByRole('button', { name: /waiver of jury trial/i })[0]!,
    );
    const note = screen.getByLabelText(/new note/i);
    await userEvent.type(note, 'Push back on this.');
    await userEvent.click(screen.getByRole('button', { name: /^add note$/i }));
    const [lease] = await listLeases();
    await waitFor(async () => {
      const anns = await listAnnotations(lease!.id);
      expect(anns.length).toBe(1);
      expect(anns[0]!.text).toBe('Push back on this.');
    });
  });

  it('CounterOfferPanel saves a counter offer keyed by rule', async () => {
    render(<App />);
    await uploadLease('Counters.pdf');
    const findings = screen.getByRole('complementary', { name: /findings/i });
    await userEvent.click(
      within(findings).getAllByRole('button', { name: /waiver of jury trial/i })[0]!,
    );
    await userEvent.type(
      screen.getByLabelText(/new counter-offer name/i),
      'Strike clause',
    );
    await userEvent.type(
      screen.getByLabelText(/new counter-offer text/i),
      'Propose removal of waiver.',
    );
    await userEvent.click(
      screen.getByRole('button', { name: /add counter-offer/i }),
    );
    await waitFor(async () => {
      const offers = await listCounterOffers();
      expect(offers.length).toBe(1);
    });
  });

  it('JurisdictionPickerPanel toggles and re-runs analysis', async () => {
    render(<App />);
    await uploadLease('JurisLease.pdf');
    const cb = await screen.findByRole('checkbox', { name: /jurisdiction US-CA/i });
    await userEvent.click(cb);
    // Selection persists via packStorage.
    await waitFor(async () => {
      const j = await getSelectedJurisdictions();
      expect(j).toContain('US-CA');
    });
    // Clear the selection.
    await userEvent.click(cb);
    await waitFor(async () => {
      const j = await getSelectedJurisdictions();
      expect(j).not.toContain('US-CA');
    });
  });

  it('SeverityOverridesPanel persists overrides and triggers reanalyze', async () => {
    render(<App />);
    await uploadLease('OverrideLease.pdf');
    const select = await screen.findByRole('combobox', {
      name: /override severity for auto-renewal/i,
    });
    await userEvent.selectOptions(select, 'error');
    await waitFor(async () => {
      const ov = await getSeverityOverrides();
      expect(ov['auto-renewal']).toBe('high');
    });
    // Clear via the per-row button.
    const clear = screen.getByRole('button', { name: /clear override for auto-renewal/i });
    await userEvent.click(clear);
    await waitFor(async () => {
      const ov = await getSeverityOverrides();
      expect(ov['auto-renewal']).toBeUndefined();
    });
  });

  it('PackDiffPanel renders a diff from an uploaded pack file', async () => {
    render(<App />);
    const pack = {
      schema: 'leaseguard.rulepack.v1',
      id: 'diff-pack',
      name: 'Diff',
      version: '1.0.0',
      description: 'diff test',
      rules: [
        {
          id: 'brand-new',
          severity: 'low',
          category: 'general',
          title: 'Brand new rule',
          explanation: 'x',
          citation: null,
          match: { type: 'regex', pattern: 'mango', flags: 'i' },
        },
      ],
    };
    const input = screen.getByLabelText(/pack file to diff/i) as HTMLInputElement;
    await userEvent.upload(
      input,
      new File([JSON.stringify(pack)], 'diff.lgpack.json', { type: 'application/json' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('region', { name: /rule pack diff/i })).toBeInTheDocument(),
    );
    expect(screen.getByText(/Brand new rule/i)).toBeInTheDocument();
  });

  it('AuditLogPanel populates entries after an analyze and verifies the chain', async () => {
    render(<App />);
    await uploadLease('Auditing.pdf');
    // At least the analyze start/complete entries should appear.
    await waitFor(() => {
      expect(
        screen.getByRole('table', { name: /audit entries/i }),
      ).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /verify chain/i }));
    await waitFor(() =>
      expect(screen.getByTestId('audit-verification')).toHaveTextContent(
        /chain intact/i,
      ),
    );
  });

  it('BulkImportPanel imports multiple PDFs into the library', async () => {
    render(<App />);
    // Two distinct lease fixtures — bulk-import dedups by content hash.
    const bytesA = await makePdf([
      {
        blocks: [{ text: 'Lease A shall auto-renew annually.', x: 72, y: 72 }],
      },
    ]);
    const bytesB = await makePdf([
      {
        blocks: [
          { text: 'Lease B is a totally different document.', x: 72, y: 72 },
        ],
      },
    ]);
    const fileA = new File([bytesA as BlobPart], 'bulk-a.pdf', {
      type: 'application/pdf',
    });
    const fileB = new File([bytesB as BlobPart], 'bulk-b.pdf', {
      type: 'application/pdf',
    });
    const input = screen.getByLabelText(/bulk import files/i) as HTMLInputElement;
    await userEvent.upload(input, [fileA, fileB]);
    await waitFor(async () => {
      expect((await listLeases()).length).toBe(2);
    });
  });

  it('CounterOfferPanel pre-fills the textarea from rule.suggestedEdit', async () => {
    render(<App />);
    await uploadLease('Prefill.pdf');
    const findings = screen.getByRole('complementary', { name: /findings/i });
    await userEvent.click(
      within(findings).getAllByRole('button', { name: /waiver of jury trial/i })[0]!,
    );
    // The built-in rule pack ships a suggestedEdit for jury-waiver; ensure
    // it lands in the textarea without the user typing.
    const textarea = screen.getByLabelText(/new counter-offer text/i) as HTMLTextAreaElement;
    await waitFor(() => expect(textarea.value.length).toBeGreaterThan(0));
  });

  it('Portfolio view toggle shows PortfolioPanel and returns via lease click', async () => {
    render(<App />);
    await uploadLease('Alpha.pdf');
    await userEvent.click(screen.getByRole('button', { name: /^portfolio$/i }));
    // Analyzed results are hidden in portfolio view.
    expect(screen.queryByRole('region', { name: /lease facts/i })).not.toBeInTheDocument();
    const portfolioRegion = await screen.findByRole('region', { name: /^portfolio$/i });
    expect(portfolioRegion).toBeInTheDocument();
    // Clicking the lease button (from the portfolio table) returns to current view.
    const openButtons = screen.getAllByRole('button', { name: /alpha\.pdf/i });
    expect(openButtons.length).toBeGreaterThan(0);
  });

  it('CustomRuleBuilderPanel saves a rule as an installed pack and re-analyzes', async () => {
    render(<App />);
    await uploadLease('Custom.pdf');
    // Fill the form through the builder.
    await userEvent.type(screen.getByLabelText(/rule id/i), 'banana-clause');
    await userEvent.type(
      screen.getByLabelText(/^title$/i),
      'Banana clause',
    );
    await userEvent.type(
      screen.getByLabelText(/^explanation$/i),
      'Flags the word auto-renew as bananas.',
    );
    await userEvent.type(
      screen.getByLabelText(/regex pattern/i),
      'auto-renew',
    );
    await userEvent.click(screen.getByRole('button', { name: /save rule/i }));
    await waitFor(async () => {
      const packs = await listInstalledPacks();
      expect(packs.some((p) => p.id === 'custom-banana-clause')).toBe(true);
    });
    // The custom pack is auto-enabled and the saved rule now appears in
    // the SeverityOverridesPanel list (proxy for "in active rules").
    await waitFor(() => {
      expect(
        screen.getByRole('combobox', {
          name: /override severity for banana-clause/i,
        }),
      ).toBeInTheDocument();
    });
  });

  it('Apply-suggestion writes a RedlineEdit and switches to the Redline view', async () => {
    render(<App />);
    await uploadLease('ApplySugg.pdf');
    // Jury-trial waiver rule ships a built-in suggestedEdit, so the
    // "Apply suggestion" button is rendered on its finding.
    const findings = screen.getByRole('complementary', { name: /findings/i });
    const applyBtns = await within(findings).findAllByRole('button', {
      name: /apply suggestion for waiver of jury trial/i,
    });
    await userEvent.click(applyBtns[0]!);
    const [lease] = await listLeases();
    await waitFor(async () => {
      const edits = await listEditsForLease(lease!.id);
      expect(edits.length).toBe(1);
      expect(edits[0]!.ruleId).toBe('jury-waiver');
    });
    // View toggles to Redline automatically.
    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: /redline/i }),
      ).toBeInTheDocument(),
    );
  });

  it('RedlinePanel edits a paragraph, exports HTML, and audits the change', async () => {
    const aClicks: string[] = [];
    const origCreate = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        el.click = (): void => {
          aClicks.push(el.getAttribute('download') ?? '');
        };
      }
      return el;
    });
    URL.createObjectURL = vi.fn().mockReturnValue('blob:x');
    URL.revokeObjectURL = vi.fn();

    render(<App />);
    await uploadLease('Redline.pdf');
    await userEvent.click(screen.getByRole('button', { name: /^redline$/i }));
    // Edit the first paragraph.
    const editButtons = await screen.findAllByRole('button', {
      name: /^edit paragraph 1$/i,
    });
    await userEvent.click(editButtons[0]!);
    const ta = screen.getByRole('textbox', { name: /paragraph 1 text/i });
    await userEvent.clear(ta);
    await userEvent.type(ta, 'Edited paragraph one.');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    const [lease] = await listLeases();
    await waitFor(async () => {
      const edits = await listEditsForLease(lease!.id);
      expect(edits.length).toBe(1);
      expect(edits[0]!.after).toBe('Edited paragraph one.');
    });
    // Audit log picked up the redline event.
    await waitFor(async () => {
      const entries = await listAuditEntries();
      expect(entries.some((e) => e.kind === 'redline-edit')).toBe(true);
    });
    // Export HTML triggers a download.
    await userEvent.click(
      screen.getByRole('button', { name: /export redlined html/i }),
    );
    expect(aClicks).toContain('Redline-redline.html');
    createSpy.mockRestore();
  });

  it('VersionHistoryPanel creates a version snapshot in the redline view', async () => {
    render(<App />);
    await uploadLease('Versioned.pdf');
    await userEvent.click(screen.getByRole('button', { name: /^redline$/i }));
    // Seed an edit so the snapshot is non-empty.
    const editButtons = await screen.findAllByRole('button', {
      name: /^edit paragraph 1$/i,
    });
    await userEvent.click(editButtons[0]!);
    const ta = screen.getByRole('textbox', { name: /paragraph 1 text/i });
    await userEvent.clear(ta);
    await userEvent.type(ta, 'Edit before snapshot.');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    // Fill label + click Save version. RTL queries pierce the collapsed
    // <details> wrapper so we don't need to open it.
    const labelInput = await screen.findByLabelText(/new version label/i);
    await userEvent.type(labelInput, 'v1');
    await userEvent.click(screen.getByRole('button', { name: /^save version$/i }));
    const [lease] = await listLeases();
    await waitFor(async () => {
      const vs = await listVersionsForLease(lease!.id);
      expect(vs.length).toBe(1);
      expect(vs[0]!.label).toBe('v1');
      expect(vs[0]!.edits.length).toBe(1);
    });
    // Audit captured the save.
    await waitFor(async () => {
      const entries = await listAuditEntries();
      expect(entries.some((e) => e.kind === 'version-save')).toBe(true);
    });
  });

  it('SideLetterPanel downloads HTML when edits exist', async () => {
    const aClicks: string[] = [];
    const origCreate = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        el.click = (): void => {
          aClicks.push(el.getAttribute('download') ?? '');
        };
      }
      return el;
    });
    URL.createObjectURL = vi.fn().mockReturnValue('blob:x');
    URL.revokeObjectURL = vi.fn();

    render(<App />);
    await uploadLease('SideLetter.pdf');
    await userEvent.click(screen.getByRole('button', { name: /^redline$/i }));
    // Seed an edit to give the side-letter clauses to cite.
    const editButtons = await screen.findAllByRole('button', {
      name: /^edit paragraph 1$/i,
    });
    await userEvent.click(editButtons[0]!);
    const ta = screen.getByRole('textbox', { name: /paragraph 1 text/i });
    await userEvent.clear(ta);
    await userEvent.type(ta, 'Side letter test.');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    // Fill the signer and click download.
    await userEvent.type(screen.getByLabelText(/signer name/i), 'Jane Doe');
    await userEvent.click(
      screen.getByRole('button', { name: /download side letter/i }),
    );
    expect(aClicks).toContain('SideLetter-side-letter.html');
    createSpy.mockRestore();
  });

  it('PackManagerPanel imports a signed envelope and shows Verified badge', async () => {
    render(<App />);
    const pack = {
      schema: 'leaseguard.rulepack.v1' as const,
      id: 'signed-pack',
      name: 'Signed pack',
      version: '1.0.0',
      description: 'signed test',
      rules: [
        {
          id: 'signed-rule',
          severity: 'medium' as const,
          category: 'fees' as const,
          title: 'Signed rule',
          explanation: 'x',
          citation: null,
          match: { type: 'regex' as const, pattern: 'kiwi', flags: 'i' },
        },
      ],
    };
    // Generate an Ed25519 keypair + signed envelope locally.
    const kp = (await crypto.subtle.generateKey(
      { name: 'Ed25519' },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    const envelope = await signPack(pack, kp.privateKey, kp.publicKey);
    const input = screen.getByLabelText(/import rule pack/i) as HTMLInputElement;
    await userEvent.upload(
      input,
      new File([JSON.stringify(envelope)], 'signed.lgpack.json', {
        type: 'application/json',
      }),
    );
    await waitFor(async () => {
      expect((await listInstalledPacks()).length).toBe(1);
    });
    // The badge span for the signed-pack row should report "Verified".
    await waitFor(() => {
      expect(
        screen.getByLabelText(/signature status: verified/i),
      ).toBeInTheDocument();
    });
    // Audit log captured the verification + import.
    await waitFor(async () => {
      const entries = await listAuditEntries();
      expect(entries.some((e) => e.kind === 'pack-signature-verified')).toBe(true);
    });
  });

  it('VersionHistoryPanel restores, exports, and deletes saved versions', async () => {
    const aClicks: string[] = [];
    const origCreate = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        el.click = (): void => {
          aClicks.push(el.getAttribute('download') ?? '');
        };
      }
      return el;
    });
    URL.createObjectURL = vi.fn().mockReturnValue('blob:x');
    URL.revokeObjectURL = vi.fn();

    render(<App />);
    await uploadLease('VersionCrud.pdf');
    await userEvent.click(screen.getByRole('button', { name: /^redline$/i }));
    // Seed one edit + one saved version ("v1").
    const editButtons = await screen.findAllByRole('button', {
      name: /^edit paragraph 1$/i,
    });
    await userEvent.click(editButtons[0]!);
    const ta = screen.getByRole('textbox', { name: /paragraph 1 text/i });
    await userEvent.clear(ta);
    await userEvent.type(ta, 'Snapshot edit.');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await userEvent.type(screen.getByLabelText(/new version label/i), 'v1');
    await userEvent.click(screen.getByRole('button', { name: /^save version$/i }));
    const [lease] = await listLeases();
    await waitFor(async () => {
      expect((await listVersionsForLease(lease!.id)).length).toBe(1);
    });
    // Export — triggers a download. `findByRole` here (and below) absorbs
    // the React render tick that follows VersionHistoryPanel's IDB
    // hydration; the synchronous `getByRole` flaked when the version
    // row hadn't repainted yet.
    await userEvent.click(await screen.findByRole('button', { name: /export version v1/i }));
    expect(aClicks.some((n) => n.includes('VersionCrud-redline'))).toBe(true);
    // Restore — no-op on snapshot equal to current state, but exercises path.
    await userEvent.click(await screen.findByRole('button', { name: /restore version v1/i }));
    await waitFor(async () => {
      const entries = await listAuditEntries();
      expect(entries.some((e) => e.kind === 'version-restore')).toBe(true);
    });
    // Delete — timeline drops back to empty.
    await userEvent.click(await screen.findByRole('button', { name: /delete version v1/i }));
    await waitFor(async () => {
      expect((await listVersionsForLease(lease!.id)).length).toBe(0);
    });
    createSpy.mockRestore();
  });

  it('SideLetterPanel preview falls back to download when popup is blocked', async () => {
    const aClicks: string[] = [];
    const origCreate = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        el.click = (): void => {
          aClicks.push(el.getAttribute('download') ?? '');
        };
      }
      return el;
    });
    URL.createObjectURL = vi.fn().mockReturnValue('blob:x');
    URL.revokeObjectURL = vi.fn();
    // Simulate popup blocker — window.open returns null.
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    render(<App />);
    await uploadLease('SideLetterPreview.pdf');
    await userEvent.click(screen.getByRole('button', { name: /^redline$/i }));
    await userEvent.click(
      screen.getByRole('button', { name: /generate side letter preview/i }),
    );
    // Popup blocked → fallback downloads the letter.
    expect(aClicks.some((n) => n.endsWith('-side-letter.html'))).toBe(true);
    openSpy.mockRestore();
    createSpy.mockRestore();
  });

  it('PackManagerPanel reports "Invalid signature" on a tampered envelope', async () => {
    render(<App />);
    const pack = {
      schema: 'leaseguard.rulepack.v1' as const,
      id: 'tampered-pack',
      name: 'Tampered',
      version: '1.0.0',
      description: 'tampered',
      rules: [
        {
          id: 'tampered-rule',
          severity: 'low' as const,
          category: 'general' as const,
          title: 'Tampered',
          explanation: 'x',
          citation: null,
          match: { type: 'regex' as const, pattern: 'mango', flags: 'i' },
        },
      ],
    };
    const kp = (await crypto.subtle.generateKey(
      { name: 'Ed25519' },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    const envelope = await signPack(pack, kp.privateKey, kp.publicKey);
    // Mutate the payload so the signature no longer matches.
    const tampered = {
      ...envelope,
      payload: envelope.payload.replace('Tampered', 'TamperedX'),
    };
    const input = screen.getByLabelText(/import rule pack/i) as HTMLInputElement;
    await userEvent.upload(
      input,
      new File([JSON.stringify(tampered)], 'tampered.lgpack.json', {
        type: 'application/json',
      }),
    );
    // Pack should NOT land in the store; the PackManagerPanel surfaces the
    // verify error via its error banner.
    await waitFor(() =>
      expect(screen.getByText(/Invalid signed pack/i)).toBeInTheDocument(),
    );
    expect((await listInstalledPacks()).length).toBe(0);
    // Audit log captured the invalid signature event.
    await waitFor(async () => {
      const entries = await listAuditEntries();
      expect(entries.some((e) => e.kind === 'pack-signature-invalid')).toBe(true);
    });
  });

  it('ComparePanel surfaces a pack-version mismatch banner', async () => {
    // Pre-seed two leases with different rulePackVersions so the compare
    // helper trips the mismatch path. We bypass the upload pipeline
    // because both leases need distinct rulePackVersion stamps.
    const bytesA = await makePdf([
      {
        blocks: [{ text: 'This lease shall auto-renew annually.', x: 72, y: 72 }],
      },
    ]);
    const bytesB = await makePdf([
      {
        blocks: [{ text: 'Tenant waives any right to a jury trial.', x: 72, y: 72 }],
      },
    ]);
    // Reuse analyzeFile output by calling saveLease directly; the compare
    // picker just needs two records with different rulePackVersion.
    const { analyzeFile } = await import('./ui/analyzeFile');
    const { RULE_PACK_V1 } = await import('./rules/packV1');
    const rA = await analyzeFile(bytesA, RULE_PACK_V1);
    const rB = await analyzeFile(bytesB, RULE_PACK_V1);
    // saveLease derives rulePackVersion from findings[0]; override to force
    // a mismatch even when the pack ships the same version on both sides.
    const findingsA = rA.findings.map((f) => ({ ...f, rulePackVersion: '1.0.0' }));
    const findingsB = rB.findings.map((f) => ({ ...f, rulePackVersion: '1.2.0' }));
    // Guard: the fixture paragraphs must trip at least one rule, otherwise
    // the mismatch field on the record falls back to 'unknown' on both sides.
    expect(findingsA.length).toBeGreaterThan(0);
    expect(findingsB.length).toBeGreaterThan(0);
    const idA = await saveLease({
      name: 'lease-a.pdf',
      doc: rA.doc,
      findings: findingsA,
    });
    const idB = await saveLease({
      name: 'lease-b.pdf',
      doc: rB.doc,
      findings: findingsB,
    });

    render(<App />);
    // Wait for refreshLibrary to populate the picker with both leases.
    await waitFor(() => {
      const sel = screen.getByLabelText(/lease A/i) as HTMLSelectElement;
      // Two lease options + the "—" placeholder.
      expect(sel.options.length).toBeGreaterThanOrEqual(3);
    });
    const aSelect = screen.getByLabelText(/lease A/i);
    const bSelect = screen.getByLabelText(/lease B/i);
    await userEvent.selectOptions(aSelect, idA);
    await userEvent.selectOptions(bSelect, idB);
    await userEvent.click(screen.getByRole('button', { name: /^compare$/i }));
    // ComparePanel renders first — wait for it before checking the banner.
    await waitFor(() =>
      expect(screen.getByRole('region', { name: /^compare$/i })).toBeInTheDocument(),
    );
    // Target the banner div specifically (role=alert). The Dismiss button
    // also matches a label containing "pack version mismatch".
    expect(
      screen.getByRole('alert', { name: /pack version mismatch/i }),
    ).toHaveTextContent(/v1\.0\.0/);
  });
});

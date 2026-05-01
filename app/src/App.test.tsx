import { afterAll, afterEach, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./ui/HybridFeedbackButton', () => ({
  HybridFeedbackButton: () => null,
}));

vi.mock('./ui/HybridPrecisionDisclosure', () => ({
  HybridPrecisionDisclosure: () => null,
}));

vi.mock('./ocr/runOcr', () => ({
  runOcr: vi.fn(
    async (
      _bytes: Uint8Array,
      opts?: { onProgress?: (p: { pct: number; stage: string }) => void },
    ) => {
      opts?.onProgress?.({ pct: 0, stage: 'starting' });
      opts?.onProgress?.({ pct: 1, stage: 'done' });
      return {
        pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
        paragraphs: [
          { page: 1, text: 'Any dispute shall be resolved by binding arbitration, not court.' },
          { page: 1, text: 'Tenant waives any right to a jury trial.' },
        ],
        sections: [],
        raw: '',
      };
    },
  ),
}));
import { App } from './App';
import { makePdf } from './parser/testFixtures';
import {
  _resetDbForTests,
  getStandardId,
  listAllLeaseRecords,
  listLeases,
  openLeaseDb,
} from './storage/storage';
import { _resetPacksDbForTests, openPacksDb } from './rules/packStorage';
import { _resetAuditDbForTests, AUDIT_DB_NAME, openAuditDb } from './audit/auditLog';
import { _resetBulkDedupDbForTests, BULK_DEDUP_DB_NAME } from './workflow/bulkImport';

async function wipeDb(name: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => resolve();
    req.onblocked = (): void => resolve();
  });
}

// Wave 30 Part B: SectionGroup defaults closed and reads localStorage.
// Several tests reach into bottom-pane content (My Leases, audit log,
// jurisdiction, severity overrides, etc.); install a working memory
// localStorage shim per-test (jsdom's stub lacks working get/set in this
// project — see I18nProvider.test.tsx) and pre-seed all sections open.
function installAccordionStorageOpen(): void {
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
  window.localStorage.setItem('lg.accordion.bottom-pane-this-lease.open', '1');
  window.localStorage.setItem('lg.accordion.bottom-pane-library.open', '1');
  window.localStorage.setItem('lg.accordion.bottom-pane-governance.open', '1');
}

// Suppress unhandled `InvalidStateError` rejections that fire when a
// fire-and-forget IDB call (e.g. App's `void clearAllFlow(...)` or
// `refreshAuditLog`) resolves after its DB cache was nulled by the next
// test's `beforeEach`. These are benign (the promise would update an
// unmounted component's state) but pollute vitest output and fail
// `test:coverage` on CI. Mirrors the same guard in `App.panels.test.tsx`.
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
const proc = (globalThis as unknown as { process?: NodeProcessLike }).process;
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
  // RTL auto-cleanup normally runs, but explicitly unmount here so any
  // in-flight `refreshLibrary` / `clearAllFlow` effects tied to the
  // rendered <App /> see their parents torn down BEFORE the next
  // `beforeEach` nulls the cached db promises.
  cleanup();
});

beforeEach(async () => {
  installAccordionStorageOpen();
  try {
    (await openLeaseDb()).close();
  } catch {
    // ignore
  }
  try {
    (await openPacksDb()).close();
  } catch {
    // ignore
  }
  try {
    (await openAuditDb()).close();
  } catch {
    // ignore
  }
  _resetDbForTests();
  _resetPacksDbForTests();
  _resetAuditDbForTests();
  _resetBulkDedupDbForTests();
  await new Promise<void>((r) => setTimeout(r, 0));
  await wipeDb('leaseguard');
  await wipeDb('leaseguard-packs');
  await wipeDb(AUDIT_DB_NAME);
  await wipeDb(BULK_DEDUP_DB_NAME);
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
  // Wave 51-B — UploadView only renders when status === 'idle'. If a
  // lease is already loaded, click the header's "New lease" reset to
  // return to the upload landing before grabbing the input.
  const reset = screen.queryByRole('button', { name: /new lease/i });
  if (reset) await userEvent.click(reset);
  // Wave 53-B-3 — UploadView only renders on the Current tab. If a prior
  // step moved the user into Settings (etc.), switch back so the upload
  // input mounts.
  const currentTab = screen.queryByRole('tab', { name: /^current lease$/i });
  if (currentTab && currentTab.getAttribute('aria-selected') !== 'true') {
    await userEvent.click(currentTab);
  }
  const file = await makeLeaseFile(name);
  // UploadView is lazy-loaded; wait for its chunk before grabbing the input.
  const input = (await screen.findByLabelText(/upload lease/i)) as HTMLInputElement;
  await userEvent.upload(input, file);
  // Wait for the findings aside to render first — that's the surface that
  // surfaces rule titles. After Wave 53-B-3a moved SeverityOverridesPanel
  // off Current, FindingsPanel is the only "auto-renewal" source on
  // Current. CI is slower than local; bump the timeout to 5s.
  await waitFor(
    () => expect(screen.getByRole('complementary', { name: /findings/i })).toBeInTheDocument(),
    { timeout: 5000 },
  );
  await waitFor(() => expect(screen.getAllByText(/auto-renewal/i).length).toBeGreaterThan(0), {
    timeout: 5000,
  });
}

describe('App', () => {
  it('renders the upload control in idle state', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /leaseguard/i })).toBeInTheDocument();
    // UploadView is lazy-loaded — wait for the chunk to land before asserting.
    await waitFor(() => expect(screen.getByLabelText(/upload lease/i)).toBeInTheDocument());
  });

  it('shows findings after a successful upload and analysis', async () => {
    render(<App />);
    await uploadLease();
    // Scope to the findings <aside>; rule titles also surface in the
    // SeverityOverridesPanel, which would cause `getByText` ambiguity.
    const findings = screen.getByRole('complementary', { name: /findings/i });
    expect(within(findings).getByText(/waiver of jury trial/i)).toBeInTheDocument();
  });

  it('saves to the library after analysis and shows it in My Leases', async () => {
    render(<App />);
    await uploadLease();
    await gotoSettings();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open lease\.pdf/i })).toBeInTheDocument();
    });
  });

  it('surfaces a parse error without crashing', async () => {
    render(<App />);
    const bogus = new File([new Uint8Array([1, 2, 3])], 'bad.pdf', { type: 'application/pdf' });
    const input = (await screen.findByLabelText(/upload lease/i)) as HTMLInputElement;
    await userEvent.upload(input, bogus);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    // Wave 56-B — the analysis-error region offers a recovery affordance
    // that resets the pipeline back to the idle UploadView.
    await userEvent.click(screen.getByRole('button', { name: /try another file/i }));
    await waitFor(() =>
      expect(screen.getByRole('region', { name: /upload/i })).toBeInTheDocument(),
    );
  });

  it('clicking a finding opens the finding-detail modal', async () => {
    render(<App />);
    await uploadLease();
    // Wave 51-D — SelectedFindingCard replaced by FindingDetailModal.
    const findings = screen.getByRole('complementary', { name: /findings/i });
    await userEvent.click(
      within(findings).getAllByRole('button', { name: /waiver of jury trial/i })[0]!,
    );
    // OnboardingTour also mounts a dialog in some test environments;
    // assert via the heading that the finding modal opened.
    expect(screen.getByRole('heading', { name: /jury trial/i })).toBeInTheDocument();
  });

  it('loads a sample lease via "Try a sample lease" button', async () => {
    const bytes = await makePdf([
      { blocks: [{ text: 'This lease shall auto-renew annually.', x: 72, y: 72 }] },
    ]);
    // Wave 53-B-3 — return a fresh Response per fetch call. mockResolvedValue
    // hands back the same Response object whose body can only be read once,
    // and the App may issue background fetches before the sample-lease
    // click that would otherwise drain it.
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(bytes as BlobPart, { status: 200 }));
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: /try a sample lease/i }));
    await waitFor(() => expect(screen.getAllByText(/auto-renewal/i).length).toBeGreaterThan(0));
    fetchMock.mockRestore();
  });

  it('reports an error when the sample fetch fails', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('nope', { status: 404 }));
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /try a sample lease/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    fetchMock.mockRestore();
  });

  it('renames a library entry via prompt', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Renamed.pdf');
    render(<App />);
    await uploadLease('Original.pdf');
    await gotoSettings();
    await userEvent.click(screen.getByRole('button', { name: /rename original\.pdf/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open renamed\.pdf/i })).toBeInTheDocument();
    });
    promptSpy.mockRestore();
  });

  it('deletes a library entry', async () => {
    render(<App />);
    await uploadLease('Gone.pdf');
    await gotoSettings();
    await userEvent.click(screen.getByRole('button', { name: /delete gone\.pdf/i }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /open gone\.pdf/i })).not.toBeInTheDocument();
    });
  });

  it('set-as-standard marks the badge and triggers auto-compare on next upload', async () => {
    render(<App />);
    await uploadLease('Standard.pdf');
    await gotoSettings();
    await userEvent.click(screen.getByRole('button', { name: /set standard\.pdf as standard/i }));
    await waitFor(async () => {
      expect(await getStandardId()).toBeTruthy();
    });
    await uploadLease('New.pdf');
    await gotoSettings();
    await waitFor(() => {
      expect(screen.getByRole('region', { name: /compare/i })).toBeInTheDocument();
    });
  });

  // Wave 51-A — clear-all + archive controls live under the Settings tab.
  // Tests below switch to the Settings panel before clicking those buttons.
  async function gotoSettings(): Promise<void> {
    await userEvent.click(screen.getByRole('tab', { name: /settings/i }));
  }

  it('clear-all wipes leases after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    await uploadLease('ToDelete.pdf');
    await gotoSettings();
    await userEvent.click(screen.getByRole('button', { name: /clear all saved data/i }));
    await waitFor(async () => {
      expect((await listLeases()).length).toBe(0);
    });
    confirmSpy.mockRestore();
  });

  it('clear-all aborts when confirmation is declined', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<App />);
    await uploadLease('Keep.pdf');
    await gotoSettings();
    await userEvent.click(screen.getByRole('button', { name: /clear all saved data/i }));
    expect((await listLeases()).length).toBe(1);
    confirmSpy.mockRestore();
  });

  it('export-archive button triggers a download with the right extension', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('secret');
    const clickSpy = vi.fn();
    const origCreate = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') el.click = clickSpy;
      return el;
    });
    URL.createObjectURL = vi.fn().mockReturnValue('blob:x');
    URL.revokeObjectURL = vi.fn();

    render(<App />);
    await uploadLease('ToExport.pdf');
    await gotoSettings();
    await userEvent.click(screen.getByRole('button', { name: /export encrypted archive/i }));
    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
    createSpy.mockRestore();
    promptSpy.mockRestore();
  });

  it('cancelling export-archive prompt is a no-op', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
    render(<App />);
    await uploadLease('NoExport.pdf');
    const before = (await listAllLeaseRecords()).length;
    await gotoSettings();
    await userEvent.click(screen.getByRole('button', { name: /export encrypted archive/i }));
    expect((await listAllLeaseRecords()).length).toBe(before);
    promptSpy.mockRestore();
  });

  it('opens a library entry and re-shows its findings', async () => {
    render(<App />);
    await uploadLease('Reopen.pdf');
    // Wave 51-B — UploadView only mounts in idle state; click "New lease"
    // before grabbing a fresh upload input for the second lease.
    await userEvent.click(screen.getByRole('button', { name: /new lease/i }));
    await userEvent.upload(
      (await screen.findByLabelText(/upload lease/i)) as HTMLInputElement,
      await makeLeaseFile('Other.pdf'),
    );
    await gotoSettings();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /open reopen\.pdf/i })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('button', { name: /open reopen\.pdf/i }));
    await waitFor(() => expect(screen.getAllByText(/auto-renewal/i).length).toBeGreaterThan(0));
  });

  it('export findings JSON and HTML each trigger a download', async () => {
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
    await uploadLease('Report.pdf');
    await userEvent.click(screen.getByRole('button', { name: /export findings \(json\)/i }));
    await userEvent.click(
      screen.getByRole('button', { name: /export findings \(printable html\)/i }),
    );

    // HTML export lazy-imports `storage/exportHtml`; userEvent doesn't
    // await that dynamic import, so wait for the download to land.
    await waitFor(() => expect(aClicks).toContain('Report-findings.html'));
    expect(aClicks).toContain('Report-findings.json');
    createSpy.mockRestore();
  });

  it('"/" hotkey focuses the findings search box', async () => {
    render(<App />);
    await uploadLease();
    document.body.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    expect(document.activeElement).toBe(
      screen.getByRole('searchbox', { name: /search findings/i }),
    );
  });

  it('Attempt OCR button runs OCR and replaces findings with the OCR-derived ones', async () => {
    render(<App />);
    await uploadLease('Scanned.pdf');
    // The sample lease fixture has short blocks (<100 chars/page), so the
    // needsOcr heuristic flags it and the "Attempt OCR" button appears.
    const ocrButton = await screen.findByRole('button', { name: /attempt ocr/i });
    await userEvent.click(ocrButton);
    // Progress text transitions through at least one running state. Scope
    // to the findings <aside> because rule titles also appear in the
    // SeverityOverridesPanel, which triggers `getByText` ambiguity.
    await waitFor(() => {
      const findings = screen.getByRole('complementary', { name: /findings/i });
      expect(within(findings).getByText(/mandatory arbitration/i)).toBeInTheDocument();
    });
    const findings = screen.getByRole('complementary', { name: /findings/i });
    expect(within(findings).getByText(/waiver of jury trial/i)).toBeInTheDocument();
  });

  it('importing an encrypted archive replaces the library on confirm', async () => {
    // Export to get a valid archive blob.
    const { exportEncryptedArchive } = await import('./storage/archive');
    render(<App />);
    await uploadLease('WillReplace.pdf');
    const recordsBefore = await listAllLeaseRecords();
    const archiveBytes = await exportEncryptedArchive(recordsBefore, null, 'pw');

    const archiveFile = new File([archiveBytes as BlobPart], 'backup.lgarchive', {
      type: 'application/octet-stream',
    });
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('pw');
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    // Wave 51-A — import lives under Settings.
    await gotoSettings();
    // Wave 45-F — FileButton hides the input from the a11y tree; the
    // button carries the accessible name. Walk to the sibling input.
    const importInput = screen.getByRole('button', { name: /import encrypted archive/i })
      .nextElementSibling as HTMLInputElement;
    await userEvent.upload(importInput, archiveFile);
    await waitFor(async () => {
      expect((await listLeases()).length).toBe(1);
    });

    promptSpy.mockRestore();
    confirmSpy.mockRestore();
  });

  // Wave 26-A flow tests — multi-component coordination paths the
  // hook-level unit tests don't fully exercise.

  it('annotation flow: click finding → add note → note appears in the annotations panel', async () => {
    render(<App />);
    await uploadLease();

    // The annotations panel is gated on a paragraphIndex; clicking a
    // finding sets it. Pick the auto-renewal finding (paragraph 0 in
    // the fixture) and write a note.
    const findings = screen.getByRole('complementary', { name: /findings/i });
    await userEvent.click(
      within(findings).getAllByRole('button', { name: /auto-renewal clause/i })[0]!,
    );

    const noteForm = await screen.findByRole('form', { name: /add note/i });
    const textarea = within(noteForm).getByLabelText(/new note/i);
    await userEvent.type(textarea, 'remember to send the cancellation letter');
    await userEvent.click(within(noteForm).getByRole('button', { name: /add note/i }));

    // Saved note renders inside the annotations section, not the form.
    const annotations = screen.getByRole('region', { name: /annotations/i });
    await waitFor(() =>
      expect(
        within(annotations).getByText(/remember to send the cancellation letter/i),
      ).toBeInTheDocument(),
    );
  });

  it('severity-override flow: change a rule severity → reanalyze fires and findings re-render', async () => {
    render(<App />);
    await uploadLease();
    await gotoSettings();

    // Auto-renewal is medium-severity by default. Bump to high via the
    // SeverityOverridesPanel.
    const overrides = await screen.findByRole('region', { name: /severity overrides/i });
    const select = within(overrides).getByLabelText(/override severity for auto-renewal/i);
    // Rule severities use info / warn / error (the display layer maps
    // these to Info / Medium / High in FindingsPanel).
    await userEvent.selectOptions(select, 'error');

    // FindingsPanel is on Current; switch back to verify the re-render.
    await userEvent.click(screen.getByRole('tab', { name: /^current lease$/i }));

    // useReanalyzeOnRulesChange picks up the override change and re-runs
    // analyze. After it completes, the auto-renewal finding should be in
    // the High section. Wave 51-E added a severity-chip filter row at
    // the top whose label also contains "High (N)" — getAllByText now
    // returns ≥1 match (chip + section heading); assert each carries a
    // non-zero count.
    const findings = screen.getByRole('complementary', { name: /findings/i });
    await waitFor(() => {
      const matches = within(findings).getAllByText(/^High \(\d+\)$/);
      expect(matches.length).toBeGreaterThan(0);
      for (const el of matches) expect(el.textContent).toMatch(/[1-9]/);
    });
  });
});

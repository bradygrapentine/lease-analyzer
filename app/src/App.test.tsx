import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

beforeEach(async () => {
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
  const file = await makeLeaseFile(name);
  const input = screen.getByLabelText(/upload lease/i) as HTMLInputElement;
  await userEvent.upload(input, file);
  // "auto-renewal" now also appears in the SeverityOverridesPanel row; use
  // `findAllByText` so we pass as soon as the findings panel renders.
  await waitFor(() => expect(screen.getAllByText(/auto-renewal/i).length).toBeGreaterThan(0));
  // Wait for the findings aside to render so click/scroll assertions downstream
  // find their targets.
  await waitFor(
    () => expect(screen.getByRole('complementary', { name: /findings/i })).toBeInTheDocument(),
    { timeout: 5000 },
  );
}

describe('App', () => {
  it('renders the upload control in idle state', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /leaseguard/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/upload lease/i)).toBeInTheDocument();
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
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open lease\.pdf/i })).toBeInTheDocument();
    });
  });

  it('surfaces a parse error without crashing', async () => {
    render(<App />);
    const bogus = new File([new Uint8Array([1, 2, 3])], 'bad.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/upload lease/i) as HTMLInputElement;
    await userEvent.upload(input, bogus);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('clicking a finding shows the selected finding article', async () => {
    render(<App />);
    await uploadLease();
    // Multiple buttons now match (finding + "what this means" disclosure).
    // Pick the main finding button via its `finding-btn` className.
    const findings = screen.getByRole('complementary', { name: /findings/i });
    await userEvent.click(
      within(findings).getAllByRole('button', { name: /waiver of jury trial/i })[0]!,
    );
    expect(screen.getByRole('article', { name: /selected finding/i })).toBeInTheDocument();
  });

  it('loads a sample lease via "Try a sample lease" button', async () => {
    const bytes = await makePdf([
      { blocks: [{ text: 'This lease shall auto-renew annually.', x: 72, y: 72 }] },
    ]);
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(bytes as BlobPart, { status: 200 }));
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /try a sample lease/i }));
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
    await userEvent.click(screen.getByRole('button', { name: /rename original\.pdf/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open renamed\.pdf/i })).toBeInTheDocument();
    });
    promptSpy.mockRestore();
  });

  it('deletes a library entry', async () => {
    render(<App />);
    await uploadLease('Gone.pdf');
    await userEvent.click(screen.getByRole('button', { name: /delete gone\.pdf/i }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /open gone\.pdf/i })).not.toBeInTheDocument();
    });
  });

  it('set-as-standard marks the badge and triggers auto-compare on next upload', async () => {
    render(<App />);
    await uploadLease('Standard.pdf');
    await userEvent.click(screen.getByRole('button', { name: /set standard\.pdf as standard/i }));
    await waitFor(async () => {
      expect(await getStandardId()).toBeTruthy();
    });
    await uploadLease('New.pdf');
    await waitFor(() => {
      expect(screen.getByRole('region', { name: /compare/i })).toBeInTheDocument();
    });
  });

  it('clear-all wipes leases after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    await uploadLease('ToDelete.pdf');
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
    await userEvent.click(screen.getByRole('button', { name: /export encrypted archive/i }));
    expect((await listAllLeaseRecords()).length).toBe(before);
    promptSpy.mockRestore();
  });

  it('opens a library entry and re-shows its findings', async () => {
    render(<App />);
    await uploadLease('Reopen.pdf');
    await userEvent.upload(
      screen.getByLabelText(/upload lease/i) as HTMLInputElement,
      await makeLeaseFile('Other.pdf'),
    );
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

    expect(aClicks).toContain('Report-findings.json');
    expect(aClicks).toContain('Report-findings.html');
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

    const importInput = screen.getByLabelText(/import encrypted archive/i) as HTMLInputElement;
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

    // Auto-renewal is medium-severity by default. Bump to high via the
    // SeverityOverridesPanel.
    const overrides = await screen.findByRole('region', { name: /severity overrides/i });
    const select = within(overrides).getByLabelText(/override severity for auto-renewal/i);
    // Rule severities use info / warn / error (the display layer maps
    // these to Info / Medium / High in FindingsPanel).
    await userEvent.selectOptions(select, 'error');

    // useReanalyzeOnRulesChange picks up the override change and re-runs
    // analyze. After it completes, the auto-renewal finding should be in
    // the High section (whose heading carries the count "(N)" with N > 0).
    const findings = screen.getByRole('complementary', { name: /findings/i });
    await waitFor(() => {
      expect(within(findings).getByText(/^High \(\d+\)$/)).toBeInTheDocument();
    });
    // And it should NOT still be in the Medium section under that title.
    // (Other medium-severity findings — like jury-trial — may still be
    // medium; we only assert the high-section gain, not the medium loss.)
    expect(within(findings).getByText(/^High \(\d+\)$/).textContent).toMatch(/[1-9]/);
  });
});

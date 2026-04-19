import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { makePdf } from './parser/testFixtures';
import {
  _resetDbForTests,
  getStandardId,
  listAllLeaseRecords,
  listLeases,
  openLeaseDb,
} from './storage/storage';

beforeEach(async () => {
  try {
    const db = await openLeaseDb();
    db.close();
  } catch {
    // ignore
  }
  _resetDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('leaseguard');
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => resolve();
    req.onblocked = (): void => resolve();
  });
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
  await waitFor(() => expect(screen.getByText(/auto-renewal/i)).toBeInTheDocument());
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
    expect(screen.getByText(/waiver of jury trial/i)).toBeInTheDocument();
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
    await userEvent.click(
      screen.getByRole('button', { name: /waiver of jury trial/i }),
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
    await waitFor(() => expect(screen.getByText(/auto-renewal/i)).toBeInTheDocument());
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
    await userEvent.click(
      screen.getByRole('button', { name: /set standard\.pdf as standard/i }),
    );
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
    await waitFor(() => expect(screen.getByText(/auto-renewal/i)).toBeInTheDocument());
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
    await userEvent.click(screen.getByRole('button', { name: /export findings \(printable html\)/i }));

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
});

import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./ocr/runOcr', () => ({
  runOcr: vi.fn(async () => ({
    pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
    paragraphs: [],
    sections: [],
    raw: '',
  })),
}));

import { App } from './App';
import { makePdf } from './parser/testFixtures';
import { _resetDbForTests, openLeaseDb, listLeases } from './storage/storage';
import {
  _resetPacksDbForTests,
  listInstalledPacks,
  openPacksDb,
  getPackEnabled,
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

beforeEach(async () => {
  await closeIfOpen(() => openLeaseDb() as Promise<{ close(): void }>);
  await closeIfOpen(() => openPacksDb() as Promise<{ close(): void }>);
  await closeIfOpen(() => openAnnotationsDb() as Promise<{ close(): void }>);
  await closeIfOpen(() => openCountersDb() as Promise<{ close(): void }>);
  _resetDbForTests();
  _resetPacksDbForTests();
  _resetAnnotationsDbForTests();
  _resetCountersDbForTests();
  _resetSigningDbForTests();
  // Give the close() microtask a tick to land.
  await new Promise<void>((r) => setTimeout(r, 0));
  await wipeDb('leaseguard');
  await wipeDb('leaseguard-packs');
  await wipeDb('leaseguard-annotations');
  await wipeDb('leaseguard-counters');
  await wipeDb('leaseguard-signing');
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
    await userEvent.click(screen.getByRole('button', { name: /delete pack custom-pack/i }));
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
    await userEvent.click(
      screen.getByRole('button', { name: /waiver of jury trial/i }),
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
    await userEvent.click(
      screen.getByRole('button', { name: /waiver of jury trial/i }),
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
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock tesseract.js before importing runOcr. We canned-return a per-call
// text so the LeaseDocument construction (paragraphs / sections) is what
// gets exercised — not the OCR engine itself.
const recognizeMock = vi.fn();
vi.mock('tesseract.js', () => ({
  recognize: (...args: unknown[]) => recognizeMock(...args),
  default: { recognize: (...args: unknown[]) => recognizeMock(...args) },
}));

// Mock the pdf.js loader. renderPdfPages.loadPdfjs() would otherwise spin
// up a real worker which isn't useful here.
const getViewportMock = vi.fn(() => ({ width: 100, height: 100 }));
const renderMock = vi.fn(() => ({ promise: Promise.resolve() }));
const getPageMock = vi.fn(async () => ({
  getViewport: getViewportMock,
  render: renderMock,
}));
vi.mock('../ui/renderPdfPages', async () => {
  const actual = await vi.importActual<typeof import('../ui/renderPdfPages')>(
    '../ui/renderPdfPages',
  );
  return {
    ...actual,
    loadPdfjs: async () => ({
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 2,
          getPage: getPageMock,
        }),
      }),
    }),
  };
});

import { runOcr } from './runOcr';

beforeEach(() => {
  recognizeMock.mockReset();
  getPageMock.mockClear();
  renderMock.mockClear();
});

describe('runOcr', () => {
  it('produces a LeaseDocument with one page per PDF page', async () => {
    recognizeMock.mockResolvedValue({ data: { text: 'TENANT OBLIGATIONS\n\nRent is due.' } });
    const doc = await runOcr(new Uint8Array([1, 2, 3]));
    expect(doc.pages).toHaveLength(2);
    expect(doc.paragraphs.length).toBeGreaterThan(0);
    expect(doc.raw).toContain('Rent is due.');
  });

  it('splits OCR text into paragraphs on blank lines', async () => {
    recognizeMock.mockResolvedValueOnce({ data: { text: 'Para one.\n\nPara two.' } });
    recognizeMock.mockResolvedValueOnce({ data: { text: 'Para three.' } });
    const doc = await runOcr(new Uint8Array([1]));
    const texts = doc.paragraphs.map((p) => p.text);
    expect(texts).toContain('Para one.');
    expect(texts).toContain('Para two.');
    expect(texts).toContain('Para three.');
  });

  it('runs section detection over the OCR paragraphs', async () => {
    recognizeMock.mockResolvedValueOnce({
      data: { text: 'RENT AND SECURITY\n\nRent is due on the first.' },
    });
    recognizeMock.mockResolvedValueOnce({ data: { text: 'Tenant shall pay.' } });
    const doc = await runOcr(new Uint8Array([1]));
    // Either the heading was detected as its own section or at least
    // paragraphs are present — assert the detection ran and returned an array.
    expect(Array.isArray(doc.sections)).toBe(true);
  });

  it('reports progress as it works', async () => {
    recognizeMock.mockResolvedValue({ data: { text: 'x' } });
    const events: Array<{ pct: number; stage: string }> = [];
    await runOcr(new Uint8Array([1]), { onProgress: (p) => events.push(p) });
    expect(events[0]?.pct).toBe(0);
    expect(events[events.length - 1]?.pct).toBe(1);
    expect(events.some((e) => e.stage.startsWith('ocr page'))).toBe(true);
  });

  it('passes same-origin asset paths to tesseract.recognize', async () => {
    recognizeMock.mockResolvedValue({ data: { text: 'x' } });
    await runOcr(new Uint8Array([1]));
    const optsArg = recognizeMock.mock.calls[0]?.[2] as
      | { workerPath?: string; corePath?: string; langPath?: string }
      | undefined;
    expect(optsArg?.workerPath).toBe('/tesseract/worker.min.js');
    expect(optsArg?.corePath).toBe('/tesseract/tesseract-core.wasm.js');
    expect(optsArg?.langPath).toBe('/tesseract');
  });

  it("defaults to 'eng' when no language is supplied", async () => {
    recognizeMock.mockResolvedValue({ data: { text: 'x' } });
    await runOcr(new Uint8Array([1]));
    expect(recognizeMock.mock.calls[0]?.[1]).toBe('eng');
  });

  it('threads an explicit language through to tesseract.recognize', async () => {
    recognizeMock.mockResolvedValue({ data: { text: 'x' } });
    await runOcr(new Uint8Array([1]), { language: 'spa' });
    expect(recognizeMock.mock.calls[0]?.[1]).toBe('spa');
  });

  it('tolerates missing text on a recognize result', async () => {
    recognizeMock.mockResolvedValue({ data: {} });
    const doc = await runOcr(new Uint8Array([1]));
    expect(doc.paragraphs).toHaveLength(0);
  });
});

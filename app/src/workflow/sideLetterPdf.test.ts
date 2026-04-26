import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildSideLetterPdf } from './sideLetterPdf';
import type { RedlineEdit } from '../redline/redline';

function mkEdit(over: Partial<RedlineEdit> = {}): RedlineEdit {
  return {
    leaseId: 'L1',
    paragraphIndex: 0,
    before: 'Original text.',
    after: 'Amended text.',
    updatedAt: '2026-04-25T00:00:00.000Z',
    ...over,
  };
}

const noSection = (): undefined => undefined;

describe('buildSideLetterPdf', () => {
  it('returns valid PDF bytes that pdf-lib can re-parse', async () => {
    const bytes = await buildSideLetterPdf({
      leaseName: 'Acme Lease',
      edits: [mkEdit()],
      sectionFor: noSection,
    });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
    // PDF signature.
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    expect(header).toBe('%PDF-');
    const reparsed = await PDFDocument.load(bytes);
    expect(reparsed.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(reparsed.getTitle()).toBe('Acme Lease side letter');
  });

  it('produces byte-identical output for identical inputs (deterministic)', async () => {
    const input = {
      leaseName: 'Acme Lease',
      leaseDate: '2026-01-01',
      edits: [
        mkEdit({ paragraphIndex: 0, after: 'First amendment.' }),
        mkEdit({ paragraphIndex: 1, after: 'Second amendment.' }),
      ],
      sectionFor: noSection,
      signer: { name: 'Jane Doe', title: 'Counsel' },
    };
    const a = await buildSideLetterPdf(input);
    const b = await buildSideLetterPdf(input);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        throw new Error(`PDF bytes diverge at offset ${i}`);
      }
    }
  });

  it('renders an empty-clause notice when no edits are present', async () => {
    const bytes = await buildSideLetterPdf({
      leaseName: 'Empty Lease',
      edits: [],
      sectionFor: noSection,
    });
    const reparsed = await PDFDocument.load(bytes);
    expect(reparsed.getPageCount()).toBe(1);
  });

  it('folds duplicate paragraphIndex edits like the HTML builder', async () => {
    const dupBytes = await buildSideLetterPdf({
      leaseName: 'L',
      edits: [
        mkEdit({ paragraphIndex: 0, after: 'First wins.' }),
        mkEdit({ paragraphIndex: 0, after: 'Second loses.' }),
      ],
      sectionFor: noSection,
    });
    const singleBytes = await buildSideLetterPdf({
      leaseName: 'L',
      edits: [mkEdit({ paragraphIndex: 0, after: 'First wins.' })],
      sectionFor: noSection,
    });
    expect(dupBytes.length).toBe(singleBytes.length);
  });

  it('uses the section label when sectionFor returns one', async () => {
    const bytes = await buildSideLetterPdf({
      leaseName: 'L',
      edits: [mkEdit({ paragraphIndex: 7 })],
      sectionFor: (i) => (i === 7 ? '4.2' : undefined),
    });
    const reparsed = await PDFDocument.load(bytes);
    expect(reparsed.getPageCount()).toBe(1);
  });

  it('paginates when many clauses overflow a single page', async () => {
    const edits: RedlineEdit[] = [];
    for (let i = 0; i < 60; i++) {
      edits.push(mkEdit({ paragraphIndex: i, after: `Long amendment number ${i}. `.repeat(8) }));
    }
    const bytes = await buildSideLetterPdf({
      leaseName: 'Big Lease',
      edits,
      sectionFor: noSection,
    });
    const reparsed = await PDFDocument.load(bytes);
    expect(reparsed.getPageCount()).toBeGreaterThan(1);
  });
});

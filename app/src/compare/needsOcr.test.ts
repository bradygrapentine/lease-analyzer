import { describe, it, expect } from 'vitest';
import { needsOcr, OCR_CHAR_THRESHOLD } from './needsOcr';
import { parseLease } from '../parser/parseLease';
import { makePdf } from '../parser/testFixtures';
import { buildScannedFixturePdf } from '../../scripts/build-scanned-fixture.mjs';
import type { LeaseDocument, PageText } from '../parser/types';

function page(pageNumber: number, text = ''): PageText {
  return {
    pageNumber,
    width: 612,
    height: 792,
    items: text ? [{ text, x: 72, y: 72, width: text.length * 6, height: 12, fontSize: 12 }] : [],
  };
}

function doc(pages: PageText[]): LeaseDocument {
  return { pages, paragraphs: [], sections: [], raw: '' };
}

describe('needsOcr', () => {
  it('returns true when average chars per page is below threshold', () => {
    const result = needsOcr(doc([page(1, ''), page(2, ''), page(3, '')]));
    expect(result.likelyScanned).toBe(true);
    expect(result.avgCharsPerPage).toBe(0);
  });

  it('returns false for a text-rich document', () => {
    const body = 'The quick brown fox jumps over the lazy dog. '.repeat(20);
    const result = needsOcr(doc([page(1, body), page(2, body)]));
    expect(result.likelyScanned).toBe(false);
    expect(result.avgCharsPerPage).toBeGreaterThan(100);
  });

  it('returns false for an empty document', () => {
    const result = needsOcr(doc([]));
    expect(result.likelyScanned).toBe(false);
    expect(result.avgCharsPerPage).toBe(0);
  });

  it('flags a parsed image-only PDF as likelyScanned', async () => {
    const bytes = await buildScannedFixturePdf();
    const parsed = await parseLease(bytes);
    const result = needsOcr(parsed);
    expect(result.likelyScanned).toBe(true);
    expect(result.avgCharsPerPage).toBeLessThan(OCR_CHAR_THRESHOLD);
  });

  it('does not flag a parsed text-rich residential PDF', async () => {
    const sentence = 'Tenant shall pay rent of two thousand dollars per month.';
    const blocks = Array.from({ length: 8 }, (_, i) => ({
      text: sentence,
      x: 72,
      y: 72 + i * 30,
      size: 12,
    }));
    const bytes = await makePdf([{ blocks }, { blocks }]);
    const parsed = await parseLease(bytes);
    const result = needsOcr(parsed);
    expect(result.likelyScanned).toBe(false);
    expect(result.avgCharsPerPage).toBeGreaterThan(OCR_CHAR_THRESHOLD);
  });
});

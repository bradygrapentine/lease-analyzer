import { describe, it, expect } from 'vitest';
import { needsOcr } from './needsOcr';
import type { LeaseDocument, PageText } from '../parser/types';

function page(pageNumber: number, text = ''): PageText {
  return {
    pageNumber,
    width: 612,
    height: 792,
    items: text
      ? [{ text, x: 72, y: 72, width: text.length * 6, height: 12, fontSize: 12 }]
      : [],
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
});

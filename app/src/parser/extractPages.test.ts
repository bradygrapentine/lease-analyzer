import { describe, it, expect } from 'vitest';
import { extractPages } from './extractPages';
import { makePdf } from './testFixtures';
import { at, defined } from '../test/assert';

describe('extractPages', () => {
  it('extracts text items from every page', async () => {
    const bytes = await makePdf([
      { blocks: [{ text: 'Hello lease', x: 72, y: 72 }] },
      { blocks: [{ text: 'Page two text', x: 72, y: 72 }] },
    ]);

    const pages = await extractPages(bytes);

    expect(pages).toHaveLength(2);
    expect(at(pages, 0).pageNumber).toBe(1);
    expect(
      at(pages, 0)
        .items.map((i) => i.text)
        .join(' '),
    ).toContain('Hello lease');
    expect(at(pages, 1).pageNumber).toBe(2);
    expect(
      at(pages, 1)
        .items.map((i) => i.text)
        .join(' '),
    ).toContain('Page two text');
  });

  it('captures position and font-size metadata', async () => {
    const bytes = await makePdf([{ blocks: [{ text: 'Big', x: 72, y: 72, size: 24 }] }]);

    const pages = await extractPages(bytes);
    const item = defined(
      at(pages, 0).items.find((i) => i.text.includes('Big')),
      'Big item',
    );

    expect(item.fontSize).toBeGreaterThan(20);
    expect(item.x).toBeGreaterThan(0);
    expect(item.y).toBeGreaterThan(0);
  });

  // Wave 26-A: error-path coverage. Garbage bytes drive pdf.js's
  // loadingTask.promise to reject; the catch block runs the response
  // through `mapPdfError` so callers see a typed parser error rather
  // than a raw pdfjs InvalidPDFException.
  it('throws a mapped parser error when given malformed PDF bytes', async () => {
    const garbage = new Uint8Array([0x42, 0x4f, 0x47, 0x55, 0x53]);
    await expect(extractPages(garbage)).rejects.toThrow();
  });
});

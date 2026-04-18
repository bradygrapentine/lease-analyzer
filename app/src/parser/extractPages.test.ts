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
    expect(at(pages, 0).items.map((i) => i.text).join(' ')).toContain('Hello lease');
    expect(at(pages, 1).pageNumber).toBe(2);
    expect(at(pages, 1).items.map((i) => i.text).join(' ')).toContain('Page two text');
  });

  it('captures position and font-size metadata', async () => {
    const bytes = await makePdf([
      { blocks: [{ text: 'Big', x: 72, y: 72, size: 24 }] },
    ]);

    const pages = await extractPages(bytes);
    const item = defined(at(pages, 0).items.find((i) => i.text.includes('Big')), 'Big item');

    expect(item.fontSize).toBeGreaterThan(20);
    expect(item.x).toBeGreaterThan(0);
    expect(item.y).toBeGreaterThan(0);
  });
});

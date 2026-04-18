import { describe, it, expect } from 'vitest';
import { parseLease } from './parseLease';
import { makePdf } from './testFixtures';

describe('parseLease', () => {
  it('produces a LeaseDocument with pages, paragraphs, sections, and raw text', async () => {
    const bytes = await makePdf([
      {
        blocks: [
          { text: '1. Rent', x: 72, y: 72, size: 14 },
          { text: 'Tenant shall pay $2000 on the first.', x: 72, y: 110 },
          { text: '2. Term', x: 72, y: 170, size: 14 },
          { text: 'The term is twelve months.', x: 72, y: 200 },
        ],
      },
    ]);

    const doc = await parseLease(bytes);

    expect(doc.pages).toHaveLength(1);
    expect(doc.paragraphs.length).toBeGreaterThanOrEqual(4);
    expect(doc.sections.map((s) => s.heading)).toEqual(
      expect.arrayContaining(['Rent', 'Term']),
    );
    expect(doc.raw).toContain('Tenant shall pay');
    expect(doc.raw).toContain('twelve months');
  });
});

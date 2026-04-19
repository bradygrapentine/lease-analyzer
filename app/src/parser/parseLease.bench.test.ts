import { describe, it, expect } from 'vitest';
import { parseLease } from './parseLease';
import { makePdf, type PdfFixturePage } from './testFixtures';

const BUDGET_MS = 3000;

function pageFor(n: number): PdfFixturePage {
  const yStart = 72;
  const lineHeight = 16;
  const lines = [
    `Section ${n}. Agreement`,
    'Tenant shall pay rent on the first of each month.',
    'A late fee of $50 applies after five days.',
    'Tenant shall indemnify landlord against all claims.',
    'This lease shall auto-renew unless cancelled in writing.',
    'The prevailing party may recover attorney fees.',
    'All disputes go to binding arbitration.',
    'Tenant waives any right to a jury trial.',
  ];
  return {
    blocks: lines.map((text, i) => ({ text, x: 72, y: yStart + i * lineHeight })),
  };
}

describe('parseLease perf budget', () => {
  it(`parses a 50-page lease in under ${BUDGET_MS}ms`, async () => {
    const pages = Array.from({ length: 50 }, (_, i) => pageFor(i + 1));
    const bytes = await makePdf(pages);

    const start = performance.now();
    const doc = await parseLease(bytes);
    const elapsed = performance.now() - start;

    expect(doc.pages).toHaveLength(50);
    expect(doc.paragraphs.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(BUDGET_MS);
  }, 20_000);
});

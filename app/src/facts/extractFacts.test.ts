import { describe, it, expect } from 'vitest';
import { parseLease } from '../parser/parseLease';
import { makePdf, type PdfFixturePage } from '../parser/testFixtures';
import type { LeaseDocument, Paragraph } from '../parser/types';
import { extractLeaseFacts } from './extractFacts';

function pageFromLines(lines: string[], opts: { y0?: number; dy?: number } = {}): PdfFixturePage {
  const y0 = opts.y0 ?? 72;
  const dy = opts.dy ?? 18;
  return {
    blocks: lines.map((text, i) => ({ text, x: 72, y: y0 + i * dy })),
  };
}

/** Build a minimal LeaseDocument directly from paragraphs for focused unit tests. */
function docFromParagraphs(paragraphs: Paragraph[]): LeaseDocument {
  return {
    pages: [],
    paragraphs,
    sections: [],
    raw: paragraphs.map((p) => p.text).join('\n\n'),
  };
}

function p(text: string, page = 1): Paragraph {
  return { text, page };
}

describe('extractLeaseFacts — base rent', () => {
  it('picks the base rent from a high-confidence phrase', () => {
    const facts = extractLeaseFacts(
      docFromParagraphs([p('Base rent is $2,500 per month.')]),
    );
    expect(facts.baseRent).toEqual({
      amount: 2500,
      currency: 'USD',
      raw: '$2,500',
      page: 1,
    });
  });

  it('handles "monthly rent of $X" phrasing', () => {
    const facts = extractLeaseFacts(
      docFromParagraphs([p('Tenant shall pay monthly rent of $1,800.00.', 3)]),
    );
    expect(facts.baseRent?.amount).toBe(1800);
    expect(facts.baseRent?.page).toBe(3);
  });

  it('prefers the high-confidence base-rent phrase over a later generic rent mention', () => {
    const facts = extractLeaseFacts(
      docFromParagraphs([
        p('Late fee of $75 on unpaid rent.', 1),
        p('Base rent is $3,000 per month.', 2),
      ]),
    );
    expect(facts.baseRent?.amount).toBe(3000);
  });

  it('ignores deposit amounts when looking for rent', () => {
    const facts = extractLeaseFacts(
      docFromParagraphs([p('The security deposit is $2,000.')]),
    );
    expect(facts.baseRent).toBeNull();
  });

  it('returns null when no money is near a rent keyword', () => {
    const facts = extractLeaseFacts(docFromParagraphs([p('This agreement sets forth the terms.')]));
    expect(facts.baseRent).toBeNull();
  });
});

describe('extractLeaseFacts — security deposit', () => {
  it('picks the deposit from a high-confidence phrase', () => {
    const facts = extractLeaseFacts(
      docFromParagraphs([p('Security deposit is $2,000 due at signing.')]),
    );
    expect(facts.securityDeposit).toEqual({
      amount: 2000,
      currency: 'USD',
      raw: '$2,000',
      page: 1,
    });
  });

  it('falls back to the word "deposit"', () => {
    const facts = extractLeaseFacts(
      docFromParagraphs([p('Tenant shall tender a deposit of $1,500 at move-in.')]),
    );
    expect(facts.securityDeposit?.amount).toBe(1500);
  });

  it('returns null when no deposit is present', () => {
    const facts = extractLeaseFacts(
      docFromParagraphs([p('Base rent is $1,000 per month.')]),
    );
    expect(facts.securityDeposit).toBeNull();
  });
});

describe('extractLeaseFacts — term', () => {
  it('extracts months directly', () => {
    const facts = extractLeaseFacts(
      docFromParagraphs([p('The term of this lease is 24 months.')]),
    );
    expect(facts.termMonths).toBe(24);
  });

  it('converts years to months', () => {
    const facts = extractLeaseFacts(
      docFromParagraphs([p('The term of this lease shall be 2 years.')]),
    );
    expect(facts.termMonths).toBe(24);
  });

  it('handles hyphenated "12-month term"', () => {
    const facts = extractLeaseFacts(docFromParagraphs([p('This is a 12-month term.')]));
    expect(facts.termMonths).toBe(12);
  });

  it('returns null when no term phrasing appears', () => {
    const facts = extractLeaseFacts(docFromParagraphs([p('General provisions follow.')]));
    expect(facts.termMonths).toBeNull();
  });

  it('falls back to any paragraph with month/year if "term" is missing', () => {
    const facts = extractLeaseFacts(docFromParagraphs([p('Occupancy lasts 6 months.')]));
    expect(facts.termMonths).toBe(6);
  });
});

describe('extractLeaseFacts — notice period', () => {
  it('matches "30 days written notice"', () => {
    const facts = extractLeaseFacts(
      docFromParagraphs([p('Either party may terminate upon 30 days written notice.')]),
    );
    expect(facts.noticePeriodDays).toBe(30);
  });

  it('matches "60-day prior written notice"', () => {
    const facts = extractLeaseFacts(
      docFromParagraphs([p('Tenant shall give 60-day prior written notice of renewal.')]),
    );
    expect(facts.noticePeriodDays).toBe(60);
  });

  it('matches "14 days notice" without "written"', () => {
    const facts = extractLeaseFacts(
      docFromParagraphs([p('Landlord may enter upon 14 days notice.')]),
    );
    expect(facts.noticePeriodDays).toBe(14);
  });

  it('returns null when no notice phrasing appears', () => {
    const facts = extractLeaseFacts(docFromParagraphs([p('Rent is due on the first.')]));
    expect(facts.noticePeriodDays).toBeNull();
  });
});

describe('extractLeaseFacts — dates', () => {
  it('extracts ISO commencement/expiration near keywords', () => {
    const facts = extractLeaseFacts(
      docFromParagraphs([
        p('This lease shall commence on 2026-01-01.'),
        p('This lease shall expire on 2027-12-31.'),
      ]),
    );
    expect(facts.commencementDate).toBe('2026-01-01');
    expect(facts.expirationDate).toBe('2027-12-31');
  });

  it('normalizes "January 1, 2026" to ISO', () => {
    const facts = extractLeaseFacts(
      docFromParagraphs([p('The term shall commence on January 1, 2026.')]),
    );
    expect(facts.commencementDate).toBe('2026-01-01');
  });

  it('normalizes "1/1/2026" to ISO as M/D/YYYY', () => {
    const facts = extractLeaseFacts(
      docFromParagraphs([p('The term shall commence on 1/1/2026.')]),
    );
    expect(facts.commencementDate).toBe('2026-01-01');
  });

  it('handles "The term runs from X to Y"', () => {
    const facts = extractLeaseFacts(
      docFromParagraphs([
        p('The term runs from January 1, 2026 to December 31, 2027.'),
      ]),
    );
    expect(facts.commencementDate).toBe('2026-01-01');
    expect(facts.expirationDate).toBe('2027-12-31');
  });

  it('rejects nonsense dates', () => {
    const facts = extractLeaseFacts(
      docFromParagraphs([p('This shall commence on 2026-13-45.')]),
    );
    expect(facts.commencementDate).toBeNull();
  });

  it('returns null when no dates appear near keywords', () => {
    const facts = extractLeaseFacts(docFromParagraphs([p('Signed at City Hall.')]));
    expect(facts.commencementDate).toBeNull();
    expect(facts.expirationDate).toBeNull();
  });
});

describe('extractLeaseFacts — definitions', () => {
  it('extracts quoted-term "shall mean" definitions', () => {
    const facts = extractLeaseFacts(
      docFromParagraphs([p('"Premises" shall mean the real property located at 123 Main St.')]),
    );
    expect(facts.definitions).toEqual([
      {
        term: 'Premises',
        definition: 'the real property located at 123 Main St',
        page: 1,
        paragraphIndex: 0,
      },
    ]);
  });

  it('extracts "X means Y" with a capped term', () => {
    const facts = extractLeaseFacts(
      docFromParagraphs([p('Base Rent means the monthly rent specified in Section 2.')]),
    );
    expect(facts.definitions[0]?.term).toBe('Base Rent');
    expect(facts.definitions[0]?.definition).toContain('monthly rent');
  });

  it('deduplicates repeated definitions of the same term', () => {
    const facts = extractLeaseFacts(
      docFromParagraphs([
        p('"Tenant" shall mean Alice Smith.'),
        p('"Tenant" means Alice Smith again.'),
      ]),
    );
    expect(facts.definitions).toHaveLength(1);
  });

  it('returns an empty list when no definitions appear', () => {
    const facts = extractLeaseFacts(docFromParagraphs([p('No definitions here.')]));
    expect(facts.definitions).toEqual([]);
  });
});

describe('extractLeaseFacts — cross-references', () => {
  it('finds Section, Exhibit and Schedule references', () => {
    const facts = extractLeaseFacts(
      docFromParagraphs([
        p('As described in Section 4.2, the rent escalates per Exhibit A and Schedule 1.'),
      ]),
    );
    const texts = facts.crossReferences.map((r) => r.text);
    expect(texts).toContain('Section 4.2');
    expect(texts).toContain('Exhibit A');
    expect(texts).toContain('Schedule 1');
  });

  it('returns an empty list when no references appear', () => {
    const facts = extractLeaseFacts(docFromParagraphs([p('Nothing to see here.')]));
    expect(facts.crossReferences).toEqual([]);
  });

  it('carries page and paragraph index in each reference', () => {
    const facts = extractLeaseFacts(
      docFromParagraphs([p('See Section 1.', 1), p('See Section 2.3.', 2)]),
    );
    expect(facts.crossReferences[0]).toMatchObject({ page: 1, paragraphIndex: 0 });
    expect(facts.crossReferences[1]).toMatchObject({ page: 2, paragraphIndex: 1 });
  });
});

describe('extractLeaseFacts — integrated end-to-end', () => {
  it('pulls a populated LeaseFacts from a synthetic PDF', async () => {
    const bytes = await makePdf([
      pageFromLines([
        'RESIDENTIAL LEASE AGREEMENT',
        '"Premises" shall mean the real property located at 123 Main St.',
        '1. Rent',
        'Base rent is $2,500 per month.',
        'Security deposit is $2,000 due at signing.',
        '2. Term',
        'The term of this lease is 12 months.',
        'The term shall commence on January 1, 2026.',
        'This lease shall expire on December 31, 2026.',
        '3. Notice',
        'Either party may terminate upon 30 days written notice.',
        'See Section 2.1 and Exhibit A for details.',
      ]),
    ]);

    const doc = await parseLease(bytes);
    const facts = extractLeaseFacts(doc);

    expect(facts.baseRent?.amount).toBe(2500);
    expect(facts.securityDeposit?.amount).toBe(2000);
    expect(facts.termMonths).toBe(12);
    expect(facts.noticePeriodDays).toBe(30);
    expect(facts.commencementDate).toBe('2026-01-01');
    expect(facts.expirationDate).toBe('2026-12-31');
    expect(facts.definitions.map((d) => d.term)).toContain('Premises');
    const refTexts = facts.crossReferences.map((r) => r.text);
    expect(refTexts).toContain('Section 2.1');
    expect(refTexts).toContain('Exhibit A');
  });

  it('returns all-null primitives for a lease with no matchable phrasing', async () => {
    const bytes = await makePdf([
      pageFromLines(['GENERIC AGREEMENT', 'This document is short and unremarkable.']),
    ]);
    const doc = await parseLease(bytes);
    const facts = extractLeaseFacts(doc);
    expect(facts).toEqual({
      baseRent: null,
      securityDeposit: null,
      termMonths: null,
      noticePeriodDays: null,
      commencementDate: null,
      expirationDate: null,
      definitions: [],
      crossReferences: [],
    });
  });
});

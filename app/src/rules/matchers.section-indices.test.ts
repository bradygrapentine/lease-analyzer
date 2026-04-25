import { describe, it, expect } from 'vitest';
import { runMatcher } from './matchers';
import { detectSections } from '../parser/sections';
import type { LeaseDocument, Paragraph, Section } from '../parser/types';
import type { SectionAnchoredMatcher } from './types';
import { at } from '../test/assert';

function p(text: string, page = 1): Paragraph {
  return { text, page };
}

describe('Section.paragraphIndices contract', () => {
  it('detectSections populates paragraphIndices matching positions in the source paragraphs array', () => {
    const paragraphs: Paragraph[] = [
      p('Preamble text.'),
      p('1. Rent'),
      p('Tenant pays rent.'),
      p('More rent text.'),
      p('2. Utilities'),
      p('Utility text.'),
    ];

    const sections = detectSections(paragraphs);

    expect(at(sections, 0).heading).toBe('Preamble');
    expect(at(sections, 0).paragraphIndices).toEqual([0]);

    expect(at(sections, 1).heading).toBe('Rent');
    expect(at(sections, 1).paragraphIndices).toEqual([2, 3]);

    expect(at(sections, 2).heading).toBe('Utilities');
    expect(at(sections, 2).paragraphIndices).toEqual([5]);
  });

  it('runSectionAnchored uses paragraphIndices, not Paragraph object identity', () => {
    // Build a doc where the Section's paragraphs[] field holds DIFFERENT object
    // references than what's in doc.paragraphs at the indexed positions. The
    // old indexOf-based code would either fall back wrongly or not find them;
    // the index-based code must return correct indices into doc.paragraphs.
    const paragraphs: Paragraph[] = [
      p('Preamble.'),
      p('1. Rent'),
      p('Tenant shall pay rent of $1500.'),
      p('2. Utilities'),
      p('Tenant shall pay rent of $1500.'), // duplicate text; different identity
    ];

    const rentSection: Section = {
      heading: 'Rent',
      number: '1',
      paragraphs: [p('Tenant shall pay rent of $1500.')], // fresh object, not in doc.paragraphs
      paragraphIndices: [2],
      startPage: 1,
    };

    const doc: LeaseDocument = {
      pages: [],
      paragraphs,
      sections: [rentSection],
      raw: '',
    };

    const matcher: SectionAnchoredMatcher = {
      type: 'sectionAnchored',
      headingPattern: '^Rent$',
      child: { type: 'regex', pattern: 'rent of \\$1500', flags: 'i' },
    };

    const hits = runMatcher(matcher, doc);

    expect(hits).toHaveLength(1);
    expect(at(hits, 0).paragraphIndex).toBe(2);
  });

  it('falls back to deriving indices when paragraphIndices is absent (legacy persisted lease)', () => {
    // Simulates re-analyzing a LeaseDocument that was serialized to IndexedDB
    // before paragraphIndices existed. Section.paragraphIndices is undefined
    // but section.paragraphs still references the same Paragraph objects in
    // doc.paragraphs.
    const paragraphs: Paragraph[] = [
      p('1. Rent'),
      p('Tenant shall pay rent of $2000.'),
      p('Other clause.'),
    ];

    const legacySection: Section = {
      heading: 'Rent',
      number: '1',
      paragraphs: [at(paragraphs, 1)],
      // paragraphIndices intentionally omitted
      startPage: 1,
    };

    const doc: LeaseDocument = { pages: [], paragraphs, sections: [legacySection], raw: '' };

    const matcher: SectionAnchoredMatcher = {
      type: 'sectionAnchored',
      headingPattern: '^Rent$',
      child: { type: 'regex', pattern: 'rent of \\$2000', flags: 'i' },
    };

    const hits = runMatcher(matcher, doc);

    expect(hits).toHaveLength(1);
    expect(at(hits, 0).paragraphIndex).toBe(1);
  });

  it('survives JSON round-trip of a legacy lease (no paragraphIndices, broken object identity)', () => {
    // Simulates an encrypted-archive import: the LeaseDocument was serialized
    // to JSON before paragraphIndices existed, then parsed back. section.paragraphs
    // and doc.paragraphs no longer share object identity, so indexOf-based
    // fallback would silently drop every hit. Content-keyed fallback must work.
    const original: LeaseDocument = {
      pages: [],
      paragraphs: [
        p('1. Rent'),
        p('Tenant shall pay rent of $3000.'),
      ],
      sections: [
        {
          heading: 'Rent',
          number: '1',
          paragraphs: [p('Tenant shall pay rent of $3000.')],
          startPage: 1,
        } satisfies Section,
      ],
      raw: '',
    };

    const restored = JSON.parse(JSON.stringify(original)) as LeaseDocument;

    const matcher: SectionAnchoredMatcher = {
      type: 'sectionAnchored',
      headingPattern: '^Rent$',
      child: { type: 'regex', pattern: 'rent of \\$3000', flags: 'i' },
    };

    const hits = runMatcher(matcher, restored);

    expect(hits).toHaveLength(1);
    expect(at(hits, 0).paragraphIndex).toBe(1);
  });

  it('keeps section scoping correct when duplicate (page,text) paragraphs span sections (legacy JSON)', () => {
    // Two sections each contain a paragraph with identical text on the same page.
    // After JSON round-trip with no paragraphIndices, fallback must not collapse
    // them to the first occurrence — the rent rule must hit ONLY in the Rent
    // section (paragraph index 1), not in Utilities (index 3).
    const original: LeaseDocument = {
      pages: [],
      paragraphs: [
        p('1. Rent'),
        p('Tenant shall pay $500.'),
        p('2. Utilities'),
        p('Tenant shall pay $500.'),
      ],
      sections: [
        {
          heading: 'Rent',
          number: '1',
          paragraphs: [p('Tenant shall pay $500.')],
          startPage: 1,
        } satisfies Section,
        {
          heading: 'Utilities',
          number: '2',
          paragraphs: [p('Tenant shall pay $500.')],
          startPage: 1,
        } satisfies Section,
      ],
      raw: '',
    };

    const restored = JSON.parse(JSON.stringify(original)) as LeaseDocument;

    const matcher: SectionAnchoredMatcher = {
      type: 'sectionAnchored',
      headingPattern: '^Rent$',
      child: { type: 'regex', pattern: 'pay \\$500', flags: 'i' },
    };

    const hits = runMatcher(matcher, restored);

    expect(hits).toHaveLength(1);
    expect(at(hits, 0).paragraphIndex).toBe(1);
  });

  it('routes duplicate-text matches to the right section when the heading regex matches multiple sections (legacy JSON)', () => {
    // Heading pattern matches BOTH sections. Each section has the same body
    // paragraph text on the same page. Fallback must split the two occurrences
    // across the two sections, not collapse both onto paragraph index 1.
    const original: LeaseDocument = {
      pages: [],
      paragraphs: [
        p('Section A'),
        p('Tenant shall pay $700.'),
        p('Section B'),
        p('Tenant shall pay $700.'),
      ],
      sections: [
        { heading: 'Section A', number: null, paragraphs: [p('Tenant shall pay $700.')], startPage: 1 } satisfies Section,
        { heading: 'Section B', number: null, paragraphs: [p('Tenant shall pay $700.')], startPage: 1 } satisfies Section,
      ],
      raw: '',
    };

    const restored = JSON.parse(JSON.stringify(original)) as LeaseDocument;

    const matcher: SectionAnchoredMatcher = {
      type: 'sectionAnchored',
      headingPattern: '^Section ',
      child: { type: 'regex', pattern: 'pay \\$700', flags: 'i' },
    };

    const hits = runMatcher(matcher, restored);
    const indices = hits.map((h) => h.paragraphIndex).sort((a, b) => a - b);
    expect(indices).toEqual([1, 3]);
  });

  it('discards stored paragraphIndices when content does not match (stale/corrupt persisted data)', () => {
    // Stored indices point at the wrong paragraphs (length matches but content
    // doesn't). Validator must reject and fall back to content lookup.
    const paragraphs: Paragraph[] = [
      p('1. Rent'),
      p('Tenant shall pay rent of $4000.'),
      p('Other clause text.'),
    ];

    const corruptSection: Section = {
      heading: 'Rent',
      number: '1',
      paragraphs: [at(paragraphs, 1)],
      paragraphIndices: [2], // wrong: points at "Other clause text."
      startPage: 1,
    };

    const doc: LeaseDocument = { pages: [], paragraphs, sections: [corruptSection], raw: '' };

    const matcher: SectionAnchoredMatcher = {
      type: 'sectionAnchored',
      headingPattern: '^Rent$',
      child: { type: 'regex', pattern: 'rent of \\$4000', flags: 'i' },
    };

    const hits = runMatcher(matcher, doc);
    expect(hits).toHaveLength(1);
    expect(at(hits, 0).paragraphIndex).toBe(1); // recovered, not the corrupt 2
  });

  it('does not call doc.paragraphs.indexOf in runSectionAnchored', () => {
    const paragraphs: Paragraph[] = [
      p('1. Rent'),
      p('Tenant shall pay rent.'),
    ];

    let indexOfCallCount = 0;
    const originalIndexOf = paragraphs.indexOf.bind(paragraphs);
    paragraphs.indexOf = function (...args: Parameters<Array<Paragraph>['indexOf']>): number {
      indexOfCallCount += 1;
      return originalIndexOf(...args);
    };

    const section: Section = {
      heading: 'Rent',
      number: '1',
      paragraphs: [at(paragraphs, 1)],
      paragraphIndices: [1],
      startPage: 1,
    };

    const doc: LeaseDocument = { pages: [], paragraphs, sections: [section], raw: '' };

    const matcher: SectionAnchoredMatcher = {
      type: 'sectionAnchored',
      headingPattern: '^Rent$',
      child: { type: 'regex', pattern: 'rent', flags: 'i' },
    };

    runMatcher(matcher, doc);

    expect(indexOfCallCount).toBe(0);
  });
});

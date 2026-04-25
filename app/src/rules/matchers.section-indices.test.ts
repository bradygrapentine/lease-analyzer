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

import { describe, it, expect } from 'vitest';
import { runMatcher } from './matchers';
import { detectSections } from '../parser/sections';
import type { LeaseDocument, Paragraph } from '../parser/types';
import { at } from '../test/assert';

function docFromParagraphs(paragraphs: Paragraph[]): LeaseDocument {
  return {
    pages: [],
    paragraphs,
    sections: detectSections(paragraphs),
    raw: paragraphs.map((p) => p.text).join('\n\n'),
  };
}

describe('sectionAnchored matcher', () => {
  it('only hits inside a section whose heading matches the pattern', () => {
    const doc = docFromParagraphs([
      { text: '1. Rent', page: 1 },
      { text: 'The tenant shall pay fees on the first.', page: 1 },
      { text: '2. Arbitration', page: 1 },
      { text: 'All disputes go to binding arbitration.', page: 1 },
    ]);

    const hits = runMatcher(
      {
        type: 'sectionAnchored',
        headingPattern: 'arbitration',
        child: { type: 'regex', pattern: 'binding arbitration', flags: 'i' },
      },
      doc,
    );

    expect(hits).toHaveLength(1);
    expect(at(hits, 0).snippet.toLowerCase()).toContain('binding arbitration');
  });

  it('does not hit matching text that lives in the wrong section', () => {
    const doc = docFromParagraphs([
      { text: '1. Rent', page: 1 },
      { text: 'No binding arbitration applies to rent disputes.', page: 1 },
      { text: '2. Arbitration', page: 1 },
      { text: 'Tenant waives court access.', page: 1 },
    ]);

    const hits = runMatcher(
      {
        type: 'sectionAnchored',
        headingPattern: 'arbitration',
        child: { type: 'regex', pattern: 'binding arbitration', flags: 'i' },
      },
      doc,
    );

    expect(hits).toEqual([]);
  });
});

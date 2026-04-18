import { describe, it, expect } from 'vitest';
import { detectSections } from './sections';
import type { Paragraph, Section } from './types';

function p(text: string, page = 1): Paragraph {
  return { text, page };
}

function sectionAt(sections: Section[], index: number): Section {
  const s = sections[index];
  if (!s) throw new Error(`no section at index ${index}`);
  return s;
}

describe('detectSections', () => {
  it('groups paragraphs under numbered headings', () => {
    const paras: Paragraph[] = [
      p('1. Rent'),
      p('Tenant shall pay rent of $2000 on the first of each month.'),
      p('2. Term'),
      p('The term is twelve months commencing May 1.'),
    ];

    const sections = detectSections(paras);

    expect(sections).toHaveLength(2);
    expect(sectionAt(sections, 0).number).toBe('1');
    expect(sectionAt(sections, 0).heading).toBe('Rent');
    expect(sectionAt(sections, 0).paragraphs.map((x) => x.text)).toEqual([
      'Tenant shall pay rent of $2000 on the first of each month.',
    ]);
    expect(sectionAt(sections, 1).number).toBe('2');
    expect(sectionAt(sections, 1).heading).toBe('Term');
  });

  it('treats ALL CAPS short lines as headings', () => {
    const paras: Paragraph[] = [
      p('LATE FEES'),
      p('A fee of $50 shall apply after five days.'),
    ];

    const sections = detectSections(paras);

    expect(sections).toHaveLength(1);
    expect(sectionAt(sections, 0).heading).toBe('LATE FEES');
    expect(sectionAt(sections, 0).number).toBeNull();
  });

  it('creates a preamble section for content before the first heading', () => {
    const paras: Paragraph[] = [
      p('This Lease Agreement is made between Landlord and Tenant.'),
      p('1. Rent'),
      p('Rent is $1000.'),
    ];

    const sections = detectSections(paras);

    expect(sections).toHaveLength(2);
    expect(sectionAt(sections, 0).number).toBeNull();
    expect(sectionAt(sections, 0).heading).toBe('Preamble');
    expect(sectionAt(sections, 0).paragraphs).toHaveLength(1);
  });

  it('records the starting page of a section', () => {
    const paras: Paragraph[] = [p('1. Rent', 2), p('Body on page 2.', 2)];

    const sections = detectSections(paras);

    expect(sectionAt(sections, 0).startPage).toBe(2);
  });
});

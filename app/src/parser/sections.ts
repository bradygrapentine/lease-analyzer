import type { Paragraph, Section } from './types';

const NUMBERED_HEADING = /^\s*(\d+(?:\.\d+)*)\.?\s+([A-Z][^.]{0,80})\s*$/;
const ALL_CAPS_HEADING = /^[A-Z0-9][A-Z0-9 &/'-]{2,60}$/;

interface HeadingMatch {
  number: string | null;
  heading: string;
}

function matchHeading(text: string): HeadingMatch | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const numbered = trimmed.match(NUMBERED_HEADING);
  if (numbered) {
    return { number: numbered[1]!, heading: numbered[2]!.trim() };
  }

  if (trimmed.length <= 60 && ALL_CAPS_HEADING.test(trimmed) && !trimmed.endsWith('.')) {
    return { number: null, heading: trimmed };
  }

  return null;
}

export function detectSections(paragraphs: Paragraph[]): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;

  paragraphs.forEach((para, idx) => {
    const heading = matchHeading(para.text);
    if (heading) {
      if (current) sections.push(current);
      current = {
        heading: heading.heading,
        number: heading.number,
        paragraphs: [],
        paragraphIndices: [],
        startPage: para.page,
      };
      return;
    }

    if (!current) {
      current = {
        heading: 'Preamble',
        number: null,
        paragraphs: [],
        paragraphIndices: [],
        startPage: para.page,
      };
    }
    current.paragraphs.push(para);
    current.paragraphIndices.push(idx);
  });

  if (current) sections.push(current);
  return sections;
}

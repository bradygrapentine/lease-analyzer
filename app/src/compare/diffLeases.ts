import type { LeaseDocument, Paragraph, Section } from '../parser/types';

export type ParagraphStatus = 'unchanged' | 'added' | 'removed';

export interface ParagraphDiff {
  status: ParagraphStatus;
  text: string;
  page: number;
}

export type SectionStatus = 'matched' | 'added' | 'removed';

export interface SectionDiff {
  heading: string;
  status: SectionStatus;
  paragraphs: ParagraphDiff[];
}

export interface LeaseDiff {
  sections: SectionDiff[];
}

export function diffLeases(a: LeaseDocument, b: LeaseDocument): LeaseDiff {
  const aByKey = indexSections(a.sections);
  const bByKey = indexSections(b.sections);
  const allKeys = orderedUnion(a.sections, b.sections);
  const out: SectionDiff[] = [];

  for (const key of allKeys) {
    const aSec = aByKey.get(key);
    const bSec = bByKey.get(key);
    if (aSec && bSec) {
      out.push({
        heading: bSec.heading,
        status: 'matched',
        paragraphs: diffParagraphs(aSec.paragraphs, bSec.paragraphs),
      });
    } else if (aSec) {
      out.push({
        heading: aSec.heading,
        status: 'removed',
        paragraphs: aSec.paragraphs.map((p) => paraDiff(p, 'removed')),
      });
    } else if (bSec) {
      out.push({
        heading: bSec.heading,
        status: 'added',
        paragraphs: bSec.paragraphs.map((p) => paraDiff(p, 'added')),
      });
    }
  }

  return { sections: out };
}

function indexSections(sections: Section[]): Map<string, Section> {
  const map = new Map<string, Section>();
  for (const s of sections) {
    const key = normalizeHeading(s.heading);
    if (!map.has(key)) map.set(key, s);
  }
  return map;
}

function orderedUnion(aSecs: Section[], bSecs: Section[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const s of [...aSecs, ...bSecs]) {
    const key = normalizeHeading(s.heading);
    if (!seen.has(key)) {
      seen.add(key);
      order.push(key);
    }
  }
  return order;
}

function normalizeHeading(heading: string): string {
  return heading.trim().toLowerCase();
}

function diffParagraphs(aParas: Paragraph[], bParas: Paragraph[]): ParagraphDiff[] {
  const aSet = new Set(aParas.map((p) => p.text.trim()));
  const bSet = new Set(bParas.map((p) => p.text.trim()));
  const out: ParagraphDiff[] = [];
  for (const p of aParas) {
    if (!bSet.has(p.text.trim())) out.push(paraDiff(p, 'removed'));
  }
  for (const p of bParas) {
    out.push(paraDiff(p, aSet.has(p.text.trim()) ? 'unchanged' : 'added'));
  }
  return out;
}

function paraDiff(p: Paragraph, status: ParagraphStatus): ParagraphDiff {
  return { status, text: p.text, page: p.page };
}

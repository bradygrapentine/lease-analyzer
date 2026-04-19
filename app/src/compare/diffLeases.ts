import type { LeaseDocument, Paragraph, Section } from '../parser/types';
import { similarity } from './similarity';

export type ParagraphStatus = 'unchanged' | 'added' | 'removed' | 'changed';

const FUZZY_MATCH_THRESHOLD = 0.6;

export interface ParagraphDiff {
  status: ParagraphStatus;
  text: string;
  page: number;
  previousText?: string;
}

export type SectionStatus = 'matched' | 'added' | 'removed';

export interface SectionDiff {
  heading: string;
  status: SectionStatus;
  paragraphs: ParagraphDiff[];
}

export interface LeaseDiff {
  sections: SectionDiff[];
  /**
   * Present when the two leases were analyzed under different rule pack
   * versions. Pure data — UI renders it separately. Absent when both
   * versions match or either side wasn't stamped.
   */
  packVersionMismatch?: { a: string; b: string };
}

/**
 * Optional analysis metadata for either side of the diff. Existing
 * callers that only pass in a LeaseDocument keep working.
 */
export interface DiffOptions {
  rulePackVersionA?: string;
  rulePackVersionB?: string;
}

export function diffLeases(
  a: LeaseDocument,
  b: LeaseDocument,
  options: DiffOptions = {},
): LeaseDiff {
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
        paragraphs: aSec.paragraphs.map((p) => ({
          status: 'removed' as const,
          text: p.text,
          page: p.page,
        })),
      });
    } else if (bSec) {
      out.push({
        heading: bSec.heading,
        status: 'added',
        paragraphs: bSec.paragraphs.map((p) => ({
          status: 'added' as const,
          text: p.text,
          page: p.page,
        })),
      });
    }
  }

  const diff: LeaseDiff = { sections: out };
  const { rulePackVersionA, rulePackVersionB } = options;
  if (
    rulePackVersionA !== undefined &&
    rulePackVersionB !== undefined &&
    rulePackVersionA !== rulePackVersionB
  ) {
    diff.packVersionMismatch = { a: rulePackVersionA, b: rulePackVersionB };
  }
  return diff;
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
  const usedA = new Set<number>();
  const out: ParagraphDiff[] = [];

  // For each B paragraph, find the best unused A paragraph.
  for (const b of bParas) {
    const match = bestMatch(b, aParas, usedA);
    if (!match) {
      out.push({ status: 'added', text: b.text, page: b.page });
      continue;
    }
    usedA.add(match.index);
    if (match.score === 1) {
      out.push({ status: 'unchanged', text: b.text, page: b.page });
    } else {
      out.push({
        status: 'changed',
        text: b.text,
        page: b.page,
        previousText: match.paragraph.text,
      });
    }
  }

  // Any A paragraph not claimed by a B is "removed".
  aParas.forEach((a, i) => {
    if (!usedA.has(i)) out.push({ status: 'removed', text: a.text, page: a.page });
  });

  return out;
}

function bestMatch(
  target: Paragraph,
  candidates: Paragraph[],
  used: Set<number>,
): { index: number; paragraph: Paragraph; score: number } | null {
  let best: { index: number; paragraph: Paragraph; score: number } | null = null;
  candidates.forEach((candidate, index) => {
    if (used.has(index)) return;
    const score = similarity(target.text, candidate.text);
    if (score < FUZZY_MATCH_THRESHOLD) return;
    if (!best || score > best.score) {
      best = { index, paragraph: candidate, score };
    }
  });
  return best;
}

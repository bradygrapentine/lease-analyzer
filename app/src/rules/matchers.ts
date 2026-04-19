import type { LeaseDocument, Paragraph } from '../parser/types';
import type { CompiledMatcherCache } from './compileRules';
import type {
  KeywordProximityMatcher,
  LeafMatcher,
  Matcher,
  RegexMatcher,
  RuleMatch,
  SectionAnchoredMatcher,
} from './types';

export function runRegex(
  matcher: RegexMatcher,
  paragraphs: Paragraph[],
  compiled?: CompiledMatcherCache,
): RuleMatch[] {
  const re = compiled?.regex ?? buildRegex(matcher);
  const hits: RuleMatch[] = [];
  paragraphs.forEach((para, idx) => {
    re.lastIndex = 0;
    const match = re.exec(para.text);
    if (!match) return;
    const start = match.index;
    const end = start + match[0].length;
    hits.push({
      paragraphIndex: idx,
      span: { start, end },
      snippet: match[0],
      confidence: 0.9,
    });
  });
  return hits;
}

function buildRegex(matcher: RegexMatcher): RegExp {
  const flags = matcher.flags ?? '';
  return new RegExp(matcher.pattern, flags.includes('g') ? flags : `${flags}g`);
}

export function runKeywordProximity(
  matcher: KeywordProximityMatcher,
  paragraphs: Paragraph[],
  compiled?: CompiledMatcherCache,
): RuleMatch[] {
  const keywordsLower =
    compiled?.keywordsLower ?? matcher.keywords.map((k) => k.toLowerCase());
  const hits: RuleMatch[] = [];
  paragraphs.forEach((para, idx) => {
    const match = findProximity(para.text, keywordsLower, matcher.window);
    if (match) hits.push({ paragraphIndex: idx, ...match });
  });
  return hits;
}

function findProximity(
  text: string,
  keywordsLower: string[],
  window: number,
): { span: { start: number; end: number }; snippet: string; confidence: number } | null {
  const lower = text.toLowerCase();
  const positions = keywordsLower.map((k) => findAll(lower, k));
  if (positions.some((p) => p.length === 0)) return null;

  let best: { start: number; end: number } | null = null;
  // Try every combination starting from the first keyword's positions.
  const walk = (depth: number, current: { start: number; end: number }): void => {
    if (best && best.end - best.start <= current.end - current.start) return;
    if (depth === positions.length) {
      if (current.end - current.start <= window) {
        best = { ...current };
      }
      return;
    }
    const slots = positions[depth];
    if (!slots) return;
    for (const pos of slots) {
      const start = Math.min(current.start, pos);
      const end = Math.max(current.end, pos + (keywordsLower[depth]?.length ?? 0));
      if (end - start > window) continue;
      walk(depth + 1, { start, end });
    }
  };

  const firstSlots = positions[0];
  const firstKeyword = keywordsLower[0];
  if (!firstSlots || firstKeyword === undefined) return null;
  for (const pos of firstSlots) {
    walk(1, { start: pos, end: pos + firstKeyword.length });
  }

  if (!best) return null;
  const span = best as { start: number; end: number };
  return {
    span,
    snippet: text.slice(span.start, span.end),
    confidence: 0.75,
  };
}

export function runMatcher(
  matcher: Matcher,
  doc: LeaseDocument,
  compiled?: CompiledMatcherCache,
): RuleMatch[] {
  if (matcher.type === 'sectionAnchored') {
    return runSectionAnchored(matcher, doc, compiled);
  }
  return runLeaf(matcher, doc.paragraphs, compiled);
}

function runLeaf(
  matcher: LeafMatcher,
  paragraphs: Paragraph[],
  compiled?: CompiledMatcherCache,
): RuleMatch[] {
  if (matcher.type === 'regex') return runRegex(matcher, paragraphs, compiled);
  return runKeywordProximity(matcher, paragraphs, compiled);
}

function runSectionAnchored(
  matcher: SectionAnchoredMatcher,
  doc: LeaseDocument,
  compiled?: CompiledMatcherCache,
): RuleMatch[] {
  const heading = compiled?.headingRegex ?? new RegExp(matcher.headingPattern, 'i');
  // Collect the master-paragraph indexes for every section whose heading
  // matches. Sections now track these directly (see parser/types.ts), so
  // we no longer need `doc.paragraphs.indexOf(para)` — each leaf hit's
  // filtered index maps straight into an originalIndex via array lookup.
  const originalIndexes: number[] = [];
  const filtered: Paragraph[] = [];
  for (const section of doc.sections) {
    if (!heading.test(section.heading)) continue;
    for (let i = 0; i < section.paragraphs.length; i++) {
      const para = section.paragraphs[i];
      const idx = section.paragraphIndexes[i];
      if (!para || idx === undefined) continue;
      filtered.push(para);
      originalIndexes.push(idx);
    }
  }
  if (filtered.length === 0) return [];
  const leafHits = runLeaf(matcher.child, filtered, compiled?.child);
  return leafHits.map((hit) => {
    const originalIndex = originalIndexes[hit.paragraphIndex] ?? hit.paragraphIndex;
    return { ...hit, paragraphIndex: originalIndex };
  });
}

function findAll(haystack: string, needle: string): number[] {
  if (!needle) return [];
  const positions: number[] = [];
  let from = 0;
  while (from <= haystack.length) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    positions.push(idx);
    from = idx + needle.length;
  }
  return positions;
}

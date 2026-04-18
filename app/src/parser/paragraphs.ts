import type { PageText, Paragraph, TextItem } from './types';

interface Line {
  page: number;
  y: number;
  fontSize: number;
  leftX: number;
  text: string;
}

const Y_TOLERANCE = 2;
const PARAGRAPH_GAP_RATIO = 1.6;
const HEADER_FOOTER_MIN_REPEATS = 3;

export function reconstructParagraphs(pages: PageText[]): Paragraph[] {
  const allLines = pages.flatMap(pageToLines);
  const cleanLines = stripHeadersAndFooters(allLines, pages.length);
  return mergeLinesIntoParagraphs(cleanLines);
}

function pageToLines(page: PageText): Line[] {
  const sorted = [...page.items].sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const groups: TextItem[][] = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    if (last && Math.abs((last[0]?.y ?? 0) - item.y) <= Y_TOLERANCE) {
      last.push(item);
    } else {
      groups.push([item]);
    }
  }
  return groups.map((items) => {
    items.sort((a, b) => a.x - b.x);
    const text = items
      .map((i) => i.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const first = items[0]!;
    const avgFont = items.reduce((sum, i) => sum + i.fontSize, 0) / items.length;
    return {
      page: page.pageNumber,
      y: first.y,
      fontSize: avgFont,
      leftX: first.x,
      text,
    };
  });
}

function stripHeadersAndFooters(lines: Line[], pageCount: number): Line[] {
  if (pageCount < HEADER_FOOTER_MIN_REPEATS) return lines;
  const counts = new Map<string, number>();
  for (const line of lines) {
    const key = fingerprint(line);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return lines.filter((line) => (counts.get(fingerprint(line)) ?? 0) < HEADER_FOOTER_MIN_REPEATS);
}

function fingerprint(line: Line): string {
  return `${Math.round(line.y / 10)}|${line.text}`;
}

function mergeLinesIntoParagraphs(lines: Line[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  let current: { page: number; text: string; lastFont: number; lastY: number } | null = null;

  for (const line of lines) {
    if (!line.text) continue;
    const shouldContinue =
      current !== null &&
      current.page === line.page &&
      current.lastY - line.y <= line.fontSize * PARAGRAPH_GAP_RATIO;

    if (shouldContinue && current) {
      current.text = joinWithHyphenRepair(current.text, line.text);
      current.lastFont = line.fontSize;
      current.lastY = line.y;
    } else {
      if (current) paragraphs.push({ page: current.page, text: current.text });
      current = { page: line.page, text: line.text, lastFont: line.fontSize, lastY: line.y };
    }
  }
  if (current) paragraphs.push({ page: current.page, text: current.text });
  return paragraphs;
}

function joinWithHyphenRepair(left: string, right: string): string {
  const hyphenEnd = /([A-Za-z])-$/;
  if (hyphenEnd.test(left)) {
    return left.replace(hyphenEnd, '$1') + right.replace(/^\s*/, '');
  }
  return `${left} ${right}`;
}

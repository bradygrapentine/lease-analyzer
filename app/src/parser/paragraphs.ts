import type { BoundingBox, LineSpan, PageText, Paragraph, TextItem } from './types';

interface Line {
  page: number;
  y: number;
  fontSize: number;
  leftX: number;
  text: string;
  bbox: BoundingBox;
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
      bbox: lineBbox(items, page.pageNumber),
    };
  });
}

function lineBbox(items: TextItem[], page: number): BoundingBox {
  let xLeft = Infinity;
  let xRight = -Infinity;
  let yBottom = Infinity;
  let yTop = -Infinity;
  for (const item of items) {
    xLeft = Math.min(xLeft, item.x);
    xRight = Math.max(xRight, item.x + item.width);
    yBottom = Math.min(yBottom, item.y);
    yTop = Math.max(yTop, item.y + (item.height || item.fontSize));
  }
  return { page, xLeft, xRight, yTop, yBottom };
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

interface Building {
  page: number;
  text: string;
  lastFont: number;
  lastY: number;
  bbox: BoundingBox;
  lines: LineSpan[];
}

function mergeLinesIntoParagraphs(lines: Line[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  let current: Building | null = null;

  for (const line of lines) {
    if (!line.text) continue;
    const shouldContinue =
      current !== null &&
      current.page === line.page &&
      current.lastY - line.y <= line.fontSize * PARAGRAPH_GAP_RATIO;

    if (shouldContinue && current) {
      const joined = joinWithHyphenRepair(current.text, line.text);
      const hyphenRepaired = joined.length < current.text.length + line.text.length;
      if (hyphenRepaired) {
        // Hyphen-repair dropped the trailing '-' from prior text. Shrink the
        // last line span's end by 1 so it reflects the post-repair paragraph text.
        const lastIdx = current.lines.length - 1;
        const last = current.lines[lastIdx]!;
        current.lines[lastIdx] = { start: last.start, end: last.end - 1, bbox: last.bbox };
      }
      const start = hyphenRepaired ? current.text.length - 1 : current.text.length + 1;
      const end = joined.length;
      current.text = joined;
      current.lastFont = line.fontSize;
      current.lastY = line.y;
      current.bbox = extendBbox(current.bbox, line.bbox);
      current.lines.push({ start, end, bbox: line.bbox });
    } else {
      if (current) {
        paragraphs.push({
          page: current.page,
          text: current.text,
          bbox: current.bbox,
          lines: current.lines,
        });
      }
      current = {
        page: line.page,
        text: line.text,
        lastFont: line.fontSize,
        lastY: line.y,
        bbox: line.bbox,
        lines: [{ start: 0, end: line.text.length, bbox: line.bbox }],
      };
    }
  }
  if (current) {
    paragraphs.push({
      page: current.page,
      text: current.text,
      bbox: current.bbox,
      lines: current.lines,
    });
  }
  return paragraphs;
}


function extendBbox(a: BoundingBox, b: BoundingBox): BoundingBox {
  return {
    page: a.page,
    xLeft: Math.min(a.xLeft, b.xLeft),
    xRight: Math.max(a.xRight, b.xRight),
    yTop: Math.max(a.yTop, b.yTop),
    yBottom: Math.min(a.yBottom, b.yBottom),
  };
}

function joinWithHyphenRepair(left: string, right: string): string {
  const hyphenEnd = /([A-Za-z])-$/;
  if (hyphenEnd.test(left)) {
    return left.replace(hyphenEnd, '$1') + right.replace(/^\s*/, '');
  }
  return `${left} ${right}`;
}

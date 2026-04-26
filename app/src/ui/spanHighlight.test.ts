import { describe, it, expect } from 'vitest';
import { computeSpanRects } from './spanHighlight';
import type { BoundingBox, LineSpan, Paragraph } from '../parser/types';
import type { Finding } from '../rules/types';

function bbox(yTop: number, yBottom: number): BoundingBox {
  return { page: 1, xLeft: 72, xRight: 540, yTop, yBottom };
}

function makeFinding(start: number, end: number): Finding {
  return {
    ruleId: 'rule-test',
    severity: 'high',
    category: 'fees',
    title: 't',
    explanation: 'e',
    citation: null,
    page: 1,
    paragraphIndex: 0,
    snippet: 's',
    span: { start, end },
    confidence: 1,
    negated: false,
    rulePackVersion: '1.0.0',
  };
}

describe('computeSpanRects', () => {
  it('falls back to the paragraph bbox when the paragraph has no lines', () => {
    const paragraph: Paragraph = {
      text: 'whole paragraph text',
      page: 1,
      bbox: bbox(720, 700),
    };
    const finding = makeFinding(0, 5);
    const rects = computeSpanRects(paragraph, finding);
    expect(rects).toHaveLength(1);
    expect(rects[0]).toEqual(bbox(720, 700));
  });

  it('returns one rect for a span fully inside one line', () => {
    const lines: LineSpan[] = [
      { start: 0, end: 20, bbox: bbox(720, 710) },
      { start: 20, end: 40, bbox: bbox(710, 700) },
      { start: 40, end: 60, bbox: bbox(700, 690) },
    ];
    const paragraph: Paragraph = {
      text: 'a'.repeat(60),
      page: 1,
      bbox: bbox(720, 690),
      lines,
    };
    // span [25,30) sits squarely inside line[1] (20..40)
    const rects = computeSpanRects(paragraph, makeFinding(25, 30));
    expect(rects).toHaveLength(1);
    expect(rects[0]).toEqual(bbox(710, 700));
  });

  it('returns one rect per overlapping line for a multi-line span', () => {
    const lines: LineSpan[] = [
      { start: 0, end: 20, bbox: bbox(720, 710) },
      { start: 20, end: 40, bbox: bbox(710, 700) },
      { start: 40, end: 60, bbox: bbox(700, 690) },
    ];
    const paragraph: Paragraph = {
      text: 'a'.repeat(60),
      page: 1,
      bbox: bbox(720, 690),
      lines,
    };
    // span [10,55) crosses all three lines
    const rects = computeSpanRects(paragraph, makeFinding(10, 55));
    expect(rects).toHaveLength(3);
    expect(rects).toEqual([bbox(720, 710), bbox(710, 700), bbox(700, 690)]);
  });

  it('applies the supplied viewportTransform to each rect', () => {
    const lines: LineSpan[] = [
      { start: 0, end: 10, bbox: bbox(720, 710) },
      { start: 10, end: 20, bbox: bbox(710, 700) },
    ];
    const paragraph: Paragraph = {
      text: 'a'.repeat(20),
      page: 1,
      bbox: bbox(720, 700),
      lines,
    };
    const rects = computeSpanRects(paragraph, makeFinding(0, 20), (b) => ({
      x: b.xLeft,
      y: b.yTop,
    }));
    expect(rects).toEqual([
      { x: 72, y: 720 },
      { x: 72, y: 710 },
    ]);
  });

  it('returns an empty array when the paragraph has neither bbox nor lines', () => {
    const paragraph: Paragraph = { text: 'x', page: 1 };
    expect(computeSpanRects(paragraph, makeFinding(0, 1))).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import { findLinesForSpan } from './lineSpans';
import type { BoundingBox, LineSpan } from './types';

function bbox(yTop: number, yBottom: number): BoundingBox {
  return { page: 1, xLeft: 72, xRight: 540, yTop, yBottom };
}

const lines: LineSpan[] = [
  { start: 0, end: 10, bbox: bbox(700, 690) }, // "First line"
  { start: 11, end: 22, bbox: bbox(685, 675) }, // "Second line"
  { start: 23, end: 33, bbox: bbox(670, 660) }, // "Third line"
];

describe('findLinesForSpan', () => {
  it('returns the single line containing a span fully within one line', () => {
    const result = findLinesForSpan(lines, 2, 7);
    expect(result).toHaveLength(1);
    expect(result[0]!.start).toBe(0);
    expect(result[0]!.end).toBe(10);
  });

  it('returns both lines for a span crossing two lines, in document order', () => {
    const result = findLinesForSpan(lines, 5, 15);
    expect(result).toHaveLength(2);
    expect(result[0]!.start).toBe(0);
    expect(result[1]!.start).toBe(11);
  });

  it('returns three lines for a span spanning all three lines', () => {
    const result = findLinesForSpan(lines, 5, 30);
    expect(result).toHaveLength(3);
    expect(result.map((l) => l.start)).toEqual([0, 11, 23]);
  });

  it('returns [] for a span fully outside any line (after end)', () => {
    const result = findLinesForSpan(lines, 100, 110);
    expect(result).toEqual([]);
  });

  it('returns [] for an empty lines array', () => {
    const result = findLinesForSpan([], 0, 10);
    expect(result).toEqual([]);
  });

  it('treats line.end as exclusive (span starting exactly at line.end skips that line)', () => {
    const result = findLinesForSpan(lines, 10, 11);
    // span [10,11) — line0 is [0,10) (exclusive end), line1 is [11,22) — neither overlaps [10,11)
    expect(result).toEqual([]);
  });

  it('includes a line where span starts exactly at line.start', () => {
    const result = findLinesForSpan(lines, 11, 12);
    expect(result).toHaveLength(1);
    expect(result[0]!.start).toBe(11);
  });

  it('returns [] for a zero-width span', () => {
    const result = findLinesForSpan(lines, 5, 5);
    expect(result).toEqual([]);
  });
});

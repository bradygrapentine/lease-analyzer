import { describe, it, expect } from 'vitest';
import { detectTables } from './tables';
import type { PageText, TextItem } from './types';
import { at } from '../test/assert';

function item(text: string, x: number, y: number, width = text.length * 6): TextItem {
  return { text, x, y, width, height: 10, fontSize: 10 };
}

function page(pageNumber: number, items: TextItem[]): PageText {
  return { pageNumber, width: 612, height: 792, items };
}

describe('detectTables — grid detection', () => {
  it('detects a simple 3x3 grid aligned in x and y', () => {
    // Three rows, each with three cells at x=72, x=220, x=360.
    const items: TextItem[] = [
      // Row 1 (y=700)
      item('Period', 72, 700),
      item('Amount', 220, 700),
      item('Escalator', 360, 700),
      // Row 2 (y=680)
      item('2026', 72, 680),
      item('$1,000', 220, 680),
      item('3%', 360, 680),
      // Row 3 (y=660)
      item('2027', 72, 660),
      item('$1,030', 220, 660),
      item('3%', 360, 660),
    ];
    const tables = detectTables([page(1, items)]);
    expect(tables).toHaveLength(1);
    const t = at(tables, 0);
    expect(t.page).toBe(1);
    expect(t.rows).toHaveLength(3);
    expect(at(t.rows, 0).map((c) => c.text)).toEqual(['Period', 'Amount', 'Escalator']);
    expect(at(t.rows, 1).map((c) => c.text)).toEqual(['2026', '$1,000', '3%']);
  });

  it('returns no tables when the page is prose (single-column, no column alignment)', () => {
    // Each line has a different number of items and varying x.
    const items: TextItem[] = [
      item('The quick brown fox', 72, 700),
      item('jumps over lazy dogs', 72, 680),
      item('across the warm field in the summer', 72, 660),
    ];
    const tables = detectTables([page(1, items)]);
    expect(tables).toEqual([]);
  });

  it('ignores candidate grids smaller than the minimum row/column threshold', () => {
    // 2 rows x 2 cols — below the 3x2 threshold.
    const items: TextItem[] = [
      item('A', 72, 700),
      item('B', 220, 700),
      item('C', 72, 680),
      item('D', 220, 680),
    ];
    const tables = detectTables([page(1, items)]);
    expect(tables).toEqual([]);
  });

  it('emits the bbox spanning the table cells', () => {
    const items: TextItem[] = [
      item('H1', 100, 700),
      item('H2', 250, 700),
      item('H3', 400, 700),
      item('r1', 100, 680),
      item('r2', 250, 680),
      item('r3', 400, 680),
      item('s1', 100, 660),
      item('s2', 250, 660),
      item('s3', 400, 660),
    ];
    const tables = detectTables([page(1, items)]);
    const t = at(tables, 0);
    expect(t.bbox.page).toBe(1);
    expect(t.bbox.xLeft).toBeCloseTo(100);
    expect(t.bbox.xRight).toBeGreaterThan(400);
    // yTop is the top of the top row, yBottom is the bottom of the last row.
    expect(t.bbox.yTop).toBeGreaterThanOrEqual(700);
    expect(t.bbox.yBottom).toBeLessThanOrEqual(660);
  });

  it('groups multi-item cells that share y and fall into the same column band', () => {
    const items: TextItem[] = [
      item('Period', 72, 700),
      item('Base', 220, 700),
      item('Rent', 260, 700), // part of the same "Base Rent" header cell
      item('Escalator', 360, 700),
      item('2026', 72, 680),
      item('$1,000', 220, 680),
      item('3%', 360, 680),
      item('2027', 72, 660),
      item('$1,030', 220, 660),
      item('3%', 360, 660),
    ];
    const tables = detectTables([page(1, items)]);
    const t = at(tables, 0);
    // Header row should have 3 cells; "Base Rent" merged.
    expect(at(t.rows, 0)).toHaveLength(3);
    expect(at(at(t.rows, 0), 1).text).toMatch(/Base\s+Rent/);
  });

  it('detects tables on multiple pages independently', () => {
    const p1: TextItem[] = [
      item('A', 72, 700),
      item('B', 220, 700),
      item('C', 360, 700),
      item('a', 72, 680),
      item('b', 220, 680),
      item('c', 360, 680),
      item('a2', 72, 660),
      item('b2', 220, 660),
      item('c2', 360, 660),
    ];
    const p2: TextItem[] = [
      item('X', 80, 500),
      item('Y', 240, 500),
      item('Z', 400, 500),
      item('x', 80, 480),
      item('y', 240, 480),
      item('z', 400, 480),
      item('x2', 80, 460),
      item('y2', 240, 460),
      item('z2', 400, 460),
    ];
    const tables = detectTables([page(1, p1), page(2, p2)]);
    expect(tables).toHaveLength(2);
    expect(at(tables, 0).page).toBe(1);
    expect(at(tables, 1).page).toBe(2);
  });
});

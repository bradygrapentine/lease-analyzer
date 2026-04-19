import type { BoundingBox, PageText, TextItem } from './types';

export interface TableCell {
  text: string;
  xLeft: number;
  xRight: number;
  y: number;
  items: TextItem[];
}

export interface Table {
  page: number;
  rows: TableCell[][];
  bbox: BoundingBox;
}

const Y_TOLERANCE = 3;
const COLUMN_MATCH_RATIO = 0.6; // at least 60% of rows must share a column for it to count
const MIN_ROWS = 3;
const MIN_COLS = 2;
// Items whose left-edge falls within this many points of a column centroid
// are considered part of that column. Chosen to be loose enough to survive
// minor kerning/shift between pdf-lib drawText calls.
const COLUMN_BAND = 14;
// Two items in the same row whose horizontal gap is at most this many
// character widths count as a single multi-word cell.
const CELL_MERGE_GAP = 6;

interface Row {
  y: number;
  items: TextItem[];
}

/**
 * Detect table-like grids on each page.
 *
 * A run of 3+ consecutive y-aligned rows whose x-columns cluster into at
 * least 2 columns (each with support in ≥60% of rows) is emitted as a
 * `Table`. Items are merged into a single `TableCell` when they share a
 * row and their column band.
 *
 * Pure / synchronous: no I/O, no globals, safe to call per-page.
 */
export function detectTables(pages: PageText[]): Table[] {
  const out: Table[] = [];
  for (const page of pages) {
    out.push(...detectTablesOnPage(page));
  }
  return out;
}

function detectTablesOnPage(page: PageText): Table[] {
  if (page.items.length === 0) return [];
  // Drop whitespace-only text items — pdf.js emits them as layout hints
  // and they inflate the column-bucket count without adding information.
  const meaningful = page.items.filter((i) => i.text.trim().length > 0);
  if (meaningful.length === 0) return [];
  const rows = groupItemsByRow(meaningful);
  if (rows.length < MIN_ROWS) return [];

  const tables: Table[] = [];
  // Slide a window of contiguous rows, extending as long as the column
  // support holds. We don't currently split a page into multiple tables —
  // commercial leases typically have 1 schedule per page.
  let start = 0;
  while (start <= rows.length - MIN_ROWS) {
    const found = tryBuildTable(page.pageNumber, rows, start);
    if (found) {
      tables.push(found.table);
      start = found.endExclusive;
    } else {
      start += 1;
    }
  }
  return tables;
}

function groupItemsByRow(items: TextItem[]): Row[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: Row[] = [];
  for (const it of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - it.y) <= Y_TOLERANCE) {
      last.items.push(it);
    } else {
      rows.push({ y: it.y, items: [it] });
    }
  }
  // Sort each row left-to-right.
  for (const r of rows) r.items.sort((a, b) => a.x - b.x);
  return rows;
}

interface TableBuildResult {
  table: Table;
  endExclusive: number;
}

function tryBuildTable(
  pageNumber: number,
  rows: Row[],
  start: number,
): TableBuildResult | null {
  // Grow the window greedily while column support holds.
  let end = start + MIN_ROWS;
  let bestColumns: number[] | null = null;
  let bestEnd = -1;

  while (end <= rows.length) {
    const windowRows = rows.slice(start, end);
    const columns = inferColumns(windowRows);
    if (columns && columns.length >= MIN_COLS) {
      bestColumns = columns;
      bestEnd = end;
      end += 1;
    } else {
      break;
    }
  }

  if (!bestColumns || bestEnd < 0) return null;

  const windowRows = rows.slice(start, bestEnd);
  const tableRows = windowRows.map((r) => rowToCells(r, bestColumns!));
  // Every row must have at least one cell mapped; otherwise drop it.
  if (tableRows.some((cells) => cells.length === 0)) return null;

  const bbox = computeBbox(pageNumber, windowRows);
  return {
    table: { page: pageNumber, rows: tableRows, bbox },
    endExclusive: bestEnd,
  };
}

/**
 * Find candidate column centroids that are shared across a supermajority
 * of rows. Returns the centroids sorted left-to-right, or null if the
 * window does not look tabular.
 */
function inferColumns(rows: Row[]): number[] | null {
  if (rows.length < MIN_ROWS) return null;

  // Collect every item's left edge, then bucket by COLUMN_BAND.
  const buckets: { center: number; count: number; rowsSeen: Set<number> }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    for (const it of r.items) {
      const bucket = buckets.find((b) => Math.abs(b.center - it.x) <= COLUMN_BAND);
      if (bucket) {
        // Running-mean of the center so it drifts toward the true column.
        bucket.center = (bucket.center * bucket.count + it.x) / (bucket.count + 1);
        bucket.count += 1;
        bucket.rowsSeen.add(i);
      } else {
        buckets.push({ center: it.x, count: 1, rowsSeen: new Set([i]) });
      }
    }
  }

  const threshold = rows.length * COLUMN_MATCH_RATIO;
  const surviving = buckets
    .filter((b) => b.rowsSeen.size >= threshold)
    .map((b) => b.center)
    .sort((a, b) => a - b);
  if (surviving.length < MIN_COLS) return null;
  return surviving;
}

function rowToCells(row: Row, columns: number[]): TableCell[] {
  // Assign each item to its nearest column.
  const byColumn = new Map<number, TextItem[]>();
  for (const it of row.items) {
    const colIndex = nearestColumnIndex(it.x, columns);
    const arr = byColumn.get(colIndex);
    if (arr) arr.push(it);
    else byColumn.set(colIndex, [it]);
  }
  // Emit cells in column order; merge adjacent items within a column.
  const cells: TableCell[] = [];
  const sortedCols = [...byColumn.keys()].sort((a, b) => a - b);
  for (const c of sortedCols) {
    const colItems = byColumn.get(c);
    if (!colItems || colItems.length === 0) continue;
    colItems.sort((a, b) => a.x - b.x);
    cells.push(mergeColumnItems(colItems, row.y));
  }
  return cells;
}

function nearestColumnIndex(x: number, columns: number[]): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < columns.length; i++) {
    const c = columns[i];
    if (c === undefined) continue;
    const d = Math.abs(c - x);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function mergeColumnItems(items: TextItem[], y: number): TableCell {
  const parts: string[] = [];
  let xLeft = Infinity;
  let xRight = -Infinity;
  let prevRight: number | null = null;
  for (const it of items) {
    const avgCharW = it.width / Math.max(1, it.text.length);
    if (prevRight !== null && it.x - prevRight > avgCharW * CELL_MERGE_GAP) {
      // Large gap — treat as separate column already handled by nearestColumnIndex,
      // but defensively join with a space instead of merging.
      parts.push(it.text);
    } else {
      parts.push(it.text);
    }
    xLeft = Math.min(xLeft, it.x);
    xRight = Math.max(xRight, it.x + it.width);
    prevRight = it.x + it.width;
  }
  return {
    text: parts.join(' ').replace(/\s+/g, ' ').trim(),
    xLeft,
    xRight,
    y,
    items,
  };
}

function computeBbox(pageNumber: number, rows: Row[]): BoundingBox {
  let xLeft = Infinity;
  let xRight = -Infinity;
  let yBottom = Infinity;
  let yTop = -Infinity;
  for (const r of rows) {
    for (const it of r.items) {
      xLeft = Math.min(xLeft, it.x);
      xRight = Math.max(xRight, it.x + it.width);
      yBottom = Math.min(yBottom, it.y);
      yTop = Math.max(yTop, it.y + (it.height || it.fontSize));
    }
  }
  return { page: pageNumber, xLeft, xRight, yTop, yBottom };
}

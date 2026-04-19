import type { Table, TableCell } from '../parser/tables';
import type { RentSchedulePeriod } from './types';

export type { RentSchedulePeriod } from './types';

const PERIOD_HEADER_RE = /\b(period|term|from|year)\b/i;
const TO_HEADER_RE = /\bto\b/i;
const RENT_HEADER_RE = /\b(rent|amount|base|monthly)\b/i;
const ESCALATOR_HEADER_RE = /\b(escalator|increase|bump|%|step)\b/i;
const MONEY_RE = /\$\s*([\d,]+(?:\.\d{1,2})?)/;
const ISO_RE = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const SLASH_RE = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
const MONTH_RE = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi;
const YEAR_IN_PARENS_RE = /\((\d{4})\)/;
const PERCENT_RE = /([-+]?\d+(?:\.\d+)?)\s*%/;
const DECIMAL_RE = /^\s*([-+]?0?\.\d+)\s*$/;

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

interface HeaderMap {
  periodIdx: number;
  toIdx: number | null;
  rentIdx: number;
  escalatorIdx: number | null;
}

/**
 * Derive a `RentSchedulePeriod[]` from detected tables.
 *
 * Walks each table, finds the first header row that looks rent-schedule-y
 * (has a period/from column and a rent/amount column), then parses each
 * subsequent data row. Unparseable rows are skipped rather than breaking
 * the run — commercial schedules often include footnotes or blank-ish
 * rows beneath the numeric entries.
 */
export function extractRentSchedule(tables: Table[]): RentSchedulePeriod[] {
  for (const t of tables) {
    const schedule = extractFromTable(t);
    if (schedule.length > 0) return schedule;
  }
  return [];
}

function extractFromTable(t: Table): RentSchedulePeriod[] {
  if (t.rows.length < 2) return [];
  const headerResult = findHeader(t.rows);
  if (!headerResult) return [];
  const { header, rowOffset } = headerResult;

  const out: RentSchedulePeriod[] = [];
  for (let i = rowOffset + 1; i < t.rows.length; i++) {
    const row = t.rows[i];
    if (!row) continue;
    const period = parseRow(row, header);
    if (period) out.push(period);
  }
  return out;
}

function findHeader(
  rows: TableCell[][],
): { header: HeaderMap; rowOffset: number } | null {
  // Scan the first few rows for a header match. Most real schedules put
  // headers on row 0, but some have a title row.
  const scanLimit = Math.min(rows.length, 3);
  for (let r = 0; r < scanLimit; r++) {
    const row = rows[r];
    if (!row) continue;
    const header = identifyHeaders(row);
    if (header) return { header, rowOffset: r };
  }
  return null;
}

function identifyHeaders(row: TableCell[]): HeaderMap | null {
  let periodIdx = -1;
  let toIdx: number | null = null;
  let rentIdx = -1;
  let escalatorIdx: number | null = null;

  for (let i = 0; i < row.length; i++) {
    const text = row[i]?.text ?? '';
    const lower = text.toLowerCase().trim();
    if (rentIdx === -1 && RENT_HEADER_RE.test(lower)) {
      rentIdx = i;
      continue;
    }
    if (periodIdx === -1 && PERIOD_HEADER_RE.test(lower)) {
      periodIdx = i;
      continue;
    }
    if (toIdx === null && TO_HEADER_RE.test(lower) && lower !== 'to period') {
      toIdx = i;
      continue;
    }
    if (escalatorIdx === null && ESCALATOR_HEADER_RE.test(lower)) {
      escalatorIdx = i;
    }
  }

  if (periodIdx === -1 || rentIdx === -1) return null;
  return { periodIdx, toIdx, rentIdx, escalatorIdx };
}

function parseRow(row: TableCell[], header: HeaderMap): RentSchedulePeriod | null {
  const periodCell = row[header.periodIdx];
  const rentCell = row[header.rentIdx];
  if (!periodCell || !rentCell) return null;

  const amount = parseAmount(rentCell.text);
  if (amount === null) return null;

  const { from, to } = parseDates(
    periodCell.text,
    header.toIdx !== null ? row[header.toIdx]?.text ?? '' : '',
  );
  if (!from || !to) return null;

  const escalator =
    header.escalatorIdx !== null
      ? parseEscalator(row[header.escalatorIdx]?.text ?? '')
      : undefined;

  const period: RentSchedulePeriod = { from, to, amount };
  if (escalator !== undefined) period.escalator = escalator;
  return period;
}

function parseAmount(text: string): number | null {
  const m = MONEY_RE.exec(text);
  if (!m || !m[1]) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseEscalator(text: string): number | undefined {
  const pct = PERCENT_RE.exec(text);
  if (pct && pct[1]) {
    const n = Number(pct[1]);
    if (Number.isFinite(n)) return n;
  }
  const dec = DECIMAL_RE.exec(text);
  if (dec && dec[1]) {
    const n = Number(dec[1]);
    if (Number.isFinite(n)) return n * 100;
  }
  return undefined;
}

function parseDates(
  periodText: string,
  toText: string,
): { from: string | null; to: string | null } {
  // Case A: period cell holds both endpoints ("X to Y", "X - Y", "X – Y").
  const all = findAllIsoDates(periodText);
  if (all.length >= 2) {
    return { from: all[0] ?? null, to: all[all.length - 1] ?? null };
  }

  // Case B: separate from/to columns.
  if (toText) {
    const fromDates = findAllIsoDates(periodText);
    const toDates = findAllIsoDates(toText);
    if (fromDates.length > 0 && toDates.length > 0) {
      return { from: fromDates[0] ?? null, to: toDates[toDates.length - 1] ?? null };
    }
  }

  // Case C: "Year N (YYYY)" — expand to the full calendar year.
  const paren = YEAR_IN_PARENS_RE.exec(periodText);
  if (paren && paren[1]) {
    const year = Number(paren[1]);
    if (Number.isFinite(year)) {
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    }
  }

  // Case D: single date only → degenerate (point-in-time), treat as 1-day.
  if (all.length === 1) {
    const only = all[0];
    if (only) return { from: only, to: only };
  }

  return { from: null, to: null };
}

function findAllIsoDates(text: string): string[] {
  const out: string[] = [];
  ISO_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ISO_RE.exec(text)) !== null) {
    if (m[1] && m[2] && m[3]) {
      const iso = toIso(Number(m[1]), Number(m[2]), Number(m[3]));
      if (iso) out.push(iso);
    }
  }
  SLASH_RE.lastIndex = 0;
  while ((m = SLASH_RE.exec(text)) !== null) {
    if (m[1] && m[2] && m[3]) {
      const iso = toIso(Number(m[3]), Number(m[1]), Number(m[2]));
      if (iso) out.push(iso);
    }
  }
  MONTH_RE.lastIndex = 0;
  while ((m = MONTH_RE.exec(text)) !== null) {
    if (m[1] && m[2] && m[3]) {
      const month = MONTHS[m[1].toLowerCase()];
      if (month) {
        const iso = toIso(Number(m[3]), month, Number(m[2]));
        if (iso) out.push(iso);
      }
    }
  }
  return out;
}

function toIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 1000 || year > 9999) return null;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

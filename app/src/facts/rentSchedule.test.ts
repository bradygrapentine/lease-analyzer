import { describe, it, expect } from 'vitest';
import { extractRentSchedule } from './rentSchedule';
import type { Table, TableCell } from '../parser/tables';
import type { BoundingBox } from '../parser/types';
import { at } from '../test/assert';

function cell(text: string, xLeft = 0, xRight = 50, y = 0): TableCell {
  return { text, xLeft, xRight, y, items: [] };
}

function table(rows: string[][], page = 1): Table {
  const bbox: BoundingBox = { page, xLeft: 0, xRight: 500, yTop: 100, yBottom: 0 };
  return {
    page,
    rows: rows.map((r, rowIdx) => r.map((t, c) => cell(t, c * 100, c * 100 + 80, 100 - rowIdx * 10))),
    bbox,
  };
}

describe('extractRentSchedule — happy paths', () => {
  it('extracts ISO from/to with amounts and escalators', () => {
    const t = table([
      ['Period', 'Monthly Rent', 'Escalator'],
      ['2026-01-01 to 2026-12-31', '$1,000.00', '3%'],
      ['2027-01-01 to 2027-12-31', '$1,030.00', '3%'],
      ['2028-01-01 to 2028-12-31', '$1,060.90', '3%'],
    ]);
    const schedule = extractRentSchedule([t]);
    expect(schedule).toHaveLength(3);
    expect(at(schedule, 0)).toEqual({
      from: '2026-01-01',
      to: '2026-12-31',
      amount: 1000,
      escalator: 3,
    });
    expect(at(schedule, 2).amount).toBeCloseTo(1060.9);
  });

  it('handles separate from/to columns', () => {
    const t = table([
      ['From', 'To', 'Rent'],
      ['January 1, 2026', 'December 31, 2026', '$2,000'],
      ['January 1, 2027', 'December 31, 2027', '$2,100'],
      ['January 1, 2028', 'December 31, 2028', '$2,205'],
    ]);
    const schedule = extractRentSchedule([t]);
    expect(schedule).toHaveLength(3);
    expect(at(schedule, 0).from).toBe('2026-01-01');
    expect(at(schedule, 0).to).toBe('2026-12-31');
    expect(at(schedule, 0).amount).toBe(2000);
    expect(at(schedule, 0).escalator).toBeUndefined();
  });

  it('accepts "Year 1 / Year 2" period labels anchored to a base year', () => {
    const t = table([
      ['Year', 'Monthly Rent'],
      ['Year 1 (2026)', '$1,500'],
      ['Year 2 (2027)', '$1,545'],
      ['Year 3 (2028)', '$1,591'],
    ]);
    const schedule = extractRentSchedule([t]);
    expect(schedule).toHaveLength(3);
    expect(at(schedule, 0).from).toBe('2026-01-01');
    expect(at(schedule, 0).to).toBe('2026-12-31');
    expect(at(schedule, 1).from).toBe('2027-01-01');
  });
});

describe('extractRentSchedule — edge / negative', () => {
  it('returns empty when the table has no money column', () => {
    const t = table([
      ['Period', 'Note'],
      ['2026-01-01 to 2026-12-31', 'First'],
      ['2027-01-01 to 2027-12-31', 'Second'],
      ['2028-01-01 to 2028-12-31', 'Third'],
    ]);
    expect(extractRentSchedule([t])).toEqual([]);
  });

  it('skips rows that cannot be parsed into both a date range and an amount', () => {
    const t = table([
      ['Period', 'Rent'],
      ['2026-01-01 to 2026-12-31', '$1,000'],
      ['Conditional holdover', 'TBD'], // unparsable row
      ['2027-01-01 to 2027-12-31', '$1,030'],
    ]);
    const schedule = extractRentSchedule([t]);
    expect(schedule).toHaveLength(2);
    expect(at(schedule, 0).from).toBe('2026-01-01');
    expect(at(schedule, 1).from).toBe('2027-01-01');
  });

  it('returns empty when no table is supplied', () => {
    expect(extractRentSchedule([])).toEqual([]);
  });

  it('returns empty when the table has no rent-like header row', () => {
    // Looks tabular but is e.g. an addresses table.
    const t = table([
      ['Name', 'Address', 'Phone'],
      ['Alice', '123 Main St', '555-1234'],
      ['Bob', '456 Oak Ave', '555-5678'],
      ['Cara', '789 Pine Rd', '555-9999'],
    ]);
    expect(extractRentSchedule([t])).toEqual([]);
  });

  it('parses slash-formatted from/to dates in separate columns', () => {
    const t = table([
      ['From', 'To', 'Rent'],
      ['1/1/2026', '12/31/2026', '$3,000'],
      ['1/1/2027', '12/31/2027', '$3,100'],
      ['1/1/2028', '12/31/2028', '$3,200'],
    ]);
    const schedule = extractRentSchedule([t]);
    expect(at(schedule, 0).from).toBe('2026-01-01');
    expect(at(schedule, 0).to).toBe('2026-12-31');
  });

  it('treats a single-date period as a degenerate 1-day window', () => {
    const t = table([
      ['Period', 'Rent'],
      ['2026-06-01', '$500'],
      ['2026-06-02', '$501'],
      ['2026-06-03', '$502'],
    ]);
    const schedule = extractRentSchedule([t]);
    expect(schedule).toHaveLength(3);
    expect(at(schedule, 0)).toEqual({ from: '2026-06-01', to: '2026-06-01', amount: 500 });
  });

  it('parses escalator presented as decimal (0.03)', () => {
    const t = table([
      ['Period', 'Rent', 'Bump'],
      ['2026-01-01 to 2026-12-31', '$1,000', '0.03'],
      ['2027-01-01 to 2027-12-31', '$1,030', '0.03'],
      ['2028-01-01 to 2028-12-31', '$1,060.90', '0.03'],
    ]);
    const schedule = extractRentSchedule([t]);
    expect(at(schedule, 0).escalator).toBeCloseTo(3);
  });
});

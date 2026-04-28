// Wave 35 Part A — hybrid-stats-report fixture tests.
import { describe, it, expect } from 'vitest';
import {
  computeReport,
  formatTable,
  decide,
} from './hybrid-stats-report.mjs';

const fire = (seq, ruleId) => ({
  seq,
  timestamp: '2026-01-01T00:00:00Z',
  kind: 'llm-classify',
  payload: { ruleId },
  prevHash: null,
  entryHash: 'h',
});

const reject = (seq, ruleId) => ({
  seq,
  timestamp: '2026-01-01T00:00:00Z',
  kind: 'hybrid-feedback',
  payload: { ruleId, signal: 'not-relevant' },
  prevHash: null,
  entryHash: 'h',
});

const RICH_FIXTURE = {
  schema: 'leaseguard.audit.v1',
  entries: [
    // 12 fires, 9 rejects → precision 0.25, qualifying.
    ...Array.from({ length: 12 }, (_, i) => fire(i, 'auto-renewal')),
    ...Array.from({ length: 9 }, (_, i) => reject(12 + i, 'auto-renewal')),
    // 5 fires, 0 rejects → precision 1.00, under fires floor.
    ...Array.from({ length: 5 }, (_, i) => fire(30 + i, 'jury-trial-waiver')),
  ],
};

const SPARSE_FIXTURE = {
  schema: 'leaseguard.audit.v1',
  entries: [
    ...Array.from({ length: 3 }, (_, i) => fire(i, 'arbitration-clause')),
  ],
};

const EMPTY_FIXTURE = { schema: 'leaseguard.audit.v1', entries: [] };

describe('hybrid-stats-report', () => {
  it('decides ACT when ≥1 rule has fires≥10 AND precision<0.70', () => {
    expect(decide(computeReport(RICH_FIXTURE))).toEqual({
      action: 'ACT',
      qualifying: ['auto-renewal'],
    });
  });

  it('decides NO-OP when no rule clears the fires floor', () => {
    expect(decide(computeReport(SPARSE_FIXTURE))).toEqual({
      action: 'NO-OP',
      qualifying: [],
    });
  });

  it('decides NO-OP on an empty audit chain', () => {
    expect(decide(computeReport(EMPTY_FIXTURE))).toEqual({
      action: 'NO-OP',
      qualifying: [],
    });
  });

  it('emits a markdown table with one row per rule seen', () => {
    const md = formatTable(computeReport(RICH_FIXTURE));
    expect(md).toContain('| ruleId | fires | rejects | precision |');
    expect(md).toContain('| auto-renewal | 12 | 9 | 0.25 |');
    expect(md).toContain('| jury-trial-waiver | 5 | 0 | 1.00 |');
  });

  it('clamps precision to 0 when rejects exceed fires (defensive)', () => {
    // Rule with 2 fires + 5 rejects (audit predates consumer).
    const fixture = {
      schema: 'leaseguard.audit.v1',
      entries: [
        ...Array.from({ length: 2 }, (_, i) => fire(i, 'odd-rule')),
        ...Array.from({ length: 5 }, (_, i) => reject(2 + i, 'odd-rule')),
      ],
    };
    const md = formatTable(computeReport(fixture));
    expect(md).toContain('| odd-rule | 2 | 5 | 0.00 |');
  });

  it('ignores hybrid-feedback entries with signals other than not-relevant', () => {
    const fixture = {
      schema: 'leaseguard.audit.v1',
      entries: [
        fire(0, 'foo'),
        {
          seq: 1,
          timestamp: '2026-01-01T00:00:00Z',
          kind: 'hybrid-feedback',
          payload: { ruleId: 'foo', signal: 'helpful' },
          prevHash: null,
          entryHash: 'h',
        },
      ],
    };
    const report = computeReport(fixture);
    expect(report.rows).toEqual([
      { ruleId: 'foo', fires: 1, rejects: 0, precision: 1 },
    ]);
  });
});

import { describe, it, expect } from 'vitest';
import { computeHybridStats } from './hybridStats';
import type { AuditEntry } from './auditLog';

function entry(
  seq: number,
  kind: string,
  payload: Record<string, unknown>,
): AuditEntry {
  return {
    seq,
    timestamp: `2026-04-26T00:00:${String(seq).padStart(2, '0')}Z`,
    kind,
    payload,
    prevHash: '',
    entryHash: 'x'.repeat(64),
  };
}

describe('computeHybridStats', () => {
  it('returns empty array on empty input', () => {
    expect(computeHybridStats([])).toEqual([]);
  });

  it('ignores unrelated audit kinds', () => {
    const entries: AuditEntry[] = [
      entry(1, 'analyze', { leaseName: 'a.pdf' }),
      entry(2, 'export', { format: 'json' }),
      entry(3, 'save-lease', { id: 'L1' }),
    ];
    expect(computeHybridStats(entries)).toEqual([]);
  });

  it('counts llm-classify as fires per ruleId', () => {
    const entries: AuditEntry[] = [
      entry(1, 'llm-classify', { ruleId: 'r-a', paragraphIndex: 0 }),
      entry(2, 'llm-classify', { ruleId: 'r-a', paragraphIndex: 1 }),
      entry(3, 'llm-classify', { ruleId: 'r-b', paragraphIndex: 0 }),
    ];
    const stats = computeHybridStats(entries);
    expect(stats).toEqual([
      { ruleId: 'r-a', fires: 2, notRelevant: 0, precision: 1 },
      { ruleId: 'r-b', fires: 1, notRelevant: 0, precision: 1 },
    ]);
  });

  it('counts hybrid-feedback with not-relevant signal as rejects', () => {
    const entries: AuditEntry[] = [
      entry(1, 'llm-classify', { ruleId: 'r-a' }),
      entry(2, 'llm-classify', { ruleId: 'r-a' }),
      entry(3, 'llm-classify', { ruleId: 'r-a' }),
      entry(4, 'hybrid-feedback', { ruleId: 'r-a', signal: 'not-relevant' }),
    ];
    const [row] = computeHybridStats(entries);
    expect(row).toMatchObject({ ruleId: 'r-a', fires: 3, notRelevant: 1 });
    // 2/3 = 67% — verify the underlying ratio is precise (rounding lives in UI).
    expect(row!.precision).toBeCloseTo(2 / 3, 10);
  });

  it('ignores hybrid-feedback entries with non-not-relevant signals', () => {
    const entries: AuditEntry[] = [
      entry(1, 'llm-classify', { ruleId: 'r-a' }),
      entry(2, 'hybrid-feedback', { ruleId: 'r-a', signal: 'helpful' }),
    ];
    const [row] = computeHybridStats(entries);
    expect(row).toEqual({
      ruleId: 'r-a',
      fires: 1,
      notRelevant: 0,
      precision: 1,
    });
  });

  it('returns precision=null when fires=0 (orphan rejects)', () => {
    const entries: AuditEntry[] = [
      entry(1, 'hybrid-feedback', { ruleId: 'orphan', signal: 'not-relevant' }),
    ];
    expect(computeHybridStats(entries)).toEqual([
      { ruleId: 'orphan', fires: 0, notRelevant: 1, precision: null },
    ]);
  });

  it('clamps precision to 0 when rejects > fires (defensive)', () => {
    const entries: AuditEntry[] = [
      entry(1, 'llm-classify', { ruleId: 'r-a' }),
      entry(2, 'hybrid-feedback', { ruleId: 'r-a', signal: 'not-relevant' }),
      entry(3, 'hybrid-feedback', { ruleId: 'r-a', signal: 'not-relevant' }),
    ];
    const [row] = computeHybridStats(entries);
    expect(row).toEqual({
      ruleId: 'r-a',
      fires: 1,
      notRelevant: 2,
      precision: 0,
    });
  });

  it('skips entries with missing/invalid ruleId', () => {
    const entries: AuditEntry[] = [
      entry(1, 'llm-classify', {}),
      entry(2, 'llm-classify', { ruleId: '' }),
      entry(3, 'llm-classify', { ruleId: 42 }),
      entry(4, 'hybrid-feedback', { signal: 'not-relevant' }),
    ];
    expect(computeHybridStats(entries)).toEqual([]);
  });

  it('sorts rows by ruleId ascending for stable output', () => {
    const entries: AuditEntry[] = [
      entry(1, 'llm-classify', { ruleId: 'zeta' }),
      entry(2, 'llm-classify', { ruleId: 'alpha' }),
      entry(3, 'llm-classify', { ruleId: 'mu' }),
    ];
    expect(computeHybridStats(entries).map((r) => r.ruleId)).toEqual([
      'alpha',
      'mu',
      'zeta',
    ]);
  });
});

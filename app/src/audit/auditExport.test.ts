import { describe, expect, it } from 'vitest';
import type { AuditEntry } from './auditLog';
import { AUDIT_EXPORT_SCHEMA, buildAuditLogJson } from './auditExport';

function entry(seq: number, over: Partial<AuditEntry> = {}): AuditEntry {
  return {
    seq,
    timestamp: `2026-04-${String(seq).padStart(2, '0')}T00:00:00.000Z`,
    kind: 'analyze',
    payload: { n: seq },
    prevHash: seq === 1 ? '' : 'a'.repeat(64),
    entryHash: 'b'.repeat(64),
    ...over,
  };
}

describe('buildAuditLogJson', () => {
  it('emits the v1 schema + entry count + chain result', () => {
    const json = buildAuditLogJson(
      [entry(1), entry(2)],
      { ok: true },
    );
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed['schema']).toBe(AUDIT_EXPORT_SCHEMA);
    expect(parsed['entryCount']).toBe(2);
    expect(parsed['chainVerification']).toEqual({ ok: true });
    expect(Array.isArray(parsed['entries'])).toBe(true);
    expect((parsed['entries'] as unknown[]).length).toBe(2);
  });

  it('is deterministic for the same inputs', () => {
    const a = buildAuditLogJson([entry(1), entry(2)], { ok: true });
    const b = buildAuditLogJson([entry(1), entry(2)], { ok: true });
    expect(a).toBe(b);
  });

  it('handles an empty log', () => {
    const json = buildAuditLogJson([], null);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed['entryCount']).toBe(0);
    expect(parsed['entries']).toEqual([]);
    expect(parsed['chainVerification']).toBeNull();
  });

  it('includes firstBadSeq when chain is broken', () => {
    const json = buildAuditLogJson(
      [entry(1), entry(2)],
      { ok: false, firstBadSeq: 2 },
    );
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed['chainVerification']).toEqual({ ok: false, firstBadSeq: 2 });
  });

  it('preserves entry order (seq ascending) regardless of input order', () => {
    const json = buildAuditLogJson(
      [entry(2), entry(1)],
      { ok: true },
    );
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const entries = parsed['entries'] as Array<{ seq: number }>;
    expect(entries.map((e) => e.seq)).toEqual([1, 2]);
  });
});

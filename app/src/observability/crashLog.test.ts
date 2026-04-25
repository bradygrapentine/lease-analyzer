import { beforeEach, describe, it, expect } from 'vitest';
import { clearCrashLog, recordCrash, snapshotCrashLog, CRASH_LOG_CAPACITY } from './crashLog';

describe('crashLog', () => {
  beforeEach(() => {
    clearCrashLog();
  });

  it('starts empty', () => {
    expect(snapshotCrashLog()).toEqual([]);
  });

  it('records crashes with timestamp, message, and stack', () => {
    const err = new Error('oops');
    recordCrash(err, 'componentStack here');
    const snap = snapshotCrashLog();
    expect(snap).toHaveLength(1);
    expect(snap[0]?.message).toBe('oops');
    expect(snap[0]?.componentStack).toContain('componentStack here');
    expect(typeof snap[0]?.timestamp).toBe('number');
  });

  it('caps the ring buffer at CRASH_LOG_CAPACITY', () => {
    for (let i = 0; i < CRASH_LOG_CAPACITY + 5; i++) {
      recordCrash(new Error(`err${i}`));
    }
    const snap = snapshotCrashLog();
    expect(snap).toHaveLength(CRASH_LOG_CAPACITY);
    // Newest first; the last 5 errs pushed should be at the top.
    expect(snap[0]?.message).toBe(`err${CRASH_LOG_CAPACITY + 4}`);
  });

  it('handles non-Error values', () => {
    recordCrash('string thrown');
    recordCrash({ weird: true });
    const snap = snapshotCrashLog();
    expect(snap).toHaveLength(2);
    expect(snap[1]?.message).toBe('string thrown');
    expect(snap[0]?.message).toContain('weird');
  });

  it('falls back to String() when JSON.stringify fails (circular ref)', () => {
    const circ: Record<string, unknown> = {};
    circ.self = circ;
    recordCrash(circ);
    expect(snapshotCrashLog()[0]?.message).toBeDefined();
  });
});

import { diagnosticsReport, diagnosticsSummary } from './crashLog';

describe('diagnosticsReport', () => {
  it('emits schema-stamped JSON with crashes included', () => {
    clearCrashLog();
    recordCrash(new Error('in the report'));
    const parsed = JSON.parse(diagnosticsReport());
    expect(parsed.schema).toBe('leaseguard.diagnostics.v1');
    expect(parsed.crashes).toHaveLength(1);
    expect(parsed.crashes[0].message).toBe('in the report');
    expect(typeof parsed.generatedAt).toBe('string');
  });

  it('includes a summary array enumerating every category in the payload', () => {
    clearCrashLog();
    const parsed = JSON.parse(diagnosticsReport());
    expect(Array.isArray(parsed.summary)).toBe(true);
    expect(parsed.summary).toEqual([
      'userAgent',
      'stack-traces (last 20)',
      'rule-pack versions',
      'no PDF bytes',
      'no IDB contents',
    ]);
  });

  it('summary explicitly disclaims PDF bytes and IDB contents', () => {
    const summary = diagnosticsSummary();
    expect(summary).toContain('no PDF bytes');
    expect(summary).toContain('no IDB contents');
  });
});

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { _resetDbForTests, openLeaseDb, saveLease } from './storage';
import { listLeasesFiltered } from './listLeasesFiltered';
import type { LeaseDocument } from '../parser/types';
import type { Finding } from '../rules/types';

function makeDoc(): LeaseDocument {
  return {
    pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
    paragraphs: [{ text: 'Hello', page: 1 }],
    sections: [],
    raw: 'Hello',
  };
}

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'auto-renewal',
    severity: 'medium',
    category: 'termination',
    title: 'Auto-renewal',
    explanation: 'Test',
    citation: null,
    page: 1,
    paragraphIndex: 0,
    snippet: 'snippet',
    span: { start: 0, end: 7 },
    confidence: 0.9,
    negated: false,
    rulePackVersion: '1.0.0',
    ...overrides,
  };
}

async function wipe(): Promise<void> {
  const db = await openLeaseDb();
  db.close();
  _resetDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('leaseguard');
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => reject(req.error);
    req.onblocked = (): void => resolve();
  });
}

describe('listLeasesFiltered', () => {
  beforeEach(async () => {
    await wipe();
  });

  // saveLease derives rulePackVersion from findings[0]; a zero-finding
  // record falls back to 'unknown'. So to pin pack version on a clean
  // record we still pass a finding (and assert finding-count separately).
  async function seed(): Promise<void> {
    // Clean v1: one finding, but findingCount stamped via input.findings.length.
    // To get a TRUE 0-finding-on-1.0.0 record we write directly to the store.
    await saveLease({
      name: 'Risky-1.0.0.pdf',
      doc: makeDoc(),
      findings: [makeFinding(), makeFinding({ ruleId: 'late-fee' })],
    });
    await saveLease({
      name: 'Other-2.0.0.pdf',
      doc: makeDoc(),
      findings: [makeFinding({ rulePackVersion: '2.0.0' })],
    });
    // Direct put for a (findingCount: 0, rulePackVersion: '1.0.0') row.
    const db = await openLeaseDb();
    await db.put('leases', {
      id: 'clean-v1',
      name: 'Clean-1.0.0.pdf',
      createdAt: 5000,
      updatedAt: 5000,
      rulePackVersion: '1.0.0',
      pageCount: 1,
      findingCount: 0,
      doc: makeDoc(),
      findings: [],
    });
  }

  it('returns the full set when no filter is provided', async () => {
    await seed();
    const all = await listLeasesFiltered({});
    expect(all.length).toBe(3);
  });

  it('filters by both findingCount and rulePackVersion via the compound index', async () => {
    await seed();
    const cleanV1 = await listLeasesFiltered({ findingCount: 0, rulePackVersion: '1.0.0' });
    expect(cleanV1.map((m) => m.name)).toEqual(['Clean-1.0.0.pdf']);
    const first = cleanV1[0];
    expect(first).toBeDefined();
    expect(first as object).not.toHaveProperty('doc');
    expect(first as object).not.toHaveProperty('findings');
  });

  it('filters by findingCount alone', async () => {
    await seed();
    const zero = await listLeasesFiltered({ findingCount: 0 });
    expect(zero.map((m) => m.name)).toEqual(['Clean-1.0.0.pdf']);
  });

  it('filters by rulePackVersion alone', async () => {
    await seed();
    const v1 = await listLeasesFiltered({ rulePackVersion: '1.0.0' });
    expect(v1.length).toBe(2);
    expect(v1.every((l) => l.rulePackVersion === '1.0.0')).toBe(true);
  });

  it('returns metadata only (no doc/findings payload)', async () => {
    await seed();
    const list = await listLeasesFiltered({ findingCount: 0, rulePackVersion: '1.0.0' });
    for (const meta of list) {
      expect(meta as object).not.toHaveProperty('doc');
      expect(meta as object).not.toHaveProperty('findings');
    }
  });
});

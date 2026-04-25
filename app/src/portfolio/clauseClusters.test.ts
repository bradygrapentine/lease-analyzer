import { describe, it, expect } from 'vitest';
import { clusterParagraphs, type ClauseCluster } from './clauseClusters';
import type { LeaseRecord } from '../storage/storage';
import type { LeaseDocument } from '../parser/types';

function makeDoc(paragraphs: string[]): LeaseDocument {
  return {
    pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
    paragraphs: paragraphs.map((text) => ({ text, page: 1 })),
    sections: [],
    raw: paragraphs.join('\n\n'),
  };
}

function makeLease(id: string, paragraphs: string[]): LeaseRecord {
  return {
    id,
    name: `${id}.pdf`,
    createdAt: 1000,
    updatedAt: 1000,
    rulePackVersion: '1.0.0',
    pageCount: 1,
    findingCount: 0,
    doc: makeDoc(paragraphs),
    findings: [],
  };
}

const STD_AUTO_RENEW =
  'This lease shall automatically renew for successive one year terms unless either party provides written notice of non-renewal at least sixty days prior to the end of the then-current term.';

const NEAR_DUP_AUTO_RENEW =
  'This lease shall automatically renew for successive one year terms unless either party provides written notice of nonrenewal at least sixty days prior to the end of the current term.';

const UNRELATED =
  'Tenant shall maintain commercial general liability insurance with minimum limits of one million dollars per occurrence covering bodily injury and property damage at all times.';

describe('clusterParagraphs', () => {
  it('returns an empty array when given no leases', () => {
    expect(clusterParagraphs([])).toEqual([]);
  });

  it('clusters identical paragraphs across two leases', () => {
    const leases = [
      makeLease('L1', [STD_AUTO_RENEW]),
      makeLease('L2', [STD_AUTO_RENEW]),
    ];
    const out: ClauseCluster[] = clusterParagraphs(leases);
    const auto = out.find((c) =>
      c.paragraphs.some((p) => p.leaseId === 'L1'),
    );
    expect(auto).toBeDefined();
    expect(auto?.paragraphs.map((p) => p.leaseId).sort()).toEqual(['L1', 'L2']);
  });

  it('clusters near-duplicates whose Jaccard >= 0.8', () => {
    const leases = [
      makeLease('L1', [STD_AUTO_RENEW]),
      makeLease('L2', [NEAR_DUP_AUTO_RENEW]),
    ];
    const out = clusterParagraphs(leases, { threshold: 0.8 });
    const merged = out.find((c) => c.paragraphs.length >= 2);
    expect(merged).toBeDefined();
    expect(merged?.paragraphs.map((p) => p.leaseId).sort()).toEqual([
      'L1',
      'L2',
    ]);
  });

  it('does not cluster unrelated paragraphs', () => {
    const leases = [
      makeLease('L1', [STD_AUTO_RENEW]),
      makeLease('L2', [UNRELATED]),
    ];
    const out = clusterParagraphs(leases, { threshold: 0.8 });
    // No cluster has both leases.
    const cross = out.find(
      (c) =>
        c.paragraphs.some((p) => p.leaseId === 'L1') &&
        c.paragraphs.some((p) => p.leaseId === 'L2'),
    );
    expect(cross).toBeUndefined();
  });

  it('produces a deterministic order across runs', () => {
    const leases = [
      makeLease('L1', [STD_AUTO_RENEW, UNRELATED]),
      makeLease('L2', [STD_AUTO_RENEW]),
    ];
    const a = clusterParagraphs(leases, { threshold: 0.8 });
    const b = clusterParagraphs(leases, { threshold: 0.8 });
    expect(a.map((c) => c.clusterId)).toEqual(b.map((c) => c.clusterId));
  });

  it('records leaseId + paragraphIndex for every clustered paragraph', () => {
    const leases = [
      makeLease('L1', [UNRELATED, STD_AUTO_RENEW]),
      makeLease('L2', [STD_AUTO_RENEW]),
    ];
    const out = clusterParagraphs(leases, { threshold: 0.8 });
    const merged = out.find((c) => c.paragraphs.length >= 2);
    expect(merged).toBeDefined();
    const l1 = merged?.paragraphs.find((p) => p.leaseId === 'L1');
    expect(l1?.paragraphIndex).toBe(1);
    const l2 = merged?.paragraphs.find((p) => p.leaseId === 'L2');
    expect(l2?.paragraphIndex).toBe(0);
  });
});

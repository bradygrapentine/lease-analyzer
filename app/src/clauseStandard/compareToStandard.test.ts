import { describe, it, expect } from 'vitest';
import {
  compareToStandard,
  type StandardComparison,
} from './compareToStandard';
import type { StandardClause } from './standardSuite';
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
    createdAt: 1,
    updatedAt: 1,
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

function makeStandard(id: string, text: string): StandardClause {
  return {
    id,
    name: id,
    sourceLeaseId: 'origin',
    sourceParagraphIndex: 0,
    normalizedText: text,
    createdAt: 1,
  };
}

describe('compareToStandard', () => {
  it('returns an empty array when the suite is empty', () => {
    expect(compareToStandard(makeLease('L1', [STD_AUTO_RENEW]), [])).toEqual(
      [],
    );
  });

  it('returns one row per standard, with paragraphIndex null + similarity 0 when nothing matches', () => {
    const lease = makeLease('L1', [UNRELATED]);
    const suite = [makeStandard('s-auto', STD_AUTO_RENEW)];
    const out: StandardComparison[] = compareToStandard(lease, suite, {
      threshold: 0.8,
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.standardId).toBe('s-auto');
    expect(out[0]?.paragraphIndex).toBeNull();
    expect(out[0]?.similarity).toBeLessThan(0.8);
  });

  it('matches a standard when a lease paragraph is identical', () => {
    const lease = makeLease('L1', [UNRELATED, STD_AUTO_RENEW]);
    const suite = [makeStandard('s-auto', STD_AUTO_RENEW)];
    const out = compareToStandard(lease, suite, { threshold: 0.8 });
    const auto = out.find((r) => r.standardId === 's-auto');
    expect(auto?.paragraphIndex).toBe(1);
    expect(auto?.similarity).toBeGreaterThanOrEqual(0.8);
  });

  it('matches near-duplicates above the 0.8 threshold', () => {
    const lease = makeLease('L1', [NEAR_DUP_AUTO_RENEW]);
    const suite = [makeStandard('s-auto', STD_AUTO_RENEW)];
    const out = compareToStandard(lease, suite, { threshold: 0.8 });
    const auto = out.find((r) => r.standardId === 's-auto');
    expect(auto?.paragraphIndex).toBe(0);
    expect(auto?.similarity).toBeGreaterThanOrEqual(0.8);
  });

  it('returns one row per standard in suite order', () => {
    const lease = makeLease('L1', [STD_AUTO_RENEW]);
    const suite = [
      makeStandard('s-auto', STD_AUTO_RENEW),
      makeStandard('s-other', UNRELATED),
    ];
    const out = compareToStandard(lease, suite, { threshold: 0.8 });
    expect(out.map((r) => r.standardId)).toEqual(['s-auto', 's-other']);
  });
});

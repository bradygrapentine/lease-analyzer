import { describe, it, expect } from 'vitest';
import { analyze } from './analyze';
import { RULE_PACK_V1 } from './packV1';
import { detectSections } from '../parser/sections';
import type { LeaseDocument, Paragraph } from '../parser/types';

function docFrom(paragraphs: Paragraph[]): LeaseDocument {
  return {
    pages: [],
    paragraphs,
    sections: detectSections(paragraphs),
    raw: paragraphs.map((p) => p.text).join('\n\n'),
  };
}

function hitIds(text: string): string[] {
  const doc = docFrom([{ text, page: 1 }]);
  return analyze(doc, RULE_PACK_V1).map((f) => f.ruleId);
}

describe('RULE_PACK_V1 positive cases', () => {
  const cases: Array<[string, string]> = [
    ['auto-renewal', 'This lease shall automatically renew for one year.'],
    ['early-termination-fee', 'Tenant owes an early termination fee equal to two months rent.'],
    ['assignment-subletting', 'Tenant may not sublet the premises without landlord consent.'],
    ['late-fees', 'A late fee of $50 applies after five days.'],
    ['attorney-fees', 'The prevailing party may recover attorney fees and costs.'],
    ['jury-waiver', 'The parties hereby waive any right to a jury trial.'],
    ['arbitration', 'All disputes shall be resolved by binding arbitration.'],
    ['indemnification', 'Tenant shall indemnify landlord against all claims.'],
    ['rent-escalation', 'Rent shall increase by 3% per year.'],
    ['personal-guaranty', 'The guarantor agrees to be personally guarantor of all obligations.'],
  ];

  it.each(cases)('rule %s hits on its positive fixture', (ruleId, text) => {
    expect(hitIds(text)).toContain(ruleId);
  });
});

describe('RULE_PACK_V1 negative cases', () => {
  it('does not flag a plain boilerplate paragraph', () => {
    const benign = 'This document is made in the State of California between the parties.';
    expect(hitIds(benign)).toEqual([]);
  });
});

describe('RULE_PACK_V1 metadata', () => {
  it('every rule has a unique id and required fields', () => {
    const ids = RULE_PACK_V1.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rule of RULE_PACK_V1) {
      expect(rule.title.length).toBeGreaterThan(0);
      expect(rule.explanation.length).toBeGreaterThan(10);
    }
  });
});

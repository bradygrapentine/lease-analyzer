import { describe, it, expect } from 'vitest';
import { analyze, RULE_PACK_VERSION } from './analyze';
import { detectSections } from '../parser/sections';
import type { LeaseDocument, Paragraph } from '../parser/types';
import type { Rule } from './types';
import { at } from '../test/assert';

function docFrom(paragraphs: Paragraph[]): LeaseDocument {
  return {
    pages: [],
    paragraphs,
    sections: detectSections(paragraphs),
    raw: paragraphs.map((p) => p.text).join('\n\n'),
  };
}

const renewRule: Rule = {
  id: 'auto-renewal',
  severity: 'medium',
  category: 'termination',
  title: 'Auto-renewal',
  explanation: 'Lease renews automatically unless canceled.',
  citation: null,
  match: { type: 'regex', pattern: 'auto[- ]?renew', flags: 'i' },
};

const feesRule: Rule = {
  id: 'attorney-fees',
  severity: 'low',
  category: 'dispute',
  title: 'Attorney fees',
  explanation: 'Loser pays attorney fees.',
  citation: null,
  match: { type: 'keywordProximity', keywords: ['attorney', 'fees'], window: 40 },
};

describe('analyze', () => {
  it('returns findings stamped with rule metadata and pack version', () => {
    const doc = docFrom([{ text: 'This lease shall auto-renew annually.', page: 1 }]);
    const findings = analyze(doc, [renewRule]);
    expect(findings).toHaveLength(1);
    const f = at(findings, 0);
    expect(f.ruleId).toBe('auto-renewal');
    expect(f.severity).toBe('medium');
    expect(f.category).toBe('termination');
    expect(f.page).toBe(1);
    expect(f.rulePackVersion).toBe(RULE_PACK_VERSION);
    expect(f.confidence).toBeGreaterThan(0);
    expect(f.negated).toBe(false);
  });

  it('flags findings in a negated sentence with lower confidence', () => {
    const doc = docFrom([
      { text: 'This lease shall not auto-renew under any circumstances.', page: 1 },
    ]);
    const findings = analyze(doc, [renewRule]);
    expect(findings).toHaveLength(1);
    const f = at(findings, 0);
    expect(f.negated).toBe(true);
    expect(f.confidence).toBeLessThan(0.9);
  });

  it('sorts findings by page, then paragraph index, then span start, then rule id', () => {
    const doc = docFrom([
      { text: 'Prevailing party may recover attorney fees.', page: 1 },
      { text: 'This lease shall auto-renew annually.', page: 2 },
    ]);
    const findings = analyze(doc, [renewRule, feesRule]);
    expect(findings.map((f) => f.ruleId)).toEqual(['attorney-fees', 'auto-renewal']);
  });

  it('produces stable output regardless of input rule order', () => {
    const doc = docFrom([{ text: 'auto-renew and attorney fees apply.', page: 1 }]);
    const a = analyze(doc, [renewRule, feesRule]);
    const b = analyze(doc, [feesRule, renewRule]);
    expect(a).toEqual(b);
  });
});

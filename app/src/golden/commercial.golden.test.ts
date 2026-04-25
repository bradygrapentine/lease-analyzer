import { describe, it, expect } from 'vitest';
import { parseLease } from '../parser/parseLease';
import { detectTables } from '../parser/tables';
import { buildEnterpriseCommercialPdf } from '../parser/testFixtures';
import { extractLeaseFacts } from '../facts/extractFacts';
import { analyze } from '../rules/analyze';
import { RULE_PACK_V1 } from '../rules/packV1';

/**
 * Canonical multi-feature commercial regression check. The fixture is
 * synthetic and pinned: every count below should change deliberately.
 *
 * If you find yourself relaxing one of these expectations to make a
 * parser change land, stop and ask whether the parser actually still
 * delivers the feature the customer expects.
 */
describe('commercial golden fixture', () => {
  it('parseLease + analyze + extractLeaseFacts + tables + cross-refs all return the expected shape', async () => {
    const bytes = await buildEnterpriseCommercialPdf();
    const doc = await parseLease(bytes);

    // --- parseLease ---
    expect(doc.pages.length).toBe(3);
    expect(doc.sections.length).toBeGreaterThanOrEqual(5);
    expect(doc.raw).toContain('COMMERCIAL LEASE');

    // --- analyze (commercial rule ids fire) ---
    const findings = analyze(doc, RULE_PACK_V1);
    const ids = new Set(findings.map((f) => f.ruleId));
    expect(ids).toContain('rent-escalation');
    expect(ids).toContain('early-termination-fee');
    expect(ids).toContain('indemnification');
    expect(ids).toContain('personal-guaranty');

    // --- table extraction ---
    const tables = detectTables(doc.pages);
    expect(tables.length).toBeGreaterThanOrEqual(3);

    // --- extractLeaseFacts ---
    const facts = extractLeaseFacts(doc);
    expect(facts.baseRent?.amount).toBe(10000);
    expect(facts.commencementDate).toBe('2026-01-01');
    expect(facts.expirationDate).toBe('2029-12-31');

    // Definitions: ≥6 unique terms, mixing both quoted and bare-capped phrasing.
    expect(facts.definitions.length).toBeGreaterThanOrEqual(6);
    const terms = facts.definitions.map((d) => d.term);
    expect(terms).toContain('Premises');
    expect(terms).toContain('Landlord');
    expect(terms).toContain('Tenant');
    expect(terms).toContain('Commencement Date');
    expect(terms).toContain('Base Rent');
    expect(terms).toContain('Operating Expenses');

    // Cross-references: ≥4, covering sections, exhibits, and schedules.
    expect(facts.crossReferences.length).toBeGreaterThanOrEqual(4);
    const refTexts = facts.crossReferences.map((r) => r.text);
    expect(refTexts).toContain('Section 4');
    expect(refTexts).toContain('Exhibit A');
    expect(refTexts).toContain('Schedule 1');
    // At least one of each kind of target is resolvable.
    const targetKinds = new Set(facts.crossReferences.map((r) => r.target.split(':')[0]));
    expect(targetKinds.has('section')).toBe(true);
    expect(targetKinds.has('exhibit')).toBe(true);
    expect(targetKinds.has('schedule')).toBe(true);

    // Rent schedule: exactly 4 periods extracted from the embedded table.
    expect(facts.rentSchedule).toBeDefined();
    expect(facts.rentSchedule).toHaveLength(4);
    expect(facts.rentSchedule?.[0]).toEqual({
      from: '2026-01-01',
      to: '2026-12-31',
      amount: 10000,
      escalator: 3,
    });
    expect(facts.rentSchedule?.[3]?.from).toBe('2029-01-01');
    expect(facts.rentSchedule?.[3]?.to).toBe('2029-12-31');
  });
});

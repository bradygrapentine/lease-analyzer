import { describe, it, expect } from 'vitest';
import { parseLease } from '../parser/parseLease';
import { detectTables } from '../parser/tables';
import { makePdf, makeCommercialTableLease, type PdfFixturePage } from '../parser/testFixtures';
import { extractLeaseFacts } from '../facts/extractFacts';
import { analyze } from './analyze';
import { buildCommercialFullPdf } from './fixtures/commercial-full';
import { RULE_PACK_V1 } from './packV1';

function pageFromLines(lines: string[], opts: { y0?: number; dy?: number } = {}): PdfFixturePage {
  const y0 = opts.y0 ?? 72;
  const dy = opts.dy ?? 18;
  return {
    blocks: lines.map((text, i) => ({ text, x: 72, y: y0 + i * dy })),
  };
}

async function residentialLease(): Promise<Uint8Array> {
  return makePdf([
    pageFromLines([
      'RESIDENTIAL LEASE AGREEMENT',
      '1. Rent',
      'Tenant shall pay $2,000 on the first of each month.',
      'A late fee of $75 applies after five days.',
      '2. Term',
      'This lease shall automatically renew for one year unless cancelled.',
      '3. Subletting',
      'Tenant shall not sublet the premises without landlord consent.',
    ]),
    pageFromLines([
      '4. Disputes',
      'The prevailing party may recover attorney fees.',
      'All disputes shall be resolved by binding arbitration.',
      'Tenant waives any right to a jury trial.',
    ]),
  ]);
}

async function commercialLease(): Promise<Uint8Array> {
  return makePdf([
    pageFromLines([
      'COMMERCIAL LEASE',
      '1. Rent',
      'Base rent is $5,000 per month. Rent shall increase by 3% per year.',
      '2. Termination',
      'Early termination fee equals three months rent.',
      '3. Liability',
      'Tenant shall indemnify landlord against all claims.',
      '4. Guaranty',
      'Signer agrees to be personally guarantor of all obligations.',
    ]),
  ]);
}

describe('golden fixtures', () => {
  it('residential lease: fires the expected rule ids', async () => {
    const doc = await parseLease(await residentialLease());
    const ids = new Set(analyze(doc, RULE_PACK_V1).map((f) => f.ruleId));
    expect(ids).toContain('late-fees');
    expect(ids).toContain('auto-renewal');
    expect(ids).toContain('assignment-subletting');
    expect(ids).toContain('attorney-fees');
    expect(ids).toContain('arbitration');
    expect(ids).toContain('jury-waiver');
  });

  it('commercial lease: fires the expected rule ids', async () => {
    const doc = await parseLease(await commercialLease());
    const ids = new Set(analyze(doc, RULE_PACK_V1).map((f) => f.ruleId));
    expect(ids).toContain('rent-escalation');
    expect(ids).toContain('early-termination-fee');
    expect(ids).toContain('indemnification');
    expect(ids).toContain('personal-guaranty');
  });

  it('residential lease does not trigger rules unique to commercial', async () => {
    const doc = await parseLease(await residentialLease());
    const ids = new Set(analyze(doc, RULE_PACK_V1).map((f) => f.ruleId));
    expect(ids.has('personal-guaranty')).toBe(false);
    expect(ids.has('rent-escalation')).toBe(false);
  });

  it('commercial-table lease: same commercial rules fire across rent-schedule + escalator-grid pages', async () => {
    const doc = await parseLease(await makeCommercialTableLease());
    const ids = new Set(analyze(doc, RULE_PACK_V1).map((f) => f.ruleId));
    // The four commercial-only ids fire on prose AND survive a multi-page
    // body whose 2nd and 3rd pages are tables. (Regression guard: a parser
    // change that drops table cells from the document body would silently
    // demote rent-escalation back to "prose only".)
    expect(ids).toContain('rent-escalation');
    expect(ids).toContain('early-termination-fee');
    expect(ids).toContain('indemnification');
    expect(ids).toContain('personal-guaranty');
    // Same not-in-residential invariant as the textual fixture.
    const residentialIds = new Set(
      analyze(await parseLease(await residentialLease()), RULE_PACK_V1).map((f) => f.ruleId),
    );
    expect(residentialIds.has('rent-escalation')).toBe(false);
    expect(residentialIds.has('early-termination-fee')).toBe(false);
    expect(residentialIds.has('personal-guaranty')).toBe(false);
  });
});

// Wave 29 Part A — Phase 8 closeout. Single fixture exercising tables +
// definitions + cross-references simultaneously. Test is the deliverable;
// no parser/facts/rules code changes accompany it.
describe('commercial-full golden fixture (tables + definitions + cross-refs)', () => {
  it('parser emits ≥1 Table from the rent-schedule region', async () => {
    const doc = await parseLease(await buildCommercialFullPdf());
    const tables = detectTables(doc.pages);
    expect(tables.length).toBeGreaterThanOrEqual(1);
  });

  it('extractLeaseFacts returns a non-empty rentSchedule with correct from/to/amount', async () => {
    const doc = await parseLease(await buildCommercialFullPdf());
    const facts = extractLeaseFacts(doc);
    expect(facts.rentSchedule).toBeDefined();
    expect(facts.rentSchedule?.length).toBeGreaterThan(0);
    const first = facts.rentSchedule?.[0];
    expect(first?.from).toBe('2026-01-01');
    expect(first?.to).toBe('2026-12-31');
    expect(first?.amount).toBe(10000);
  });

  it('definitions length ≥ 3 with expected term/definition pairs', async () => {
    const doc = await parseLease(await buildCommercialFullPdf());
    const facts = extractLeaseFacts(doc);
    expect(facts.definitions.length).toBeGreaterThanOrEqual(3);
    const terms = facts.definitions.map((d) => d.term);
    expect(terms).toContain('Premises');
    expect(terms).toContain('Landlord');
    expect(terms).toContain('Tenant');
  });

  it('cross-references include section:Section 4.2 and exhibit:Exhibit B targets, and rules engine fires expected commercial ids', async () => {
    const doc = await parseLease(await buildCommercialFullPdf());
    const facts = extractLeaseFacts(doc);
    const targets = new Set(facts.crossReferences.map((r) => r.target));
    expect(targets.has('section:Section 4.2')).toBe(true);
    expect(targets.has('exhibit:Exhibit B')).toBe(true);

    const ids = new Set(analyze(doc, RULE_PACK_V1).map((f) => f.ruleId));
    expect(ids).toContain('rent-escalation');
    expect(ids).toContain('early-termination-fee');
    expect(ids).toContain('indemnification');
    expect(ids).toContain('personal-guaranty');
  });
});

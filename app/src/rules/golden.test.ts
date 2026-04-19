import { describe, it, expect } from 'vitest';
import { parseLease } from '../parser/parseLease';
import { makePdf, type PdfFixturePage } from '../parser/testFixtures';
import { analyze } from './analyze';
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
});

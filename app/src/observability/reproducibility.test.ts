import { describe, it, expect } from 'vitest';
import { parseLease } from '../parser/parseLease';
import { makePdf, type PdfFixturePage } from '../parser/testFixtures';
import { analyze } from '../rules/analyze';
import { RULE_PACK_V1 } from '../rules/packV1';

const residentialPages: PdfFixturePage[] = [
  {
    blocks: [
      { text: '1. Rent', x: 72, y: 72, size: 14 },
      { text: 'Tenant shall pay $2,000 on the first of each month.', x: 72, y: 110 },
      { text: '2. Term', x: 72, y: 170, size: 14 },
      { text: 'This lease shall auto-renew for successive one-year terms.', x: 72, y: 200 },
      { text: '3. Deposit', x: 72, y: 260, size: 14 },
      { text: 'Landlord may retain the security deposit for cleaning and damages.', x: 72, y: 290 },
      { text: '4. Fees', x: 72, y: 350, size: 14 },
      { text: 'Prevailing party may recover attorney fees in any dispute.', x: 72, y: 380 },
    ],
  },
];

const commercialPages: PdfFixturePage[] = [
  {
    blocks: [
      { text: '1. Premises', x: 72, y: 72, size: 14 },
      { text: 'Tenant accepts the premises AS-IS with no representations.', x: 72, y: 110 },
      { text: '2. Rent and CAM', x: 72, y: 170, size: 14 },
      { text: 'Base rent plus pro-rata share of common area maintenance charges.', x: 72, y: 200 },
      { text: '3. Early Termination', x: 72, y: 260, size: 14 },
      { text: 'An early termination fee equal to three months rent applies.', x: 72, y: 290 },
      { text: '4. Renewal', x: 72, y: 350, size: 14 },
      { text: 'The term shall automatically renew unless terminated by notice.', x: 72, y: 380 },
    ],
  },
  {
    blocks: [
      { text: '5. Indemnification', x: 72, y: 72, size: 14 },
      { text: 'Tenant shall indemnify and hold landlord harmless from all claims.', x: 72, y: 110 },
      { text: '6. Jurisdiction', x: 72, y: 170, size: 14 },
      { text: 'Disputes shall be resolved exclusively in the courts of this state.', x: 72, y: 200 },
    ],
  },
];

const N = 3;

async function runOnce(pages: PdfFixturePage[]): Promise<string> {
  // Fresh bytes per run so the pdfjs transport layer can own the buffer.
  const bytes = await makePdf(pages);
  const doc = await parseLease(bytes);
  const findings = analyze(doc, RULE_PACK_V1);
  return JSON.stringify(findings);
}

async function nRuns(pages: PdfFixturePage[]): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < N; i++) {
    out.push(await runOnce(pages));
  }
  return out;
}

describe('analyze output is byte-reproducible', () => {
  it('produces byte-identical Finding[] JSON across N runs for a residential lease', async () => {
    const outputs = await nRuns(residentialPages);
    const first = outputs[0];
    expect(first).toBeTruthy();
    expect(JSON.parse(first ?? '[]').length).toBeGreaterThan(0);
    for (const o of outputs) {
      expect(o).toBe(first);
    }
  });

  it('produces byte-identical Finding[] JSON across N runs for a commercial lease', async () => {
    const outputs = await nRuns(commercialPages);
    const first = outputs[0];
    expect(first).toBeTruthy();
    expect(JSON.parse(first ?? '[]').length).toBeGreaterThan(0);
    for (const o of outputs) {
      expect(o).toBe(first);
    }
  });

  it('residential and commercial outputs differ from each other', async () => {
    const resOut = await runOnce(residentialPages);
    const comOut = await runOnce(commercialPages);
    expect(resOut).not.toBe(comOut);
  });
});

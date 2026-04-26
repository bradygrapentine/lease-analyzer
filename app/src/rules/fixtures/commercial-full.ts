import { makePdf, type PdfFixturePage } from '../../parser/testFixtures';

/**
 * Wave 29 Part A — commercial golden fixture.
 *
 * Closes the last open Phase 8 BACKLOG row by exercising tables +
 * definitions + cross-references in a single synthetic commercial
 * lease. Pinned counts:
 *
 *   - 3 pages (cover + Schedule 1 rent table + Exhibit B fee table)
 *   - 4-row rent schedule (Schedule 1) with 3% escalators
 *   - 4 defined terms ("Premises", "Landlord", "Tenant",
 *     "Operating Expenses") covering both `"X" shall mean Y` and
 *     `X means Y` phrasings
 *   - cross-references to `Section 4.2`, `Exhibit B`, `Schedule 1`
 *   - prose that fires the four commercial-only rule ids
 *     (`rent-escalation`, `early-termination-fee`, `indemnification`,
 *     `personal-guaranty`)
 *
 * The fixture is a pure pdf-lib synthesizer. No new parser/facts
 * code — assertions in `golden.test.ts` consume what the existing
 * pipeline already returns.
 */
export async function buildCommercialFullPdf(): Promise<Uint8Array> {
  const pages: PdfFixturePage[] = [
    // ---------- Page 1 — definitions, prose, cross-refs ----------
    {
      blocks: [
        { text: 'COMMERCIAL LEASE AGREEMENT', x: 72, y: 60 },

        // 1. Definitions
        { text: '1. Definitions', x: 72, y: 110 },
        {
          text: '"Premises" shall mean Suite 400 at 500 Elm Avenue, Springfield.',
          x: 72,
          y: 146,
        },
        { text: '"Landlord" shall mean Acme Holdings LLC.', x: 72, y: 164 },
        { text: '"Tenant" shall mean Beta Industries Inc.', x: 72, y: 182 },
        {
          text: 'Operating Expenses means the costs allocated under Exhibit B.',
          x: 72,
          y: 200,
        },

        // 2. Rent (rule: rent-escalation) + Schedule 1 cross-ref
        { text: '2. Rent', x: 72, y: 254 },
        {
          text: 'Base rent is $10,000 per month and shall increase by 3% per year.',
          x: 72,
          y: 290,
        },
        {
          text: 'The full rent schedule appears in Schedule 1 attached hereto.',
          x: 72,
          y: 308,
        },

        // 3. Termination (rule: early-termination-fee) + Section 4.2 + Exhibit B refs
        { text: '3. Termination', x: 72, y: 362 },
        {
          text: 'Early termination fee equals three months rent. See Section 4.2 and Exhibit B.',
          x: 72,
          y: 398,
        },

        // 4. Liability (rule: indemnification)
        { text: '4. Liability', x: 72, y: 452 },
        { text: 'Tenant shall indemnify landlord against all claims.', x: 72, y: 488 },

        // 5. Guaranty (rule: personal-guaranty)
        { text: '5. Guaranty', x: 72, y: 542 },
        { text: 'Signer agrees to be personally guarantor of all obligations.', x: 72, y: 578 },
      ],
    },

    // ---------- Page 2 — Schedule 1 rent table ----------
    {
      blocks: [
        { text: 'Schedule 1 — Rent Schedule', x: 72, y: 60 },
        { text: 'Pursuant to Section 2 above.', x: 72, y: 84 },
        // Header row
        { text: 'Period', x: 72, y: 132 },
        { text: 'Monthly Rent', x: 260, y: 132 },
        { text: 'Escalator', x: 440, y: 132 },
        // Row 1
        { text: '2026-01-01 to 2026-12-31', x: 72, y: 162 },
        { text: '$10,000.00', x: 260, y: 162 },
        { text: '3%', x: 440, y: 162 },
        // Row 2
        { text: '2027-01-01 to 2027-12-31', x: 72, y: 192 },
        { text: '$10,300.00', x: 260, y: 192 },
        { text: '3%', x: 440, y: 192 },
        // Row 3
        { text: '2028-01-01 to 2028-12-31', x: 72, y: 222 },
        { text: '$10,609.00', x: 260, y: 222 },
        { text: '3%', x: 440, y: 222 },
        // Row 4
        { text: '2029-01-01 to 2029-12-31', x: 72, y: 252 },
        { text: '$10,927.27', x: 260, y: 252 },
        { text: '3%', x: 440, y: 252 },
      ],
    },

    // ---------- Page 3 — Exhibit B termination-fee table ----------
    {
      blocks: [
        { text: 'Exhibit B — Termination Fees', x: 72, y: 60 },
        // Header
        { text: 'Year', x: 72, y: 132 },
        { text: 'Fee', x: 260, y: 132 },
        { text: 'Notice', x: 440, y: 132 },
        // Rows
        { text: 'Year 1', x: 72, y: 162 },
        { text: '$30,000', x: 260, y: 162 },
        { text: '90 days', x: 440, y: 162 },
        { text: 'Year 2', x: 72, y: 192 },
        { text: '$20,000', x: 260, y: 192 },
        { text: '60 days', x: 440, y: 192 },
        { text: 'Year 3', x: 72, y: 222 },
        { text: '$10,000', x: 260, y: 222 },
        { text: '30 days', x: 440, y: 222 },
      ],
    },
  ];
  return makePdf(pages);
}

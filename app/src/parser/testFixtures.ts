import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface PdfTextBlock {
  text: string;
  x?: number;
  y?: number;
  size?: number;
}

export interface PdfFixturePage {
  blocks: PdfTextBlock[];
  width?: number;
  height?: number;
}

export async function makePdf(
  pages: PdfFixturePage[],
  opts: { password?: string } = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const p of pages) {
    const page = doc.addPage([p.width ?? 612, p.height ?? 792]);
    const pageHeight = page.getHeight();
    for (const b of p.blocks) {
      const size = b.size ?? 12;
      page.drawText(b.text, {
        x: b.x ?? 72,
        y: pageHeight - (b.y ?? 72) - size,
        size,
        font,
        color: rgb(0, 0, 0),
      });
    }
  }
  if (opts.password !== undefined) {
    return doc.save({ useObjectStreams: false });
  }
  return doc.save();
}

/**
 * Multi-feature synthetic commercial lease used as the canonical golden
 * regression check. Embeds simultaneously:
 *
 *   - a 4-row rent schedule table (Schedule 1) with escalators
 *   - 6 defined terms via both `"X" shall mean Y` and `X means Y`
 *   - cross-references to Section 4, Exhibit A, Exhibit B, Schedule 1
 *   - prose that fires the commercial-only rule ids
 *     (rent-escalation, early-termination-fee, indemnification,
 *     personal-guaranty)
 *   - additional small tables on later pages so detectTables sees ≥3
 *
 * Pinned counts live in `src/golden/commercial.golden.test.ts`.
 */
export async function buildEnterpriseCommercialPdf(): Promise<Uint8Array> {
  return makePdf([
    // ---------- Page 1: definitions, prose, cross-refs ----------
    // Heading-after-body gap is 36pt (> fontSize 12 * 1.6 = 19.2) so each
    // heading lands as its own paragraph and detectSections sees it.
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
          text: 'Commencement Date means January 1, 2026 unless deferred under Section 4.',
          x: 72,
          y: 200,
        },
        { text: 'Base Rent means the monthly rent set forth in Schedule 1.', x: 72, y: 218 },
        {
          text: 'Operating Expenses means the costs allocated under Exhibit A.',
          x: 72,
          y: 236,
        },

        // 2. Term
        { text: '2. Term', x: 72, y: 290 },
        { text: 'The term shall commence on January 1, 2026.', x: 72, y: 326 },
        { text: 'This lease shall expire on December 31, 2029.', x: 72, y: 344 },

        // 3. Rent (rule: rent-escalation)
        { text: '3. Rent', x: 72, y: 398 },
        {
          text: 'Base rent is $10,000 per month and shall increase by 3% per year.',
          x: 72,
          y: 434,
        },
        {
          text: 'The full rent schedule appears in Schedule 1 attached hereto.',
          x: 72,
          y: 452,
        },

        // 4. Termination (rule: early-termination-fee) + cross-refs
        { text: '4. Termination', x: 72, y: 506 },
        {
          text: 'Early termination fee equals three months rent. See Section 4 and Exhibit B.',
          x: 72,
          y: 542,
        },

        // 5. Liability (rule: indemnification)
        { text: '5. Liability', x: 72, y: 596 },
        { text: 'Tenant shall indemnify landlord against all claims.', x: 72, y: 632 },

        // 6. Guaranty (rule: personal-guaranty)
        { text: '6. Guaranty', x: 72, y: 686 },
        { text: 'Signer agrees to be personally guarantor of all obligations.', x: 72, y: 722 },
      ],
    },

    // ---------- Page 2: Schedule 1 — 4-row rent schedule ----------
    {
      blocks: [
        { text: 'Schedule 1 — Rent Schedule', x: 72, y: 60 },
        { text: 'Pursuant to Section 3 above.', x: 72, y: 84 },
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

    // ---------- Page 3: Exhibit A operating-expense + Exhibit B fee tables ----------
    {
      blocks: [
        { text: 'Exhibit A — Operating Expenses', x: 72, y: 60 },
        // Header
        { text: 'Category', x: 72, y: 132 },
        { text: 'Annual Cap', x: 260, y: 132 },
        { text: 'Notes', x: 440, y: 132 },
        // Rows
        { text: 'CAM', x: 72, y: 162 },
        { text: '$50,000', x: 260, y: 162 },
        { text: 'gross', x: 440, y: 162 },
        { text: 'Insurance', x: 72, y: 192 },
        { text: '$15,000', x: 260, y: 192 },
        { text: 'pass-through', x: 440, y: 192 },
        { text: 'Taxes', x: 72, y: 222 },
        { text: '$25,000', x: 260, y: 222 },
        { text: 'pass-through', x: 440, y: 222 },

        // Exhibit B intentionally drawn with shifted column centroids so the
        // table detector emits it as a distinct second table rather than
        // greedily extending the Exhibit A window.
        { text: 'Exhibit B — Termination Fees', x: 90, y: 348 },
        // Header (note offset x positions vs Exhibit A)
        { text: 'Year', x: 110, y: 396 },
        { text: 'Fee', x: 300, y: 396 },
        { text: 'Notice', x: 480, y: 396 },
        // Rows
        { text: 'Year 1', x: 110, y: 426 },
        { text: '$30,000', x: 300, y: 426 },
        { text: '90 days', x: 480, y: 426 },
        { text: 'Year 2', x: 110, y: 456 },
        { text: '$20,000', x: 300, y: 456 },
        { text: '60 days', x: 480, y: 456 },
        { text: 'Year 3', x: 110, y: 486 },
        { text: '$10,000', x: 300, y: 486 },
        { text: '30 days', x: 480, y: 486 },
      ],
    },
  ]);
}

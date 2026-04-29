import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { type SideLetterInput } from '../negotiation/sideLetter';

interface Clause {
  label: string;
  after: string;
}

function buildClauses(input: SideLetterInput): Clause[] {
  const seen = new Set<number>();
  const clauses: Clause[] = [];
  for (const edit of input.edits) {
    if (seen.has(edit.paragraphIndex)) continue;
    seen.add(edit.paragraphIndex);
    const section = input.sectionFor(edit.paragraphIndex);
    const label = section ? `Section ${section}` : `Page N, ¶ ${edit.paragraphIndex + 1}`;
    clauses.push({ label, after: edit.after });
  }
  return clauses;
}

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 72;
const LINE_HEIGHT = 14;
const BODY_SIZE = 11;
const HEADING_SIZE = 18;
const META_SIZE = 10;
// DESIGN.md "No-Pure-Black Rule" — body text uses Ink Black (#2a2316), not rgb(0,0,0).
const INK_BLACK = rgb(42 / 255, 35 / 255, 22 / 255);

/**
 * Greedy word-wrap for a fixed-width column. pdf-lib has no built-in
 * wrapping, so we measure each word with the embedded font and break on
 * width overflow. Tabs and existing newlines are preserved as hard breaks.
 */
function wrap(
  text: string,
  font: import('pdf-lib').PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push('');
      continue;
    }
    let line = '';
    for (const w of words) {
      const candidate = line === '' ? w : `${line} ${w}`;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth) {
        if (line !== '') out.push(line);
        line = w;
      } else {
        line = candidate;
      }
    }
    if (line !== '') out.push(line);
  }
  return out;
}

/**
 * Deterministic byte output: pin the creation/modification date and the
 * "creator" / "producer" metadata so two calls with the same input yield
 * byte-identical PDFs (golden-test-friendly).
 */
const PINNED_DATE = new Date('2026-01-01T00:00:00.000Z');

export async function buildSideLetterPdf(input: SideLetterInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setCreator('LeaseGuard');
  doc.setProducer('LeaseGuard');
  doc.setTitle(`${input.leaseName} side letter`);
  doc.setCreationDate(PINNED_DATE);
  doc.setModificationDate(PINNED_DATE);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let cursorY = PAGE_H - MARGIN;
  const usableWidth = PAGE_W - MARGIN * 2;

  function ensureSpace(needed: number): void {
    if (cursorY - needed < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      cursorY = PAGE_H - MARGIN;
    }
  }

  function drawLine(text: string, opts: { font?: typeof font; size?: number } = {}): void {
    const f = opts.font ?? font;
    const size = opts.size ?? BODY_SIZE;
    ensureSpace(size + 2);
    page.drawText(text, {
      x: MARGIN,
      y: cursorY - size,
      size,
      font: f,
      color: INK_BLACK,
    });
    cursorY -= size + 4;
  }

  function drawWrapped(text: string, opts: { font?: typeof font; size?: number } = {}): void {
    const f = opts.font ?? font;
    const size = opts.size ?? BODY_SIZE;
    const lines = wrap(text, f, size, usableWidth);
    for (const ln of lines) {
      ensureSpace(LINE_HEIGHT);
      page.drawText(ln, {
        x: MARGIN,
        y: cursorY - size,
        size,
        font: f,
        color: INK_BLACK,
      });
      cursorY -= LINE_HEIGHT;
    }
  }

  drawLine('Side Letter', { font: bold, size: HEADING_SIZE });
  cursorY -= 6;
  const meta = input.leaseDate
    ? `Re: ${input.leaseName} (dated ${input.leaseDate})`
    : `Re: ${input.leaseName}`;
  drawLine(meta, { size: META_SIZE });
  cursorY -= 12;

  const clauses = buildClauses(input);
  if (clauses.length === 0) {
    drawWrapped('No changes to propose.');
  } else {
    clauses.forEach((c, i) => {
      drawLine(`${i + 1}. ${c.label}.`, { font: bold });
      drawWrapped(
        `The parties agree that the text of ${c.label} is amended to read: “${c.after}”.`,
      );
      cursorY -= 6;
    });
  }

  if (input.signer) {
    cursorY -= 24;
    drawLine('Sincerely,');
    drawLine(input.signer.name, { font: bold });
    if (input.signer.title) drawLine(input.signer.title, { size: META_SIZE });
  }

  return doc.save();
}

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

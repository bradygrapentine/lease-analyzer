// Synthesizes a "scanned" PDF whose page content is a single dark
// rectangle and zero text — i.e. nothing the parser can extract. The
// rectangle stands in for the rasterized image a real scanner would
// emit; `needsOcr` only cares about text-extractability, which is zero
// either way. Keeping it pure-vector avoids pulling a PNG encoder
// (sharp / node-canvas) into the dev toolchain and keeps the build
// step well under the 2 s threshold from the Wave 15 pre-flight, so
// no binary needs to be committed.

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFDocument, rgb } from 'pdf-lib';

/** @returns {Promise<Uint8Array>} */
export async function buildScannedFixturePdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  // Image-stand-in: a 200×60 dark-grey rectangle near the page top.
  // Visually mimics a "RESIDENTIAL LEASE" header bitmap; carries no
  // text characters that pdf.js could extract.
  page.drawRectangle({
    x: 72,
    y: 700,
    width: 200,
    height: 60,
    color: rgb(0.2, 0.2, 0.2),
  });
  return doc.save();
}

const isCli = process.argv[1] === fileURLToPath(import.meta.url);
if (isCli) {
  const out = process.argv[2];
  if (!out) {
    console.error('Usage: build-scanned-fixture.mjs <output-path>');
    process.exit(1);
  }
  const bytes = await buildScannedFixturePdf();
  await writeFile(out, bytes);
  console.log(`wrote ${bytes.byteLength} bytes to ${out}`);
}

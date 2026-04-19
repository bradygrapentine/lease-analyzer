import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, '../public/sample.pdf');

const LINES = [
  'SAMPLE RESIDENTIAL LEASE AGREEMENT',
  '',
  'Between Landlord Example LLC and Tenant Alex Sample.',
  '',
  '1. Rent',
  'Tenant shall pay $2,400 on the first of each month.',
  'A late fee of $75 applies after a five-day grace period.',
  '',
  '2. Term',
  'This lease shall automatically renew for successive one-year terms',
  'unless either party sends written notice at least sixty (60) days',
  'before the expiration date.',
  '',
  '3. Subletting',
  'Tenant shall not sublet the premises without the prior written',
  'consent of Landlord, which shall not be unreasonably withheld.',
  '',
  '4. Indemnification',
  'Tenant shall indemnify and hold harmless Landlord against all',
  'claims arising from Tenant\u2019s use of the premises.',
  '',
  '5. Disputes',
  'The prevailing party in any dispute may recover reasonable',
  'attorney fees and costs.',
  'All disputes shall be resolved by binding arbitration in the state',
  'of the premises. The parties hereby waive any right to a jury trial.',
];

async function main() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([612, 792]);
  const { height } = page.getSize();
  const margin = 64;
  const lineHeight = 18;
  let y = height - margin;
  for (const line of LINES) {
    const isHeading = /^\d+\./.test(line) || line === LINES[0];
    page.drawText(line, {
      x: margin,
      y,
      size: isHeading ? 13 : 11,
      font: isHeading ? bold : font,
      color: rgb(0, 0, 0),
    });
    y -= lineHeight;
  }
  const bytes = await doc.save();
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, bytes);
  console.log(`wrote ${outPath} (${bytes.byteLength} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

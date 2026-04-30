#!/usr/bin/env node
// Wave 53-A — validate that every font file referenced by index.css is
// (a) present in public/fonts/, (b) non-empty, (c) starts with the wOF2
// magic. Without this, a missing or stub font silently falls through
// font-display: swap to platform-serif fallbacks (Iowan / Georgia) and
// every typography decision in DESIGN.md is rendered through the wrong
// metrics.
//
// Caught during Wave 52: the dev server returned an HTML 404 page for
// /fonts/source-serif-4-{400,600}.woff2 because public/fonts/ contained
// only a .gitkeep. Browser parsed the HTML as a font and reported
// "OTS parsing error: invalid sfntVersion: 1008821359" (== '<!DO').
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, '..', 'public', 'fonts');

const REQUIRED = ['source-serif-4-400.woff2', 'source-serif-4-600.woff2'];
const WOF2_MAGIC = Buffer.from([0x77, 0x4f, 0x46, 0x32]); // 'wOF2'

const failures = [];
for (const name of REQUIRED) {
  const path = join(FONTS_DIR, name);
  if (!existsSync(path)) {
    failures.push(`${name}: missing`);
    continue;
  }
  const size = statSync(path).size;
  if (size === 0) {
    failures.push(`${name}: empty file`);
    continue;
  }
  const head = Buffer.alloc(4);
  const fd = readFileSync(path).subarray(0, 4);
  if (!fd.equals(WOF2_MAGIC)) {
    failures.push(`${name}: bad magic (${fd.toString('hex')}); not a woff2`);
    continue;
  }
  console.log(`  ${name} OK (${(size / 1024).toFixed(1)} KiB)`);
}

if (failures.length > 0) {
  console.error('\n[check-fonts] failed:');
  for (const f of failures) console.error('  ' + f);
  console.error('\nRun `npm run build:design-fonts` to fetch the woff2s.');
  process.exit(1);
}
console.log('[check-fonts] OK.');

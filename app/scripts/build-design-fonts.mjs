#!/usr/bin/env node
// Wave 27 — downloads Source Serif 4 (regular + semibold, Latin
// subset) into app/public/fonts/. OFL-licensed; NOTICE entry lives
// in app/public/NOTICE.
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEST = join(__dirname, '..', 'public', 'fonts');

const FILES = [
  // Source Serif 4 from Adobe's official OFL distribution on Github.
  // Latin subset (no Cyrillic / Greek) keeps each weight under ~50 KiB.
  {
    url: 'https://cdn.jsdelivr.net/fontsource/fonts/source-serif-4@5.2.9/latin-400-normal.woff2',
    name: 'source-serif-4-400.woff2',
  },
  {
    url: 'https://cdn.jsdelivr.net/fontsource/fonts/source-serif-4@5.2.9/latin-600-normal.woff2',
    name: 'source-serif-4-600.woff2',
  },
];

async function main() {
  await mkdir(DEST, { recursive: true });
  for (const { url, name } of FILES) {
    const dest = join(DEST, name);
    if (existsSync(dest) && statSync(dest).size > 0) {
      console.log(`  ${name} (already present)`);
      continue;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(dest, buf);
    console.log(`  ${name} (${(buf.byteLength / 1024).toFixed(1)} KiB)`);
  }
  console.log('[build-design-fonts] done.');
}

main().catch((err) => {
  console.error('[build-design-fonts] fatal:', err);
  process.exit(1);
});

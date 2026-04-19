#!/usr/bin/env node
// Fails the build if any dist/assets/*.js exceeds its budget.
//
// The budgets are tuned for the current shape of the app. Adjust intentionally
// if a legitimate dep bump pushes us over — don't silently raise to hide bloat.

import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ASSETS_DIR = 'dist/assets';
const TESSERACT_DIR = 'dist/tesseract';

const BUDGETS = [
  // Main app shell — everything that isn't pdf.js
  { pattern: /^index-.+\.js$/, maxBytes: 350_000, label: 'app shell' },
  // pdf.js API bundle (wrapper that loads the worker)
  { pattern: /^pdf-.+\.js$/, maxBytes: 600_000, label: 'pdf.js api' },
  // pdf.worker: the single biggest asset; precached offline
  { pattern: /^pdf\.worker-.+\.js$/, maxBytes: 1_800_000, label: 'pdf.worker' },
  // Phase 13 lease-analysis Web Worker. Isolates parseLease + analyze off
  // the main thread. No React / UI code should land here.
  { pattern: /^leaseWorker-.+\.js$/, maxBytes: 50_000, label: 'lease worker' },
];

// Same-origin tesseract runtime assets, served from /tesseract/. Tesseract
// is opt-in (Attempt OCR button), but the service worker precaches wasm/js
// to enable offline use. traineddata.gz is ~10MB when added.
const TESSERACT_BUDGETS = [
  { pattern: /^worker\.min\.js$/, maxBytes: 300_000, label: 'tesseract worker' },
  { pattern: /^tesseract-core\.wasm\.js$/, maxBytes: 5_000_000, label: 'tesseract core js' },
  { pattern: /^tesseract-core\.wasm$/, maxBytes: 4_000_000, label: 'tesseract core wasm' },
  { pattern: /^eng\.traineddata(\.gz)?$/, maxBytes: 15_000_000, label: 'tesseract-lang' },
];

function fmt(n) {
  return `${(n / 1024).toFixed(1)} KiB`;
}

async function main() {
  let entries;
  try {
    entries = await readdir(ASSETS_DIR);
  } catch {
    console.error(`No ${ASSETS_DIR}. Did you run "npm run build" first?`);
    process.exit(1);
  }

  const failures = [];
  const reported = new Set();

  for (const budget of BUDGETS) {
    const matches = entries.filter((e) => budget.pattern.test(e));
    if (matches.length === 0) {
      failures.push(`Missing expected bundle for "${budget.label}" (pattern ${budget.pattern})`);
      continue;
    }
    for (const name of matches) {
      reported.add(name);
      const info = await stat(join(ASSETS_DIR, name));
      const ok = info.size <= budget.maxBytes;
      const tag = ok ? 'ok' : 'OVER';
      console.log(
        `[${tag}] ${budget.label.padEnd(10)} ${name}  ${fmt(info.size)} / ${fmt(budget.maxBytes)}`,
      );
      if (!ok) {
        failures.push(
          `${budget.label} bundle ${name} is ${fmt(info.size)}, over budget ${fmt(budget.maxBytes)}`,
        );
      }
    }
  }

  // Report any unaccounted .js files so new chunks don't slip past us.
  const stray = entries.filter((e) => e.endsWith('.js') && !reported.has(e));
  if (stray.length > 0) {
    console.log(`note: unbudgeted .js files present: ${stray.join(', ')}`);
  }

  // Tesseract assets live in dist/tesseract/ (copied from node_modules and
  // public/tesseract/ via `build:tesseract-assets`). They're optional — only
  // warn, don't fail, if the directory is missing.
  let tessEntries = [];
  try {
    tessEntries = await readdir(TESSERACT_DIR);
  } catch {
    console.log(`note: ${TESSERACT_DIR} missing — OCR assets not built yet`);
  }
  for (const budget of TESSERACT_BUDGETS) {
    const matches = tessEntries.filter((e) => budget.pattern.test(e));
    for (const name of matches) {
      const info = await stat(join(TESSERACT_DIR, name));
      const ok = info.size <= budget.maxBytes;
      const tag = ok ? 'ok' : 'OVER';
      console.log(
        `[${tag}] ${budget.label.padEnd(20)} ${name}  ${fmt(info.size)} / ${fmt(budget.maxBytes)}`,
      );
      if (!ok) {
        failures.push(
          `${budget.label} asset ${name} is ${fmt(info.size)}, over budget ${fmt(budget.maxBytes)}`,
        );
      }
    }
  }

  if (failures.length > 0) {
    console.error('\nBundle budget failed:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log('\nBundle budget OK.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

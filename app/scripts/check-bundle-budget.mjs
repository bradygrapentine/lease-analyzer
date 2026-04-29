#!/usr/bin/env node
// Fails the build if any dist/assets/*.js exceeds its budget.
//
// The budgets are tuned for the current shape of the app. Adjust intentionally
// if a legitimate dep bump pushes us over — don't silently raise to hide bloat.

import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ASSETS_DIR = 'dist/assets';
const TESSERACT_DIR = 'dist/tesseract';
// Phase 18 classifier directory. Wave 20-C reserves it as part of the
// "OCR + classifier ≤ 30 MiB combined precache" contract. The directory
// stays empty until Wave 21+ ships the classifier; the combined cap
// passes trivially while empty and tightens automatically the moment
// the classifier lands.
const CLASSIFIER_DIR = 'dist/classifier';
// Combined precache cap (Tesseract assets + classifier). Wave 18-B
// recommended Xenova/paraphrase-MiniLM-L3-v2 at ~17.5 MiB; OCR
// language data (eng.traineddata.gz) is ~10 MiB; 30 MiB allows headroom
// for tokenizer + configs + small future updates without busting.
const COMBINED_PRECACHE_CAP = 30 * 1024 * 1024;

const BUDGETS = [
  // Main app shell — everything that isn't pdf.js. Bumped from 350_000
  // to 352_000 in Wave 30-B (accordion-persistence + tree-shake variance,
  // ~60 bytes), and again to 354_000 in Wave 32-C to absorb the
  // findClassifyEntry import + audit-entry-id readout in the
  // hybrid-finding disclosure. Future waves should lazy-load new
  // shell-bound UI to claw back headroom rather than nudging this number;
  // the next add will be a meaningful refactor, not a bump.
  { pattern: /^index-.+\.js$/, maxBytes: 354_000, label: 'app shell' },
  // pdf.js API bundle (wrapper that loads the worker)
  { pattern: /^pdf-.+\.js$/, maxBytes: 600_000, label: 'pdf.js api' },
  // pdf.worker: the single biggest asset; precached offline. Wave 50 follow-up
  // switched both call sites to `?url` imports, so Vite ships the raw .mjs
  // asset (≈2.3 MB unminified) rather than a minified chunk. Gzipped wire
  // size is unchanged; the budget tracks on-disk size so it bumps with the
  // extension change.
  { pattern: /^pdf\.worker-.+\.m?js$/, maxBytes: 2_400_000, label: 'pdf.worker' },
  // Phase 13 lease-analysis Web Worker. Isolates parseLease + analyze off
  // the main thread. No React / UI code should land here.
  { pattern: /^leaseWorker-.+\.js$/, maxBytes: 50_000, label: 'lease worker' },
  // Wave 36 Part A — Phase 18 transformers runtime chunk. Pattern
  // matches both v2 (`transformers-*.js`, ~827 KiB) and v4
  // (`transformers.web-*.js`, ~568 KiB) so the budget covers the
  // dual-runtime window. Wave 36 Part C tightens to v4-only after
  // v2 is excised.
  { pattern: /^transformers(\.web)?-.+\.js$/, maxBytes: 900_000, label: 'transformers' },
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
  let tessTotalBytes = 0;
  for (const budget of TESSERACT_BUDGETS) {
    const matches = tessEntries.filter((e) => budget.pattern.test(e));
    for (const name of matches) {
      const info = await stat(join(TESSERACT_DIR, name));
      tessTotalBytes += info.size;
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

  // Phase 18 classifier (lazy-loaded, precached). Sum every byte
  // recursively under dist/classifier/ if present. Wave 23-A's
  // build:classifier-assets script writes onnx/model_quantized.onnx
  // into a subdirectory, so a non-recursive walk would under-count.
  //
  // Wave 39: skip `onnx-runtime-v4/`. Wave 36-B stages ~75 MiB of ORT
  // `.wasm`/`.mjs` glue under `dist/classifier/onnx-runtime-v4/` for
  // same-origin on-demand fetch, but `vite.config.ts` `globIgnores`
  // explicitly excludes that subtree from the PWA precache. The cap
  // here is the *precache* contract from Wave 18-B; counting
  // non-precached bytes against it produces a false-fail on machines
  // that have classifier assets on disk (101 MiB / 30 MiB) and is
  // semantically wrong. Walk skips the directory by name.
  const PRECACHE_SKIP = new Set(['onnx-runtime-v4']);
  async function walkBytes(dir) {
    let total = 0;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return 0;
    }
    for (const e of entries) {
      if (e.isDirectory() && PRECACHE_SKIP.has(e.name)) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) total += await walkBytes(p);
      else if (e.isFile()) total += (await stat(p)).size;
    }
    return total;
  }
  const classifierTotalBytes = await walkBytes(CLASSIFIER_DIR);

  // Combined OCR + classifier precache cap. The contract from Wave 18-B's
  // model selection: "OCR + classifier ≤ 30 MiB combined precache." Trivially
  // passes while the classifier directory is empty; tightens automatically
  // when Wave 21+ adds model files.
  const combinedTotal = tessTotalBytes + classifierTotalBytes;
  const combinedTag = combinedTotal <= COMBINED_PRECACHE_CAP ? 'ok' : 'OVER';
  console.log(
    `[${combinedTag}] OCR + classifier  combined  ${fmt(combinedTotal)} / ${fmt(COMBINED_PRECACHE_CAP)}`,
  );
  if (combinedTotal > COMBINED_PRECACHE_CAP) {
    failures.push(
      `OCR + classifier combined precache is ${fmt(combinedTotal)}, over the 30 MiB Phase 18 cap`,
    );
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

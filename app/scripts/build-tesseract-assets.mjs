#!/usr/bin/env node
// Copies tesseract.js runtime assets into public/tesseract/ so the browser
// can load them from same-origin (our CSP is `default-src 'self'` and blocks
// the default jsdelivr CDN). The `eng.traineddata.gz` language data is not
// in node_modules; it must be placed in public/tesseract/ manually (see
// docs/SYSTEM_DESIGN.md). We do NOT download at install time — that would
// violate the no-CDN contract for CI builds.
//
// Source locations:
//   node_modules/tesseract.js/dist/worker.min.js          -> public/tesseract/worker.min.js
//   node_modules/tesseract.js-core/tesseract-core.wasm.js -> public/tesseract/tesseract-core.wasm.js
//   node_modules/tesseract.js-core/tesseract-core.wasm    -> public/tesseract/tesseract-core.wasm

import { copyFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, '..');
const DEST = join(APP_ROOT, 'public', 'tesseract');

const FILES = [
  {
    from: join(APP_ROOT, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js'),
    to: join(DEST, 'worker.min.js'),
  },
  {
    from: join(APP_ROOT, 'node_modules', 'tesseract.js-core', 'tesseract-core.wasm.js'),
    to: join(DEST, 'tesseract-core.wasm.js'),
  },
  {
    from: join(APP_ROOT, 'node_modules', 'tesseract.js-core', 'tesseract-core.wasm'),
    to: join(DEST, 'tesseract-core.wasm'),
  },
];

async function main() {
  await mkdir(DEST, { recursive: true });
  const results = [];
  for (const f of FILES) {
    if (!existsSync(f.from)) {
      console.warn(`[tesseract-assets] SKIP: source missing ${f.from}`);
      continue;
    }
    await copyFile(f.from, f.to);
    const s = await stat(f.to);
    results.push({ path: f.to, bytes: s.size });
    console.log(`[tesseract-assets] ${f.to} (${(s.size / 1024).toFixed(1)} KiB)`);
  }
  const lang = join(DEST, 'eng.traineddata.gz');
  if (!existsSync(lang)) {
    console.warn(
      `[tesseract-assets] NOTE: ${lang} not present. Download once from ` +
        `https://github.com/tesseract-ocr/tessdata_fast (or tessdata_best for the .gz variant) ` +
        `and place it in public/tesseract/. OCR will not function until this file exists.`,
    );
  }
  console.log(`[tesseract-assets] copied ${results.length} file(s) to ${DEST}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

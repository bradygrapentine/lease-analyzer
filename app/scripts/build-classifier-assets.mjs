#!/usr/bin/env node
// Phase 18 (Wave 23-A) — downloads the on-device classifier model files
// into app/public/classifier/ so they're served same-origin (CSP requires
// it) and so vite-plugin-pwa precaches them via Workbox at build time.
//
// We do NOT auto-run on `npm install` — the model is ~17.5 MiB and CI
// builds that don't need the classifier shouldn't pay the fetch cost.
// Mirrors the Tesseract precedent: manual `npm run build:classifier-assets`,
// idempotent (skips files already on disk with the right size).
//
// Default model: Xenova/paraphrase-MiniLM-L3-v2 (Wave 18-B's pick;
// see app/src/llm/loadClassifier.ts DEFAULT_MODEL_ID).
//
// Source: huggingface.co/Xenova/paraphrase-MiniLM-L3-v2/resolve/main/<file>.

import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exit } from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, '..');
const MODEL_REPO = 'Xenova/paraphrase-MiniLM-L3-v2';
// Files are nested under <classifier>/<modelId>/ so transformers.js can
// load them with `env.localModelPath = '/classifier/'` + the unchanged
// model id (see app/src/llm/loadClassifier.ts). The runtime constructs
// URLs as `${localModelPath}${modelId}/${file}`.
const DEST = join(APP_ROOT, 'public', 'classifier', MODEL_REPO);
// v4's ORT (onnxruntime-web 1.19+) ships only threaded SIMD variants.
// Stage them same-origin so v4's loader resolves
// `wasmPaths = '/classifier/onnx-runtime-v4/'` against our CSP
// `connect-src 'self'`. The `.mjs` glue is the entrypoint the runtime
// imports; it locates the `.wasm` next to itself.
const ORT_V4_DEST = join(APP_ROOT, 'public', 'classifier', 'onnx-runtime-v4');
const ORT_V4_SOURCE_DIR = join(
  APP_ROOT,
  'node_modules',
  '@huggingface',
  'transformers',
  'node_modules',
  'onnxruntime-web',
  'dist',
);
// ORT 1.19 ships four `.wasm`/`.mjs` pairs. Its loader picks one at
// runtime based on capability detection (asyncify is the fallback when
// neither JSPI nor SAB is available — Chromium without COOP/COEP). We
// stage all four so whichever it picks resolves same-origin.
const ORT_V4_FILES = [
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
  'ort-wasm-simd-threaded.jspi.wasm',
  'ort-wasm-simd-threaded.jspi.mjs',
];


const HF_BASE = `https://huggingface.co/${MODEL_REPO}/resolve/main`;

// Match transformers.js's runtime fetch list. Files that 404 on a given
// repo are silently skipped.
const FILES = [
  'onnx/model_quantized.onnx',
  'tokenizer.json',
  'tokenizer_config.json',
  'config.json',
  'vocab.txt',
  'special_tokens_map.json',
];

const KB = 1024;
const MB = 1024 * 1024;

function fmt(n) {
  if (n >= MB) return `${(n / MB).toFixed(2)} MiB`;
  if (n >= KB) return `${(n / KB).toFixed(1)} KiB`;
  return `${n} B`;
}

async function ensureFile(relPath) {
  const url = `${HF_BASE}/${relPath}`;
  const dest = join(DEST, relPath);
  await mkdir(dirname(dest), { recursive: true });

  // Idempotent: skip if a file is already on disk with non-zero size.
  // The exact-byte check would require a HEAD request; for a one-time
  // drop, "exists with non-zero size" is good enough.
  if (existsSync(dest) && statSync(dest).size > 0) {
    return { url, relPath, size: statSync(dest).size, skipped: true };
  }

  const res = await fetch(url, { redirect: 'follow' });
  if (res.status === 404) {
    return { url, relPath, size: 0, missing: true };
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return { url, relPath, size: buf.byteLength };
}

async function main() {
  console.log(`[build-classifier-assets] model: ${MODEL_REPO}`);
  console.log(`[build-classifier-assets] dest:  ${DEST}`);
  console.log('');

  const results = [];
  let total = 0;
  let failed = 0;

  for (const rel of FILES) {
    process.stdout.write(`  ${rel.padEnd(36, ' ')} `);
    try {
      const r = await ensureFile(rel);
      results.push(r);
      if (r.missing) {
        console.log('MISSING (404, skipped)');
      } else {
        total += r.size;
        console.log(`${fmt(r.size)}${r.skipped ? ' (already present)' : ''}`);
      }
    } catch (err) {
      failed += 1;
      console.log(`FAILED (${err instanceof Error ? err.message : String(err)})`);
    }
  }

  // Stage v4 ORT WASM + glue under onnx-runtime-v4/.
  await mkdir(ORT_V4_DEST, { recursive: true });
  for (const name of ORT_V4_FILES) {
    const src = join(ORT_V4_SOURCE_DIR, name);
    const dst = join(ORT_V4_DEST, name);
    const label = `  ${name.padEnd(36, ' ')} `;
    if (existsSync(dst) && statSync(dst).size > 0) {
      console.log(`${label}${fmt(statSync(dst).size)} (already present)`);
      continue;
    }
    if (!existsSync(src)) {
      console.error(`${label}FAILED (${src} not found — run npm install)`);
      failed += 1;
      continue;
    }
    await copyFile(src, dst);
    console.log(`${label}${fmt(statSync(dst).size)}`);
    total += statSync(dst).size;
  }

  console.log('');
  console.log(`Total bytes for present files: ${fmt(total)}`);

  if (failed > 0) {
    console.error(`\n[build-classifier-assets] ${failed} file(s) failed to download.`);
    exit(2);
  }
  console.log('[build-classifier-assets] done.');
}

main().catch((err) => {
  console.error('[build-classifier-assets] fatal:', err);
  exit(1);
});

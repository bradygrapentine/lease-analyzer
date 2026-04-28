// Wave 20 Part C / Wave 36 Part A — Phase 18 lazy-loader.
//
// Wave 36 added a dual-runtime branch. The legacy `@xenova/transformers`
// path remains the default; setting the URL flag `?transformersV4=on`
// switches to `@huggingface/transformers@4`, the official upstream
// successor. The branch lives at the dynamic-import boundary so the
// inactive runtime never enters the user's bundle. Wave 36 Part C
// removes the v2 branch after Part B's smoke walk validates the flip.
//
// The v4 spike (Part 0) found two API divergences from v2 that this
// loader has to handle: (1) v4's default `dtype` is fp32, so it would
// look for `onnx/model.onnx` — passing `dtype: 'q8'` redirects it to
// the existing `onnx/model_quantized.onnx` weights; (2) v4 typings
// make `env.backends.onnx.wasm` possibly undefined, requiring an
// existence guard.
//
// Local-only contract: the downloader (`npm run build:classifier-assets`)
// places the model under `app/public/classifier/<modelId>/`, so the
// served path is `/classifier/Xenova/paraphrase-MiniLM-L3-v2/<file>`.
// `env.localModelPath = '/classifier/'` plus `env.allowRemoteModels =
// false` ensures transformers reads from same-origin (CSP requires it)
// and never silently degrades to a huggingface.co fetch when the
// weights are missing — a missing-asset error surfaces immediately
// and the upload-path fallback (Wave 24-A) catches it cleanly.

/** Embedding output: a fixed-length vector per input string. */
export interface EmbedFunction {
  (texts: string[]): Promise<Float32Array[]>;
}

/**
 * Phase 18 default: `Xenova/paraphrase-MiniLM-L3-v2` (chosen in Wave
 * 18-B; ~17.5 MiB int8). The string survives the v2→v4 migration —
 * v4 resolves the same id against `localModelPath` and reads the same
 * weights. Pre-Wave-36 audit entries already carry this in
 * `evidence.modelId`; keeping it preserves audit-chain continuity.
 */
export const DEFAULT_MODEL_ID = 'Xenova/paraphrase-MiniLM-L3-v2';

let cached: Promise<EmbedFunction> | null = null;

/** Wave 36 — read the runtime-selection URL flag. */
export function readRuntimeFlag(): 'v2' | 'v4' {
  if (typeof window === 'undefined') return 'v2';
  const search = window.location?.search ?? '';
  const params = new URLSearchParams(search);
  return params.get('transformersV4') === 'on' ? 'v4' : 'v2';
}

async function loadV2Pipeline(modelId: string): Promise<EmbedFunction> {
  const transformers = await import('@xenova/transformers');
  transformers.env.localModelPath = '/classifier/';
  transformers.env.allowRemoteModels = false;
  // Self-host the ONNX Runtime WASM so the classifier never reaches
  // out to a CDN (the default `wasmPaths` is jsdelivr — blocked by
  // the app's `connect-src 'self'` CSP). Single-thread SIMD: the
  // threaded variants need SharedArrayBuffer (COOP/COEP), which the
  // app doesn't enable.
  transformers.env.backends.onnx.wasm.wasmPaths = '/classifier/onnx-runtime/';
  transformers.env.backends.onnx.wasm.numThreads = 1;
  const pipeline = transformers.pipeline as (task: string, model: string) => Promise<unknown>;
  const extractor = (await pipeline('feature-extraction', modelId)) as (
    input: string | string[],
    opts?: { pooling?: string; normalize?: boolean },
  ) => Promise<{ data: Float32Array }>;
  return async (texts: string[]) => {
    const out: Float32Array[] = [];
    for (const t of texts) {
      const r = await extractor(t, { pooling: 'mean', normalize: true });
      out.push(r.data);
    }
    return out;
  };
}

async function loadV4Pipeline(modelId: string): Promise<EmbedFunction> {
  const transformers = await import('@huggingface/transformers');
  transformers.env.localModelPath = '/classifier/';
  transformers.env.allowRemoteModels = false;
  // v4 self-hosts ORT WASM via Vite asset emission (dist/assets/
  // ort-wasm-*.wasm). `wasmPaths` is left unset so v4's runtime
  // resolves the file via `import.meta.url`, which Vite rewrites to
  // the hashed asset path at build time. Per the Part 0 spike, ORT
  // 1.26 ships only threaded WASM variants but degrades to
  // single-thread when `SharedArrayBuffer` is unavailable (the
  // COOP/COEP-not-set case). `numThreads = 1` reinforces that.
  const wasmEnv = transformers.env.backends.onnx.wasm;
  if (wasmEnv) {
    wasmEnv.numThreads = 1;
  }
  const pipeline = transformers.pipeline as (
    task: string,
    model: string,
    opts?: { dtype?: string },
  ) => Promise<unknown>;
  // `dtype: 'q8'` tells v4 to load `model_quantized.onnx` (the int8
  // weights we ship). Without it, v4 defaults to fp32 and looks for
  // `model.onnx`, which we don't ship.
  const extractor = (await pipeline('feature-extraction', modelId, {
    dtype: 'q8',
  })) as (
    input: string | string[],
    opts?: { pooling?: string; normalize?: boolean },
  ) => Promise<{ data: Float32Array }>;
  return async (texts: string[]) => {
    const out: Float32Array[] = [];
    for (const t of texts) {
      const r = await extractor(t, { pooling: 'mean', normalize: true });
      out.push(r.data);
    }
    return out;
  };
}

/**
 * Load (or return cached) the on-device classifier. Branches on the
 * Wave 36 `?transformersV4=on` URL flag at the dynamic-import boundary.
 */
export function loadClassifier(modelId: string = DEFAULT_MODEL_ID): Promise<EmbedFunction> {
  if (cached) return cached;
  cached = readRuntimeFlag() === 'v4'
    ? loadV4Pipeline(modelId)
    : loadV2Pipeline(modelId);
  return cached;
}

/** Test-only: clear the lazy-import cache so the next call re-imports. */
export function _resetClassifierCacheForTests(): void {
  cached = null;
}

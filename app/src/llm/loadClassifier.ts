// Wave 20 Part C / Wave 36 — Phase 18 lazy-loader.
//
// Runtime: `@huggingface/transformers@4`. Two API quirks this loader
// has to handle: (1) v4's default `dtype` is fp32, so it would look
// for `onnx/model.onnx` — passing `dtype: 'q8'` redirects it to the
// existing `onnx/model_quantized.onnx` weights; (2) v4 typings make
// `env.backends.onnx.wasm` possibly undefined, requiring an existence
// guard.
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

async function loadV4Pipeline(modelId: string): Promise<EmbedFunction> {
  const transformers = await import('@huggingface/transformers');
  transformers.env.localModelPath = '/classifier/';
  // v4 requires `allowLocalModels` to be explicitly true when
  // `allowRemoteModels` is false; v2 defaulted to true. Without this,
  // v4's PretrainedModel.from_pretrained throws "both local and remote
  // models are disabled" before reaching the loader.
  transformers.env.allowLocalModels = true;
  transformers.env.allowRemoteModels = false;
  // Self-host v4 ORT WASM same-origin under `/classifier/onnx-runtime-v4/`.
  // With `wasmPaths` unset, v4's runtime resolves the `.wasm` via
  // `import.meta.url` from the bundled `.mjs` glue and falls back to a
  // jsdelivr CDN fetch for sibling files — both paths are blocked by
  // the app's CSP (`connect-src 'self'`). `build:classifier-assets`
  // copies `ort-wasm-simd-threaded.{wasm,mjs}` (and variants) from
  // `node_modules/@huggingface/transformers/node_modules/onnxruntime-web/dist/`.
  // ORT 1.19 ships only threaded variants but degrades to single-thread
  // when `SharedArrayBuffer` is unavailable (no COOP/COEP); `numThreads = 1`
  // reinforces that.
  const wasmEnv = transformers.env.backends.onnx.wasm;
  if (wasmEnv) {
    wasmEnv.wasmPaths = '/classifier/onnx-runtime-v4/';
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

/** Load (or return cached) the on-device classifier. */
export function loadClassifier(modelId: string = DEFAULT_MODEL_ID): Promise<EmbedFunction> {
  if (cached) return cached;
  cached = loadV4Pipeline(modelId);
  return cached;
}

/** Test-only: clear the lazy-import cache so the next call re-imports. */
export function _resetClassifierCacheForTests(): void {
  cached = null;
}

// Wave 20 Part C — Phase 18 lazy-loader stub. Lays the runtime
// boundary that Wave 21+'s hybrid analyze() path will wire to. No
// production caller in Wave 20; the function exists, its dynamic
// import is pinned by tests, and the bundle-budget gate enforces
// "OCR + classifier ≤ 30 MiB precache" so the integration can't
// silently bust the contract.
//
// Why a stub now? Two reasons:
//   1. Pinning @xenova/transformers as a dep here lets Wave 21 land
//      the integration without also hand-shaking a new package.json
//      change.
//   2. The "lazy import is the only consumer of @xenova/transformers"
//      contract is subtly hard to enforce after the fact — once one
//      module statically imports it, the whole runtime lands in the
//      app shell. Establishing the lazy boundary now means the test
//      file is the canonical home for it.

/** Embedding output: a fixed-length vector per input string. */
export interface EmbedFunction {
  (texts: string[]): Promise<Float32Array[]>;
}

/**
 * Phase 18 default: `Xenova/paraphrase-MiniLM-L3-v2` (chosen in Wave
 * 18-B; ~17.5 MiB int8). Wave 21+ wires this to the actual hybrid
 * analyze() path; for now it's the model id this stub will return.
 */
export const DEFAULT_MODEL_ID = 'Xenova/paraphrase-MiniLM-L3-v2';

let cached: Promise<EmbedFunction> | null = null;

/**
 * Load (or return cached) the on-device classifier. Dynamic-imports
 * @xenova/transformers so the runtime stays out of the app shell.
 *
 * Local-only contract: the downloader (`npm run build:classifier-assets`)
 * places the model under `app/public/classifier/<modelId>/`, so the
 * served path is `/classifier/Xenova/paraphrase-MiniLM-L3-v2/<file>`.
 * Setting `env.localModelPath = '/classifier/'` and disabling remote
 * fallback ensures transformers reads from same-origin (CSP requires
 * it) and never silently degrades to a huggingface.co fetch when the
 * weights are missing — a missing-asset error surfaces immediately
 * and the upload-path fallback (Wave 24-A) catches it cleanly.
 */
export function loadClassifier(modelId: string = DEFAULT_MODEL_ID): Promise<EmbedFunction> {
  if (cached) return cached;
  cached = (async () => {
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
  })();
  return cached;
}

/** Test-only: clear the lazy-import cache so the next call re-imports. */
export function _resetClassifierCacheForTests(): void {
  cached = null;
}

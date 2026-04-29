/// <reference types="vitest" />
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Phase 13: dedicated Web Worker at src/worker/leaseWorker.ts is imported
  // via `new Worker(new URL(...), { type: 'module' })`. Use ES output so
  // the worker chunk can participate in code-splitting (iife — the Vite
  // default for workers — cannot).
  worker: { format: 'es' },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // The added `onnx`, `txt`, and `json` extensions cover the Phase 18
        // classifier assets dropped by `npm run build:classifier-assets`
        // into public/classifier/. The bumped 18 MiB per-file cap fits the
        // int8-quantized MiniLM-L3 weights (~17.5 MiB); the previous 5 MiB
        // cap excluded them.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm,mjs,onnx,txt,json}'],
        // ONNX Runtime WASM is intentionally NOT precached: it would
        // push the precache past its 30 MiB budget, and racing the
        // precache write with transformers' direct fetch throws
        // ERR_CACHE_WRITE_FAILURE in fresh profiles. It's still served
        // same-origin (CSP requires it) — just on-demand, not up-front.
        // v4 ships four `.wasm`/`.mjs` pairs and picks one at runtime
        // by capability detection; we stage all four same-origin and
        // let it resolve `wasmPaths` against `/classifier/onnx-runtime-v4/`.
        // Some variants exceed Workbox's 18 MiB per-file cap anyway
        // (jsep ~26 MiB), which forces the on-demand-fetch contract.
        globIgnores: [
          'classifier/onnx-runtime-v4/**',
          // Vite emits hashed copies of v4's ORT `.wasm` glue under
          // dist/assets/ (asyncify variant ~23 MB exceeds the 18 MiB
          // per-file cap). Keep them out of precache; they're served
          // on-demand same-origin.
          'assets/ort-wasm-*',
        ],
        maximumFileSizeToCacheInBytes: 18 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
      manifest: {
        name: 'LeaseGuard',
        short_name: 'LeaseGuard',
        description: 'Private, local-first lease analyzer.',
        theme_color: '#111111',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.bench.test.{ts,tsx}',
        'src/**/*.stories.{ts,tsx}',
        'src/**/index.ts', // barrel re-exports
        'src/test/**',
        'src/main.tsx',
        'src/parser/env.d.ts',
        'src/parser/testFixtures.ts',
        // Phase 13 Web Worker entry. Pure self.onmessage binding; the logic
        // is in handleRequest.ts which is fully covered. jsdom doesn't
        // execute worker entries so any coverage here is unreachable.
        'src/worker/leaseWorker.ts',
      ],
      thresholds: {
        // Raised 2026-04-26 (Wave 24-C) after surgical removal of
        // unreachable defensive guards in `hybridAnalyze.ts` (loop-
        // bounded indexed accesses no longer pay v8's `?? 0` / `?? ''`
        // branch tax). Actuals sat at 97.27 / 89.61 / 93.71 / 97.27;
        // the +1 branch bump (88 → 89) was the honest ceiling absent
        // either (a) decomposing App.tsx further or (b) another guard
        // sweep on remaining `noUncheckedIndexedAccess` artifacts.
        //
        // Raised 2026-04-27 (Wave 31-C) after targeted tests on
        // useColorScheme, loadGlossary, and useReviewMode uncovered
        // meaningful error-path and fallback branches. Actuals landed
        // at 97.52 / 90.21 / 94.26 / 97.52; branches cleared the 90.2
        // threshold so the floor steps up 89 → 90.
        //
        // Ratcheted 2026-04-28 (Wave 43) per the measure→ratchet plan.
        // Actuals: 97.56 / 90.29 / 94.27 / 97.56. New floor =
        // floor(actual) - 1, clamped never to decrease. Branches
        // headroom is 0.29 (< 2-pt margin per plan §4) so the branch
        // floor holds at 90; the other three step up. Limiter files
        // for any future branch push: src/worker/handleRequest.ts
        // (71.42), src/parser/customRuleDraft.ts (79.41), and
        // src/ui/renderPdfPages.ts (77.77).
        statements: 96,
        branches: 90,
        functions: 93,
        lines: 96,
      },
    },
  },
});

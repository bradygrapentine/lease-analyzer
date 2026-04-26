# Setup

Onboarding for a fresh clone. macOS / Linux. Windows works under WSL2;
native Windows is not actively tested.

## Prerequisites

- Node.js **20.x** (latest LTS line). Earlier 18.x works for the
  application but the Playwright runner expects 20+.
- npm 10.x (ships with Node 20).
- Optional: `eng.traineddata.gz` for OCR (one-time manual drop, see
  below).

## First-time setup

```bash
git clone https://github.com/bradygrapentine/lease-analyzer
cd lease-analyzer

# Repo-root install — wires the husky pre-commit hook + Playwright runner.
npm install

# App install — pulls vite, vitest, pdf.js, tesseract.js, etc.
cd app
npm install

# Optional: install Playwright browsers for local e2e (chromium + firefox + webkit).
# Only needed if you plan to run `npm run e2e`.
cd ..
npm run e2e:install
```

The repo-root `npm install` is **not optional**. It installs husky and
lint-staged so the pre-commit hook runs `eslint --fix` + `prettier
--write` on every commit. CI is still authoritative; the hook is a fast
local feedback loop.

## Day-to-day commands

All run from `app/`:

```bash
npm run dev            # Vite dev server on http://localhost:5173
npm run typecheck      # tsc -b --noEmit (strict)
npm run lint           # eslint (0 warnings expected)
npm run test           # vitest run
npm run test:coverage  # vitest with v8 coverage + thresholds (CI gate)
npm run build          # Production build → dist/ + sw.js + leaseWorker chunk
npm run preview        # Serve the production build (used by Playwright e2e)
npm run check:budget   # Bundle-size budget gate
npm run storybook      # Panel previews on http://localhost:6006
```

From the repo root:

```bash
npm run e2e            # Playwright matrix (chromium + firefox + webkit)
```

The `app/` workspace is the application. The repo root is the Playwright
e2e runner + git hooks. There is **no** server.

## Tesseract / OCR (optional)

OCR is opt-in. The runtime (`tesseract.js`) is bundled and lazy-loaded;
the language data (`eng.traineddata.gz`, ~10 MB) is **not** in git and
must be dropped manually:

```bash
curl -L -o app/public/tesseract/eng.traineddata.gz \
  https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata
gzip app/public/tesseract/eng.traineddata
```

Without this file, the "Attempt OCR" button on a scanned-PDF banner
returns an error. The rest of the app is unaffected.

## Phase 18 classifier (optional)

The on-device hybrid-rules classifier is opt-in (gated behind the
`?phase18=on` feature flag). Like Tesseract, the runtime is bundled
but the model weights are **not** in git — they're a one-time manual
drop:

```bash
cd app
npm run build:classifier-assets
```

This drops **~27 MiB total** under `app/public/classifier/`:

- `~17.5 MiB` of `Xenova/paraphrase-MiniLM-L3-v2` model files
  (`onnx/model_quantized.onnx`, tokenizer, config) under
  `app/public/classifier/Xenova/paraphrase-MiniLM-L3-v2/`.
- `~9.5 MiB` of `ort-wasm-simd.wasm` (ONNX Runtime, single-thread
  SIMD; copied from `node_modules/@xenova/transformers/dist/`)
  into `app/public/classifier/onnx-runtime/`.

Both must be served same-origin (the app's CSP sets `connect-src
'self'`). The Wave 25 loader fix (`app/src/llm/loadClassifier.ts`)
configures `@xenova/transformers` to point at these paths and
disables remote-model fallback so a missing-asset error surfaces
immediately rather than silently degrading.

Idempotent — subsequent runs no-op when the files are already
present. NOT auto-run on `npm install` (CI builds that don't need
the classifier shouldn't pay the fetch cost). Without this drop,
the hybrid path silently falls back to the deterministic rules
engine even when the flag is on; the rest of the app is unaffected.

### Verifying the classifier works end-to-end

A gated Playwright spec exercises the full chain (asset load → ONNX
runtime boot → embedding → cosine similarity → hybrid finding →
click-to-explain disclosure). After the `build:classifier-assets`
drop:

```bash
cd app && npm run build && cd ..
RUN_REAL_MODEL=1 npx playwright test --project=chromium tests/e2e/hybrid-golden.spec.ts
```

The spec is skipped without `RUN_REAL_MODEL=1`. First-run wall time
is ~30–60 s (16 MiB ONNX fetch + WASM init); subsequent runs reuse
the browser HTTP cache and complete in a couple of seconds.

See [`docs/SECURITY.md`](./SECURITY.md) §7 for the standing
`npm audit` decisions on the dep chain that ships with this
runtime.

## Troubleshooting

### Pre-commit hook didn't run

Run `npm install` at the **repo root** (not just `app/`). The hook is
installed by husky's `prepare` script in the root `package.json`. If
you cloned and only installed inside `app/`, husky was never wired.

Verify with `cat .git/hooks/pre-commit` — it should reference husky.

### Playwright browsers fail to install

The default `npm run e2e:install` installs all three browser engines
(chromium + firefox + webkit). If you only need chromium for a quick
smoke, run:

```bash
npx playwright install --with-deps chromium
```

The CI matrix runs all three; local runs default to all three but you
can scope to one with `npx playwright test --project=webkit`.

### `npm test` fails with "canvas not implemented"

Benign jsdom warning from any test that mounts `<PdfViewer>`. The
viewer mocks pdf.js worker rendering in tests; the warning is from the
canvas element itself, not the test logic. Tests still pass.

### Tauri build errors on macOS without Xcode CLT

The Tauri desktop wrapper builds via the CI matrix (Wave 14-A); the
local Tauri build needs Xcode Command Line Tools on macOS. Install
with `xcode-select --install`. If you don't intend to ship the Tauri
binaries, ignore the `app/src-tauri/` directory entirely — none of the
PWA build steps depend on it.

### Service worker caches an old build

After `npm run build` + `npm run preview`, hard-refresh
(Cmd+Shift+R) to bypass the precache. In dev (`npm run dev`), the
service worker is disabled by Vite's plugin so this only matters for
preview / production paths.

## Where to read next

- [`docs/CONTRIBUTING.md`](./CONTRIBUTING.md) — the contributor flow
  (branches, PRs, the local gate sequence, what not to land).
- [`docs/CLAUDE.md`](./CLAUDE.md) — coding conventions + data-handling
  gotchas (StrictMode-safe ArrayBuffer copying, IDB tx + WebCrypto
  microtask hazards, etc.).
- [`docs/SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md) — the architecture
  layering and IDB landscape.
- [`docs/BACKLOG.md`](./BACKLOG.md) — the authoritative ticket list.

# Wave 38 — Bundle / perf re-audit report

**TL;DR.** Above-fold first paint is healthy at ~376 KiB raw / ~115 KiB
gzip. Every heavy chunk (pdf.js, pdf.worker, transformers v4, ORT WASM,
sideLetterPdf) is already lazy-loaded as designed. No regression from
the Wave 36 transformers v2→v4 migration. **Report-only PR per plan
§3** ("ship the report alone is acceptable"). Two follow-up
opportunities documented at the bottom.

## Method

- `rm -rf app/dist && npm run build` from `app/` on base SHA `1e7fd10`.
- Captured per-chunk sizes from build output and `dist/assets/` `ls -la`.
- Ran `npm run check:budget` against the fresh build (see Finding §2).
- Confirmed lazy boundaries by `grep`-ing `await import(...)` for each
  heavy chunk's source paths.
- Skipped Lighthouse — the build numbers already establish there is no
  shell-bound regression to chase, and `lhci` against the same shell
  numbers as W27/28 isn't worth its run-cost in this wave.

## Build output

| Chunk | Size | Gzip | Above-fold? |
|-------|-----:|-----:|:-----------:|
| `index-CC5rYonI.js` (app shell) | 332.8 KiB | 105.2 KiB | ✅ |
| `index-DEVcdsln.js` | 14.6 KiB | 6.5 KiB | ✅ |
| `index-CfQt9kGU.css` | 27.9 KiB | 5.9 KiB | ✅ |
| `pdf-DfaD4CCm.js` (pdf.js api) | 399.6 KiB | 123.0 KiB | lazy |
| `pdf.worker-*.js` (×2 — see §1) | 1345.6 KiB each | 422.3 KiB | lazy |
| `transformers.web-DcIBv2Fq.js` | 554.8 KiB | 164.8 KiB | lazy |
| `sideLetterPdf-DC8TgNXk.js` | 430.7 KiB | 178.5 KiB | lazy |
| `leaseWorker-kNpZtCFm.js` | 8.7 KiB | — | lazy |
| `AppRedlinePane`, `AuditLogPanel`, `HybridFeedbackButton`, `HybridPrecisionDisclosure` | 1.5–9.2 KiB | — | lazy |
| `ort-wasm-simd-threaded.asyncify-*.wasm` | 23,567 KiB | — | lazy + on-demand fetch |

**Above-fold first paint:** index shell + secondary index + CSS =
~376 KiB raw / **~117 KiB gzip**. This is the only thing that lands
before user interaction.

## Lazy-load confirmation (grep evidence)

| Chunk | Lazy via | Source |
|-------|----------|--------|
| pdf.js api | `await import('pdfjs-dist/legacy/build/pdf.mjs')` | `app/src/ui/renderPdfPages.ts:16`, `app/src/parser/extractPages.ts` |
| pdf.worker | `await import('pdfjs-dist/legacy/build/pdf.worker.mjs')` | same files |
| transformers v4 | `await import('@huggingface/transformers')` | `app/src/llm/loadClassifier.ts:36` |
| sideLetterPdf | `await import('../workflow/sideLetterPdf')` | `app/src/App/useSideLetter.ts:88` |
| ORT WASM | Fetched same-origin on-demand by transformers loader; `globIgnores` excludes from PWA precache (see `app/vite.config.ts:32`) | — |

## Comparison to Wave 27/28 baseline

`docs/BACKLOG.md` "Current footprint" lists: app shell ~290 KiB, pdf.js
api 400 KiB, pdf.worker 1.3 MiB, leaseWorker ~8 KiB, tesseract 8 MiB
opt-in. Today:

- App shell: 332.8 KiB (up ~42 KiB from "~290" — within budget cap of
  354 KiB, accounted for by the W30-B and W32-C bumps documented in
  `app/scripts/check-bundle-budget.mjs`).
- pdf.js / pdf.worker / leaseWorker: unchanged.
- transformers v4 ~568 KiB (new since W36 — replaced v2 which was
  ~827 KiB; net **shrink** of ~259 KiB on the lazy chunk).
- ORT WASM 23 MiB (new since W36, lazy + non-precached — see §2).

**Net:** Wave 36 made the lazy chunk lighter (transformers v2→v4)
while adding a heavyweight non-precached on-demand fetch (ORT WASM).
Above-fold is unaffected.

## Follow-up §1 — `pdf.worker` is precached twice

The PWA precache manifest (`dist/sw.js`) lists two distinct hashed
copies of `pdf.worker`:

```
pdf.worker-CqnM6SrA.js   1377892 bytes
pdf.worker-n29bN0-W.js   1377934 bytes
```

Same content (42-byte diff suggests differing wrapper code injected by
Vite for two import contexts). Cause: dynamic `await import(...)` of
`pdfjs-dist/legacy/build/pdf.worker.mjs` from **two** source files
(`app/src/parser/extractPages.ts:10` and `app/src/ui/renderPdfPages.ts:15`).
Vite's worker handling produces two chunks instead of one shared chunk.

**Cost:** ~1.3 MiB redundant precache (only one copy is ever executed
at runtime; the other is dead weight in offline cache).

**Why not fix in this wave:** the fix needs a `manualChunks` decision
in `app/vite.config.ts` (or extracting the worker import to a shared
helper module). Either path needs validation that pdf.js still works
correctly under both import sites — that's a small dedicated wave, not
a measurement-wave drive-by. Recommend Wave 39's tech-debt slot pick
this if the parallel session has headroom.

## Follow-up §2 — `check-bundle-budget.mjs` "OCR + classifier ≤ 30 MiB" is broken

The combined-precache check (`scripts/check-bundle-budget.mjs` lines
~120-140) measures `du -b` of `dist/tesseract/` + `dist/classifier/`.
Two failure modes:

1. **False-pass in CI.** `npm run build` doesn't run
   `build:classifier-assets`, so `public/classifier/` is empty in CI →
   `dist/classifier/` is empty → check passes trivially. Wave 36-B's
   ORT WASM staging (the `~75 MiB` of `onnx-runtime-v4/*.wasm`) is
   never measured.
2. **False-fail locally.** Whoever has classifier assets on disk gets
   a 101 MiB count, including ~75 MiB of ORT WASM that the PWA
   `globIgnores` already excludes from precache (`app/vite.config.ts:32`).
   So the script counts what the PWA does *not* precache. Reproduced
   on this branch (101.5 MiB / 30 MiB cap → fail).

The 30-MiB cap was a *precache* contract from Wave 18-B, but the
script measures *on-disk under dist/* — those are different sets now
that ORT WASM exists.

**Why not fix in this wave:** the right fix needs a policy choice —
either (a) measure the actual PWA precache manifest (parse `dist/sw.js`
and sum), or (b) align the disk walk with `globIgnores` patterns from
vite config. Both are reasonable; both should be deliberate. Recommend
Wave 39 or a dedicated mini-wave.

## Decision

Per plan §3, **ship the report alone**. Both follow-ups are real but
each needs a scoped fix-wave with its own validation, not a measurement-
wave drive-by.

## What ships

This document. No `.~~mergify~~.yml`, vite config, source, or workflow edits.

## Verification

- ✅ Build green: `npm run build` succeeds (Vite warns about chunks
  >500 KiB, all of which are confirmed lazy).
- ✅ Above-fold size derived from build output, not estimated.
- ✅ Lazy boundaries grep-confirmed against source.
- ⚠️ `npm run check:budget` fails locally because of Follow-up §2 —
  CI passes the same gate because of Follow-up §1's CI/local divergence.
  This is **not a regression introduced by this wave** (pre-existing
  script semantics).

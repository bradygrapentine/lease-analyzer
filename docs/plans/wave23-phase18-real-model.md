# Wave 23 — Phase 18 real-model integration

**Goal:** wire the actual MiniLM-L3 classifier (Wave 18-B's pick)
into the analyze pipeline behind the existing feature flag. Make
Phase 18 ship a real working hybrid path — not just the seam Wave
21-A established. Three parts; tight caps; the Playwright golden
test + visible UI surface roll to Wave 24.

## Scope boundary

Wave 23 owns:

- `app/scripts/build-classifier-assets.mjs` (NEW, Part A) —
  one-time-drop downloader that mirrors the Tesseract pattern.
- `app/package.json` (Part A — adds `build:classifier-assets`
  npm script; does NOT auto-run on install).
- `app/vite.config.ts` (Part A only — `vite-plugin-pwa`'s
  Workbox `globPatterns` extension to precache classifier files).
- `app/src/App/usePipeline.ts` (Part B — single edit; passes
  `loadClassifier`-derived `embedFn` + `safeAudit` through to
  `runHybridAnalyze`).
- `app/src/App/usePipeline.test.ts` (Part B — extends with the
  flag-on path).
- `app/src/rules/types.ts` (Part C — additive `evidence?` field on
  `Finding`).
- `app/src/rules/hybridAnalyze.ts` (Part C — populate
  `evidence` on hybrid findings; Wave 22-A established the audit
  payload, this part puts the same data on the finding itself).
- `app/src/rules/hybridAnalyze.test.ts` (Part C — extends).
- `app/index.html` (Part C — CSP `<meta>` directive update **only
  if** static analysis identifies a needed change).
- `app/scripts/check-csp.mjs` (Part C — extends to allow the new
  directive set).
- `docs/SECURITY.md` (Part C — "Last review" date + CSP-section
  update if changed).

Wave 23 does **NOT** touch:

- IndexedDB schema; no DB version bump.
- New audit `kind` strings (Wave 22-A's `'llm-classify'` is the
  only Phase-18-related kind).
- `usePipeline.test.ts` worker-path (Part B's edit only routes the
  inline / OCR-fallback path through `runHybridAnalyze`; the worker
  already does deterministic `analyze()` — wiring the worker to
  the model is Wave 24+).
- Playwright golden test against the real model (Wave 24 — needs
  CI infra to load the 17.5 MiB model in a real headless browser,
  network-cached; not trivial to set up).
- Visible UI surface for hybrid findings or attestation (Wave 25+
  — first prove the integration works under load before adding a
  badge).
- Removing any defensive guards to inflate branch coverage. The
  89.34% / 89.5%-buffer issue from Wave 22-B stays unresolved
  here; threshold bump is OUT of scope this wave.

## Pre-flight

1. Wave 22 (A/B/C + plan) merged. Wave 23 starts from `main` at
   or after Wave 22-C's merge SHA.
2. `cd app && npm run typecheck && npm run lint && npm run test:coverage`
   green on `main`. Bundle budget green.
3. Verify `app/scripts/measure-llm-budget.mjs` still runs cleanly
   against the Xenova/paraphrase-MiniLM-L3-v2 repo (i.e. the model
   files Wave 23-A will download still exist on Hugging Face). If
   the model has been rotated or de-listed, halt and pick a
   substitute before any code lands.
4. Verify the bundle-budget gate's "OCR + classifier ≤ 30 MiB"
   line still reads correctly post-Wave-20-C. Recompute the
   contract if the cap has drifted.
5. Read each part's cap before starting. Caps are contracts.

## Parts (A is precondition for B; C parallel-safe with both)

### Part A — model-asset download + Workbox precache wiring

**Branch:** `wave23-classifier-assets`

**Cap:** **1 new script** (`app/scripts/build-classifier-assets.mjs`)
+ **2 file edits** (`app/package.json` for the npm script;
`app/vite.config.ts` for the `globPatterns` extension). **Zero
production source changes**. Combined OCR + classifier precache
must stay under the existing 30 MiB budget gate (Wave 20-C).

**Approach:**

Mirror the Tesseract precedent. The Phase 18 model is large (~17.5
MiB) so we do **not** auto-run the downloader on `npm install` —
that would add a multi-MB fetch to every fresh checkout.

The script:

- Downloads the same files Wave 18-B's `measure-llm-budget.mjs`
  measured: `onnx/model_quantized.onnx`, `tokenizer.json`,
  `tokenizer_config.json`, `config.json`, `vocab.txt`,
  `special_tokens_map.json` (silently skipping any 404s — file
  list varies by repo).
- Writes them under `app/public/classifier/` (NOT `app/src/`).
  `vite-plugin-pwa`'s `globPatterns` glob picks them up so Workbox
  precaches them at build time.
- Idempotent: skips files already on disk with the right size.
- Prints a summary at the end (per-file bytes + total) for
  alignment against Wave 18-B's measurement.
- Exits 0 on success, non-zero on any non-skip failure.

`npm run build:classifier-assets` is the manual one-time invocation;
it is **not** added to `postinstall`. CI runs it explicitly when
shipping a build that needs the classifier (Wave 24+ wires that).

**Files:**

- `app/scripts/build-classifier-assets.mjs` (NEW). Pure ESM, Node
  21+, no new deps; uses `node:fetch` + `node:fs/promises`.
- `app/package.json` — add the npm script entry.
- `app/vite.config.ts` — extend `VitePWA.workbox.globPatterns` to
  include `'classifier/**/*'`. Verify `maximumFileSizeToCacheInBytes`
  still allows the model (current limit is 5 MiB per file —
  **needs bumping** to 18 MiB to allow the int8-quantized weights;
  this is a real config change to flag).
- `app/public/classifier/.gitkeep` (NEW) — keeps the directory in
  the tree without committing the model binary itself; CLAUDE.md's
  "no binary fixtures" rule applies.
- `docs/SETUP.md` (existing — Part A appends a one-paragraph
  "Phase 18 classifier (optional)" subsection mirroring the
  Tesseract section, documenting the manual one-time drop).

**Tests / verify:**

- `node app/scripts/build-classifier-assets.mjs` runs to
  completion when invoked locally; subsequent runs no-op.
- `npm run build && npm run check:budget` green; combined OCR +
  classifier lane reports ~25 MiB (Tesseract ~8 MiB + classifier
  ~17.5 MiB) — under the 30 MiB cap with ~5 MiB headroom.
- Service worker precaches the new classifier files (verify by
  reading `dist/sw.js` for the file references after build).
- `npm run typecheck && npm run lint` green.

**Out of scope:** auto-running on `postinstall`; bundling the
model into git LFS; embedding the model into the worker bundle
directly (Wave 24+ wires the worker path); validating the model's
Apache-2.0 / MIT license redistribution model (`docs/SECURITY.md`
§5 already documents the Tesseract precedent; mirror it in Part C
once the file set is final).

### Part B — wire `loadClassifier` into `usePipeline`

**Branch:** `wave23-classifier-wired`

**Cap:** **1 src edit** (`app/src/App/usePipeline.ts`) +
**1 test extension** (`usePipeline.test.ts`). **No new files**.
**Worker path stays on deterministic `analyze()`** — Part B only
threads the classifier through the inline / OCR-fallback path that
already calls `runHybridAnalyze` (Wave 21-A's edit point).

**Approach:**

Wave 21-A wired `runHybridAnalyze` with `embedFn: null`. Part B
replaces the null with `loadClassifier`-derived `embedFn` when the
flag is on AND classifier files have been dropped. The flag-off
path is unchanged (deterministic-only); no production caller pays
the model load cost without opt-in.

Strategy:

```
const hybridEmbedFn = isPhase18Enabled()
  ? await loadClassifierEmbedFn() // wraps loadClassifier; returns null on failure
  : null;
```

`loadClassifierEmbedFn` is a small helper inside `usePipeline.ts`
(not a new file) that:

- Calls `loadClassifier()` with the default model id.
- Wraps the returned `EmbedFunction` so that batch-of-N embedding
  calls happen in one `loadClassifier`-derived pass.
- Catches load errors (e.g. classifier files missing because the
  user never ran `build:classifier-assets`) and returns `null`,
  falling back to the deterministic path.

`safeAudit` is also threaded through to `runHybridAnalyze`'s
`audit` parameter so the existing `'llm-classify'` kind (Wave 22-A)
fires per hybrid finding.

**Files:**

- `app/src/App/usePipeline.ts` — replace the `embedFn: null` with
  the conditional + add `audit: safeAudit, modelId:
  DEFAULT_MODEL_ID` (imported from `loadClassifier.ts`). Add the
  small `loadClassifierEmbedFn` helper inside the file.
- `app/src/App/usePipeline.test.ts` — extend with two cases:
  - Flag off → deterministic equivalence (no `loadClassifier`
    invocation).
  - Flag on but `loadClassifier` rejects (simulated via a stub
    that throws) → falls back to deterministic path; pipeline
    completes without error.

**Tests / verify:**

- `App.test.tsx` + `App.panels.test.tsx` pass unchanged.
- `usePipeline.test.ts` passes including the two new cases.
- Coverage thresholds hold.
- Bundle budget unchanged (the dynamic import in `loadClassifier`
  keeps `@xenova/transformers` out of the app shell).

**Out of scope:** wiring the worker path (Wave 24+ — needs the
worker to dynamic-import the model, separate concern); UI surface
for hybrid findings; running the real model in jsdom tests
(impossible — ONNX runtime needs WebGPU / WASM that jsdom doesn't
provide).

### Part C — `Finding.evidence` field + CSP audit

**Branch:** `wave23-evidence-and-csp`

**Cap:** **2 src edits** (`Finding` type + `runHybridAnalyze`)
+ **1 doc edit** (`docs/SECURITY.md`) + **1 script edit**
(`app/scripts/check-csp.mjs`) + **0-1 src edits** (`app/index.html`
CSP `<meta>` — only if static analysis says it's needed). Tests
extended (≤ 4 new cases).

**Approach:**

Two independent additions bundled because they're both small and
both Phase-18-related:

**C1 — `Finding.evidence` field.** Wave 16-C's BACKLOG row asked
for per-finding attestation. Wave 22-A added the audit-log entry;
Part C puts the same data on the `Finding` itself so consumers
(future UI badge, JSON export) can show the LLM provenance without
joining against the audit log:

```ts
interface Finding {
  ...existing fields...
  /** Phase 18 — set on findings emitted by the hybrid classifier
   *  pass. Absent on deterministic regex/proximity findings. */
  evidence?: { modelId: string; similarity: number };
}
```

`runHybridAnalyze` populates the field on hybrid findings only.
Existing JSON exports auto-serialize it (`Finding` is plain data).
Existing finding consumers stay working unchanged (additive).

**C2 — CSP impact audit.** transformers.js + ONNX Runtime Web
documentation lists the CSP requirements:

- `script-src 'self'` → already present, fine.
- `script-src 'wasm-unsafe-eval'` → **needed** (ONNX runtime uses
  `WebAssembly.instantiate` from a fetched buffer; Chrome's CSP
  checker requires this directive when CSP is set via `<meta>`).
- `worker-src 'self' blob:` → already present.
- `connect-src 'self'` → already covers same-origin model fetch.

So one CSP change: add `'wasm-unsafe-eval'` to `script-src`. Update
`app/scripts/check-csp.mjs` to allow this token without flagging
it as a regression. Document the change in `docs/SECURITY.md` § 3
(CSP contract) with the rationale.

This is **static analysis** — the actual runtime CSP test (loading
the model in a real Chrome and watching the console) is **manual**
and rolls to Wave 24's e2e work.

**Files:**

- `app/src/rules/types.ts` — add `evidence?` to `Finding`.
- `app/src/rules/hybridAnalyze.ts` — populate `evidence: { modelId,
  similarity }` on hybrid findings.
- `app/src/rules/hybridAnalyze.test.ts` — extend with 1 case
  asserting `evidence` is set on hybrid findings, absent on
  deterministic ones.
- `app/index.html` — CSP `<meta>` directive: `script-src 'self'
  'wasm-unsafe-eval'`.
- `app/scripts/check-csp.mjs` — allow the new directive token in
  the regression check.
- `docs/SECURITY.md` § 3 — document the new directive's purpose
  + the empirical follow-up (Wave 24 e2e).

**Tests / verify:**

- `npm run typecheck && npm run lint && npm run test:coverage`
  green; thresholds intact.
- `npm run check:csp` green with the updated directive set.
- New `hybridAnalyze.test.ts` cases pass.
- No JSON-export regression: existing `exportFindingsJson` /
  `buildAuditLogJson` round-trip the new `evidence` field
  unchanged (it's plain data).

**Out of scope:** runtime CSP verification in a real Chrome (Wave
24 e2e); wiring `evidence` into the FindingsPanel UI (Wave 25+ —
needs design); deeper CSP hardening beyond what Phase 18 needs.

## Merge order

A is the precondition for B (B needs the classifier files to exist
for the production code path to load them). C is parallel-safe
with both A and B (touches different files). Suggested:

```
A    (model assets + Workbox precache)
   ↓
B    (loadClassifier wired into usePipeline)
   ↓
C    (evidence field + CSP audit; could ship before A/B if needed)
```

Or A and C in parallel, B last. C touches different files than A;
if you parallelize A + C, no merge conflicts.

## TDD recommendation

**Direct (single Opus author) for all three.** Each part has
judgment calls — model-file list to download in A, what
`loadClassifierEmbedFn` should do on load failure in B, what the
CSP rationale should say in C. Subagent dispatch overhead exceeds
the parallelism gain.

## Done definition

- Part A merged: `build:classifier-assets` script exists; running
  it locally drops the model files into `app/public/classifier/`;
  `npm run build && npm run check:budget` green with the combined
  OCR + classifier lane reporting ≤ 30 MiB; SETUP.md documents the
  manual one-time drop.
- Part B merged: `usePipeline` calls `runHybridAnalyze` with a
  non-null `embedFn` when the flag is on AND classifier files
  exist; falls back to deterministic-only otherwise; tests pin
  both paths.
- Part C merged: `Finding.evidence` populated on hybrid findings;
  CSP `script-src 'wasm-unsafe-eval'` added with `check-csp.mjs`
  + `SECURITY.md` updates.
- All thresholds held; no behavior changes to the deterministic
  pipeline; no new audit `kind` (Wave 22-A's `'llm-classify'`
  remains the only Phase-18-related kind).
- No new IDB store, no new product UI surface (Wave 25+).

## Hard caps summary

| Part | Cap |
|------|-----|
| A | 1 new script + 2 file edits + 1 .gitkeep + 1 SETUP.md paragraph; combined precache ≤ 30 MiB |
| B | 1 src edit + 1 test extension; no new files; worker path untouched |
| C | 2 src + 1 doc + 1 script edit + 0-1 CSP edit; ≤ 4 new test cases |

If a cap is breached, ship what fits and roll the overflow to
Wave 24. Do not negotiate caps up from inside a part.

## Wave 24 preview (out of scope here, queued)

- **Playwright e2e** that loads the real model + asserts the
  paraphrased-clause golden case fires a hybrid finding with
  `evidence.modelId === 'Xenova/paraphrase-MiniLM-L3-v2'`.
- **Worker-path classifier wiring** — `leaseWorker.ts` dynamic-imports
  `@xenova/transformers` in the worker context; same Phase 18 flag
  gates the import.
- **Defensive-guard cleanup** (the standing question from Wave 22-B):
  audit the `?? ''` / `!x || !y` paths v8 marks as branches; drop
  the unreachable ones; bump branch threshold to 89 if actuals
  finally clear 89.5%.
- **UI surface** for hybrid findings — confidence badge or
  attestation tooltip on the FindingsPanel row when
  `evidence` is present.

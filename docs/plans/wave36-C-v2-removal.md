# Wave 36-C — `@xenova/transformers` v2 removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) or run inline. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `@xenova/transformers` v2 branch and the `?transformersV2=on` kill switch now that Wave 36-B's flip to `@huggingface/transformers@4` is live on main. Drop the v2 npm dep, the v2 ORT WASM staging, and the v2 globIgnore from the Workbox config. End state: a single-runtime classifier loader.

**Architecture.** Pure subtractive change. The v4 path in `loadClassifier.ts` already works (Wave 36-B). This wave deletes the v2 sibling. No new code, no new files, no behavior change for the default user.

**Tech Stack.** TypeScript, Vite, Workbox via vite-plugin-pwa, transformers.js v4 (`@huggingface/transformers@4.2.0`).

**Base SHA.** Branches from `origin/main` post-Wave-36-B merge (`gh pr view 152 --json mergeCommit`).

**Predecessor:** [Wave 36 transformers v2→v4 migration design](../superpowers/specs/2026-04-28-wave36-transformers-migration-design.md), [Wave 36 plan](./wave36-transformers-migration.md).

---

## §0 What changed since Wave 36-B

Wave 36-B (PR #152) shipped:

- v4 default; `?transformersV2=on` kill switch.
- `public/classifier/onnx-runtime-v4/` staging via `build-classifier-assets.mjs`.
- `wasmPaths = '/classifier/onnx-runtime-v4/'` in `loadV4Pipeline`.
- Workbox `globIgnores` extended for v4 ORT.

State at Wave 36-C start: v4 is the production path; v2 exists only as fallback.

## §1 Hard rules

1. **Bake-time check.** Before dispatch, confirm Wave 36-B has been on `main` for ≥ 24h with no production rollback or v2-fallback usage reported. If <24h, halt and ask.
2. **Single PR.** All four files (loader, dep, staging script, vite config) ship in one squash PR. They're deletions of one cohesive subsystem.
3. **Real-model spec stays green.** `RUN_REAL_MODEL=1 npx playwright test tests/e2e/hybrid-golden.spec.ts` must pass post-removal — this is the definition of done.
4. **No re-tune of the precision/recall thresholds** in this wave. If post-removal stats drift, that's a separate Wave 38.
5. **Audit-chain modelId** stays `Xenova/paraphrase-MiniLM-L3-v2` — v4 still resolves the same id against `localModelPath`, audit entries remain stable.

## §2 Out of scope

- Migrating off the `Xenova/...` model id namespace (v4 supports it natively).
- Threshold re-tuning (Risk 2 from the Wave 36 spec — defer to Wave 38).
- Bundle-size optimization beyond what falls out of the v2 dep removal.
- COOP/COEP headers to enable threaded ORT.

## §3 Execution

Direct, single-track. No subagents. Estimated 30 min.

---

## §4 File changes

### Modify
- `app/src/llm/loadClassifier.ts`
  - Delete `loadV2Pipeline` function entirely.
  - Delete `?transformersV2=on` branch from `readRuntimeFlag`; the function is now obsolete — remove it and inline the v4 pick at `loadClassifier`.
  - Update file header comment: drop the dual-runtime explanation.
- `app/src/llm/loadClassifier.test.ts`
  - Delete the entire `Wave 36 readRuntimeFlag` describe block.
  - Keep the existing v4 happy-path test (or rewrite to call `loadClassifier` directly).
- `app/package.json`
  - Remove `"@xenova/transformers": "^2.17.2"` from `dependencies`.
- `app/scripts/build-classifier-assets.mjs`
  - Remove `ORT_DEST` (`onnx-runtime/`) + `ORT_SOURCE` constants.
  - Remove the v2 ORT copy block (lines staging `ort-wasm-simd.wasm`).
  - Keep v4 staging untouched.
- `app/vite.config.ts`
  - Remove `'classifier/onnx-runtime/**'` and the now-stale `'assets/ort-wasm-*'` entries from `globIgnores`. Keep `'classifier/onnx-runtime-v4/**'`.

### Delete
- `app/public/classifier/onnx-runtime/` (entire directory; v2 WASM no longer needed). `git rm -r app/public/classifier/onnx-runtime/`.

### Update
- `app/package-lock.json` (auto, via `npm install` after package.json edit).

## §5 Verification

In order:

- [ ] `cd app && npm install` — lockfile updates, no errors.
- [ ] `npm run build:classifier-assets` — only v4 staging runs.
- [ ] `npm run build` — clean, precache size **drops** (no v2 ORT in dist).
- [ ] `npm run typecheck` — clean.
- [ ] `npm run lint` — clean.
- [ ] `npm test -- --run` — all tests pass.
- [ ] `RUN_REAL_MODEL=1 npx playwright test tests/e2e/hybrid-golden.spec.ts` — green.
- [ ] `grep -r '@xenova\|transformersV2\|onnx-runtime/' app/src app/scripts app/vite.config.ts` returns no hits.

## §6 PR

- Title: `wave36-C: remove @xenova/transformers v2 branch + kill switch`
- Body: 2-bullet summary + test plan checklist + a "Bundle delta" line showing the precache size drop.

## §7 Risk register

| Risk | Mitigation |
|------|------------|
| v4 has a latent bug only the kill switch could rescue. | The 24h bake-time check is the gate. If a bug surfaces post-merge, revert this PR — v2 is recoverable from git history for one wave. |
| Workbox `globIgnores` removal accidentally precaches a renamed ORT file. | Build log shows precache entries — verify v4 ORT is still skipped. |
| Removing `@xenova/transformers` breaks an unrelated import. | `grep -r '@xenova/transformers' app/src` before merge. Should be zero hits after the loader edit. |

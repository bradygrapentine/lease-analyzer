# Wave 36 — `@huggingface/transformers` v2→v4 migration design

**Date:** 2026-04-28
**Status:** Design (pre-plan)
**Successor:** `docs/plans/wave36-transformers-migration.md` (to be written by the writing-plans skill)

## 1. Goal

Replace the EOL `@xenova/transformers@2.17.2` runtime with the official `@huggingface/transformers@4.x` package, close the protobufjs accept-risk row in `docs/SECURITY.md` §7.1, and leave the Phase 18 hybrid path on a fully-supported upstream. The migration is gated behind a URL flag during the wave so we can prove parity before the default flip.

## 2. Why now

- `@xenova/transformers@2.17.2` is EOL upstream — no fix coming on the v2 line.
- `app/scripts/audit-prod.mjs` carries `GHSA-xq3m-2v4x-88gg` in `ALLOW_ADVISORIES` (the protobufjs CVE chain) solely to keep `npm run audit:prod` green. Each new advisory in that chain raises pressure.
- The official `@huggingface/transformers@4.x` package supersedes the Xenova fork; protobufjs and other transitive deps are refreshed in the v4 lineage.
- Wave 32-A wired a real-model nightly spec (`tests/e2e/hybrid-golden.spec.ts`); Wave 35 shipped the data-tooling. The runway for the migration is built — the runtime swap is the last move.

## 3. Architecture

**Dual-runtime behind URL flag, same-session aggressive cutover.**

- New flag `?transformersV4=on` mirrors the Phase 18 `?phase18=on` idiom (URL-only, no IDB persistence).
- `app/src/llm/loadClassifier.ts` branches on the flag and dispatches to either the v2 or v4 import path.
- Both packages are simultaneously installed during the wave; v2 is removed in Part C.
- The wave closes in one session **iff** Part 0's compatibility spike passes its three acceptance criteria. Otherwise the wave degrades to plan B (v4-behind-flag only; default-flip + v2 excision deferred to Wave 37).

**Why same-session.** The protobufjs accept-risk row is the explicit goal. A multi-wave window leaves the row open for that gap. With a load-bearing Part 0 spike, same-session is the responsible default — we only commit to it after the spike confirms compatibility.

## 4. Parts

### Part 0 — Compatibility spike (timeboxed, throwaway)

A standalone Node script — not committed unless it stays useful — that installs `@huggingface/transformers@4.x` alongside the existing v2 dependency and exercises three concrete checks against the existing classifier assets at `app/public/classifier/Xenova/paraphrase-MiniLM-L3-v2/`.

**Three deliverables:**

1. **Embedding parity.** Feed 5–10 fixed paragraphs (drawn from `app/src/parser/testFixtures.ts`) through both runtimes. For each paragraph, compute cosine similarity between `v2.embed(p)` and `v4.embed(p)`. **Acceptance: every pair ≥ 0.99.**
2. **Audit diff.** Run `npm run audit:prod` immediately after `npm install @huggingface/transformers@4`. Capture any new advisories vs the current `ALLOW_ADVISORIES` baseline. **Acceptance: zero new accept-risk rows required.**
3. **Size measurement.** Build a stub vite bundle that imports `@huggingface/transformers` only. Report: chunk size, ORT WASM size delta, total opt-in payload. **Acceptance: chunk ≤ 1.5 MiB; total opt-in payload ≤ 30 MiB precache cap.**

**On any FAIL:** halt the wave, surface the spike's findings, re-brainstorm the failure path before proceeding. Do not auto-fall-back.

**On all PASS:** proceed to Part A. The spike script is discarded (or kept under `app/scripts/` if it has ongoing diagnostic value — judgment call at the time).

### Part A — v4 behind flag

- Add `@huggingface/transformers@4.x` to `app/package.json` dependencies. Keep `@xenova/transformers@2.17.2` for now.
- Wire the `transformersV4` URL flag through to `loadClassifier.ts` (the parser already reads `?phase18=on`; add a sibling read).
- Add a v4 code path that mirrors the v2 flow: load pipeline → embed paragraph → cosine sim → emit `Finding`. The two paths share zero code; they're parallel implementations during this part.
- Resolve ORT WASM path conflicts. v2's `build-classifier-assets.mjs` copies ORT from `node_modules/@xenova/transformers/dist/...`. v4 may bundle ORT differently (likely under `@huggingface/transformers/dist/...` or a separate `onnxruntime-web` package). The build script learns to source from both during the dual-runtime window.
- Add `transformers` chunk pattern + budget to `app/scripts/check-bundle-budget.mjs` at measured-v4 size + 10% headroom. The 30 MiB combined precache cap stays at its current threshold.
- Tests: `loadClassifier.test.ts` becomes parameterized over runtime. Each runtime gets the existing test set plus a new "embedding shape regression" assertion (returned tensor `[1, 384]`, magnitude in documented range, fixed-input fixture's first element ±1e-3).

**Acceptance:** all `loadClassifier.test.ts` parameterized rows pass; build green; bundle budget gate green.

### Part B — Default flip

The acceptance gate before flipping is **two conditions**:

1. `RUN_REAL_MODEL=1 npx playwright test tests/e2e/hybrid-golden.spec.ts` passes against the v4-flagged build (existing nightly spec, ungated for this run).
2. **Manual smoke walk** by the user: load the running app, upload the bundled sample lease, confirm hybrid findings render with the badge, eyeball the badge details, confirm zero CSP violations in the browser console.

When both green:

- Flip the default in `loadClassifier.ts` so v4 is the unflagged path.
- Add a `?transformersV2=on` opt-out kill switch (mirrors the `?transformersV4=on` mechanism in reverse). Kill switch is **transient** — it ships in this PR and is removed in Part C.
- Update `tests/e2e/hybrid-golden.spec.ts`'s `modelId` expectation if v4 reports a different string (see Risk #4).
- Re-run all unit tests; full app suite must stay green.

**If precision regresses meaningfully** (the manual walk shows obviously-wrong findings), do not flip. Two recovery paths:
- *Threshold re-tune.* If embeddings are close-but-not-identical, re-tune the cosine sim threshold in `loadClassifier.ts` for v4. Document the change in the PR body. This is principled drift handling, not a hack.
- *Abort.* If a re-tune doesn't recover, the wave degrades to plan B: keep v4 behind flag, defer Parts B/C/D to Wave 37, ship Part A as the wave's only output.

### Part C — Excise v2

After Part B's PR merges:

- Remove `@xenova/transformers` from `app/package.json` and run `npm install` to update the lockfile.
- Strip v2 imports from `loadClassifier.ts` and the v2 branch from `usePipeline.test.ts` fixtures.
- Drop the `transformersV2` kill switch flag (no longer load-bearing — there's no v2 to fall back to).
- Update `app/scripts/build-classifier-assets.mjs` to source ORT WASM from v4's path only. The dual-source logic added in Part A collapses to a single source.
- Re-run hybrid-golden + a final manual smoke walk to confirm nothing depended on v2 still being installed.

**Acceptance:** full test suite green; hybrid-golden green; smoke walk clean; build size measurably down (no v2 chunk).

### Part D — Accept-risk removal

- Strip `GHSA-xq3m-2v4x-88gg` (and any other v2-lineage advisory rows that no longer apply) from `app/scripts/audit-prod.mjs`'s `ALLOW_ADVISORIES`.
- `npm run audit:prod` now passes clean without the row.
- Update `docs/SECURITY.md` §7.1: the protobufjs accept-risk closes here, with a one-line history note pointing at this wave's PRs.

**Acceptance:** `npm run audit:prod` green with `ALLOW_ADVISORIES` shorter by ≥1 row; `docs/SECURITY.md` reflects the closure.

## 5. Files touched

| File | Part(s) | Change |
|---|---|---|
| `app/package.json`, `app/package-lock.json` | A, C | + v4 in A; − v2 in C |
| `app/src/llm/loadClassifier.ts` | A, B, C | dual paths in A, default flip in B, v2 stripped in C |
| `app/src/llm/loadClassifier.test.ts` | A, C | parameterized over runtime in A; v2 row dropped in C |
| `app/src/App/usePipeline.test.ts` | A, C | test-fixture imports updated alongside loadClassifier |
| `app/scripts/build-classifier-assets.mjs` | A, C | learns dual ORT paths in A, collapses in C |
| `app/scripts/check-bundle-budget.mjs` | A | adds `transformers` chunk pattern + budget |
| `tests/e2e/hybrid-golden.spec.ts` | B | modelId expectation updated if v4 renames |
| `app/src/ui/HybridFeedbackButton.tsx` (or badge owner) | C | one-line comment documenting the modelId rename, if any |
| `app/scripts/audit-prod.mjs` | D | removes `GHSA-xq3m-2v4x-88gg` from `ALLOW_ADVISORIES` |
| `docs/SECURITY.md` | D | §7.1 closes the protobufjs accept-risk |

Estimated total: ~10 files modified, 0 new src files, 0 new tests files (parameterization expands existing tests in place).

## 6. Acceptance gates summary

| Part | Gate |
|---|---|
| 0 | All three spike checks pass (parity ≥ 0.99, no new accept-risk, size ceilings respected) |
| A | All parameterized `loadClassifier.test.ts` rows green; bundle budget green |
| B | Hybrid-golden spec green against `?transformersV4=on` + manual smoke walk green |
| C | Full test suite green + hybrid-golden green + smoke walk green |
| D | `npm run audit:prod` green with shortened `ALLOW_ADVISORIES`; SECURITY.md updated |

## 7. Risks & mitigations

### Risk 1 — New advisories from v4 transitive deps

**What.** v4's transitive dependency tree differs from v2's. `npm run audit:prod` may surface new advisories that didn't exist in v2-land.

**Mitigation.** Part 0 deliverable #2 captures the audit diff before any other commitment. Part B's flip is gated on `audit:prod` being clean **without adding to `ALLOW_ADVISORIES`** — the wave's whole point is to *remove* the protobufjs row, not trade it. Adding any new accept-risk row halts the wave for re-brainstorming. If a benign new advisory appears post-spike (e.g. dev-only), Part D explicitly justifies why it's not blocking.

### Risk 2 — Tokenizer drift / precision regression

**What.** v4's tokenizer may handle special tokens, normalization, or padding differently from v2's, producing numerically different embeddings even on identical input. Cosine sim thresholds in `loadClassifier.ts` are hand-tuned against v2 outputs.

**Mitigation.** Three layers:
- *Spike parity check.* Part 0 deliverable #1 — pairwise cosine sim ≥ 0.99 across 5–10 fixed paragraphs. Drift below threshold halts the wave.
- *Unit-test embedding regression.* Part A's parameterized `loadClassifier.test.ts` asserts shape `[1, 384]`, magnitude bounds, and a fixed-input fixture's first element within ±1e-3. Drift caught at unit-test time.
- *Threshold re-tune as last resort.* If parity is close-but-not-identical and Part B's smoke walk shows precision regression, re-tune the cosine sim threshold for v4 with full PR-body justification. Not a hack — a measurable, principled change.

**Abort path.** If a re-tune doesn't recover precision, abort Part B's flip. The wave degrades to plan B (v4-behind-flag only); Wave 37 picks up the deferred cutover.

### Risk 3 — Bundle-size delta

**What.** v4 may be larger than v2 (current chunk ~827 KiB). Opt-in users on slow networks pay the cost; the 30 MiB combined precache cap is a hard ceiling.

**Mitigation.** Part 0 deliverable #3 measures: chunk size, ORT WASM delta, total opt-in payload. **Hard ceilings: chunk ≤ 1.5 MiB, total opt-in payload ≤ 30 MiB.** Breaching either halts before Part A starts. Part A locks the budget in `check-bundle-budget.mjs` at measured-v4 + 10% so future drift gates at CI.

**Halt-time options.** (a) Lazy-load further (already lazy; limited headroom); (b) tree-shake aggressively; (c) abort the wave and stay on v2 longer while pressing upstream for a slimmer build.

### Risk 4 — Audit-chain modelId mixing across the flip

**What.** Pre-flip findings carry `evidence.modelId === 'Xenova/paraphrase-MiniLM-L3-v2'`. Post-flip findings may carry whatever string v4's `pipeline().model.id` reports. Wave 30-A's `computeHybridStats` aggregates by `payload.ruleId` (not modelId), so precision math is unaffected. But the Hybrid badge UI surfaces modelId, and a careful user looking at saved findings across the flip will see two strings.

**Mitigation.** Document the rename in Part C's PR body. Add a one-line comment to the badge component (`HybridFeedbackButton.tsx` or wherever it lives) explaining the historical split. No data migration — old findings keep their original `modelId`; new findings carry the new one.

### Risk 5 — Service-worker cache staleness across the flip

**What.** Existing PWA installations have v2's transformers chunk precached. Workbox's cache busting depends on the content-hashed filename changing; v4 emits a different chunk so this should self-resolve, but worth a manual confirmation.

**Mitigation.** Part B's manual smoke walk includes a "hard reload + re-open" step to confirm SW serves the new chunk, not a stale cached one. No code change required if the hash-based busting works as designed.

## 8. Defaults & open assumptions

These are codified in the design unless reversed:

1. **Flag mechanism.** URL-param only (`?transformersV4=on`, `?transformersV2=on`), no IDB persistence. Mirrors Phase 18.
2. **ModelId policy.** Keep `Xenova/paraphrase-MiniLM-L3-v2` as the source-of-truth string in `loadClassifier.ts` if v4 resolves it. If v4 reports a different `model.id`, accept the rename in `Finding.evidence.modelId` going forward; do not backfill old audit entries.
3. **Bundle budget posture.** Measured-then-locked in Part A; +10% headroom over v4's actual size at wave-merge time.
4. **Smoke walk.** User performs the Part B manual smoke walk on their own machine. ~5 min of effort.
5. **Spike-failure handling.** Halt and re-brainstorm. No auto-fallback to a multi-wave split without an explicit checkpoint.
6. **Stabilization window.** Same-session aggressive (Parts A→B→C→D in one wave) **iff** Part 0 passes all three checks. Otherwise plan-B fallback (v4-behind-flag only).

## 9. Out of scope

- Migrating to a different model. Wave 36 stays on the existing `paraphrase-MiniLM-L3-v2` weights.
- Changing CSP, IDB schema, or any audit-kind. The classifier swap is runtime-only.
- New telemetry / accept-risk infrastructure. Existing `ALLOW_ADVISORIES` mechanism is the audit-policy contract; this wave only edits its contents.
- WCAG 2.1 AA closeout (Wave 28-F deferred).
- Storybook visual snapshot CI (Wave 34-C BACKLOG row).
- pdf.js dark-mode page raster (Wave 34-C BACKLOG row).
- Wave 35 Part B / C re-run. Independent of Wave 36; runs whenever audit-volume justifies it.

## 10. Self-review

- *Placeholder scan.* No "TBD" / "TODO" / vague requirements. The "if v4 reports a different string" branch in §8.2 is conditional, not vague.
- *Internal consistency.* Architecture (§3) matches the parts breakdown (§4); risks (§7) all map to specific part responsibilities; gates (§6) are concrete.
- *Scope check.* Five tightly-coupled parts, all in one subsystem (classifier runtime). Appropriately bounded for one spec → one plan.
- *Ambiguity check.* "Meaningfully regresses" in Risk 2 is judgment-call language but anchored by the smoke walk (a concrete activity); intentional, not hedge.

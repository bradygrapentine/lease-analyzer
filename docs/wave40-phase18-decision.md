# Wave 40 — Phase 18 hybrid: invest / retire / hold

**Decision: HOLD** with a specific re-evaluation trigger. No code changes.

## Re-evaluation trigger

Re-evaluate Phase 18 the first time **any** `npm run hybrid:stats -- <export.json>`
invocation reports `fires ≥ 10` for at least one rule. At that point:

- If the report's gate decision is `ACT` (i.e. fires ≥ 10 AND precision < 0.70 for some
  rule): open an "invest" wave to apply the suggested anchor demotions / threshold tweak.
- If the report's gate decision is `NO-OP` (fires ≥ 10 AND every rule's precision ≥ 0.70):
  Phase 18 has earned its keep — close this re-evaluation and let it ride.
- If still `fires == 0` across the board, but the file was non-empty (≥ 1 lease analyzed
  with `?phase18=on`): re-run this Wave-40 question with the fresh signal. If still no
  fires after 90 days post-trigger, retire per §B below.

**Hard backstop.** If Wave 50 starts and the trigger hasn't fired (still no real-world
hybrid-stats export with `fires ≥ 10` anywhere), reopen this decision; do **not** silently
keep the code on indefinite life support.

## Evidence

### Hybrid-stats current numbers

The Wave 35 dogfooding export against `~/Downloads/leaseguard-audit-2026-04-28.json`
returned **0 audit entries / 0 hybrid-feedback / 0 fires** (PR #148 body). The app is
local-first, network-egress-free post-load — there is no telemetry channel that could
have moved that number since. A re-export today on this machine produces the same
zero (no analyzed leases on this machine since the v2→v4 cutover in Wave 36).

The plan §8 of Wave 35 explicitly anticipated the empty-export outcome as "the most
likely first-run result," and Wave 35 closed cleanly on that basis (Part B deferred).
There is no fresh signal in 2026-04-28 that wasn't already captured in 2026-04-23.

### Call-site count

```
$ grep -rn 'evidence\.modelId\|llm-classify\|hybrid-feedback\|loadClassifier' app/src/ | wc -l
93
$ grep -rln '...' app/src/ | wc -l
18
```

18 files, 93 references. Roughly half are tests + Storybook + docs comments; the live
production path is `loadClassifier.ts` + `hybridAnalyze.ts` + `usePipeline.ts` +
`HybridFeedbackButton.tsx` + `HybridPrecisionPanel.tsx` + the badge in `FindingsPanel.tsx`.

### Bundle cost

Per Wave 38 (`docs/wave38-bundle-perf-report.md`):

- **Above-fold first paint:** unaffected. Phase 18 contributes 0 KiB to the initial
  shell.
- **`transformers.web` lazy chunk:** 554.8 KiB raw / 164.8 KiB gzip — only fetched when
  the upload path runs with `?phase18=on` *or* the URL flag was set in localStorage
  via `setPhase18Override('on')`. Default users never download it.
- **ORT WASM:** ~23 MiB across `ort-wasm-simd-threaded.{wasm,mjs}` variants under
  `public/classifier/onnx-runtime-v4/`. Lazy + on-demand, excluded from the PWA precache
  via `globIgnores` in `app/vite.config.ts`. Default users never fetch it.
- **Net impact on the default-off user (~100% of users today):** 0 bytes.

Retiring the path would shrink `dist/`'s total disk footprint (the lazy chunks and the
non-precached `public/classifier/` tree) but would **not** change above-fold or default
PWA precache, both of which already exclude this material.

### Why not invest

The plan-§4(A) "invest" path requires naming *one concrete* next step (e.g. raise
threshold X→Y, gate badge on N feedback events, expand to one new rule category). All
three need empirical signal to pick the right number / rule. With `fires == 0`, any
choice is a guess. Wave 35's gate ladder (`fires ≥ 10` before adjusting anything) was
designed precisely to refuse this trap; honouring it.

### Why not retire

1. **Sunk-cost is real but Wave 36 just landed.** v2→v4 migration shipped 6 days ago
   (Wave 36-A 2026-04-22 → Wave 36-C 2026-04-28). Retiring after a major migration
   that *is* working would be thrashing.
2. **Cost-to-keep is currently zero** for default users (lazy + flag-gated + non-precached).
3. **The retirement spec in plan §5(B) is invasive**: removes `app/src/llm/`, the
   classifier asset build, `public/classifier/`, drops the `@huggingface/transformers`
   dep. That is a meaningful diff to ship without first having tried the gate the
   Wave-35 instrument was built to drive.
4. **Plan §1.4 forbids UI files in W40** (W41 is parallel). Even if we wanted to retire,
   the badge UI hook (`finding-llm-badge`, `HybridFeedbackButton`,
   `HybridPrecisionPanel`) would be left as orphan no-ops dispatching against an
   `evidence` shape that nothing produces. The plan acknowledges this as "leave UI
   intact; let badge no-op gracefully" — that *works*, but it pushes a real cleanup
   into a future wave anyway. Hold avoids two waves of half-state.

### Why hold (and why this trigger)

- The hybrid-stats CLI is already the agreed instrument (`npm run hybrid:stats`) and
  its `fires ≥ 10` threshold is the Wave 35 gate.
- The trigger is **objective and machine-checkable** — anyone re-running the CLI sees
  the same decision.
- The Wave-50 backstop prevents indefinite drift (the §8 risk: *"Decision is 'hold'
  without a trigger → indefinite drift"*).
- The follow-up actions are pre-specified per outcome: `ACT` → invest wave; `NO-OP`
  with fires ≥ 10 → keep; sustained zero-fires under real load → retire.

## Action shipped

This document. Plan §5(C) — "If (C) Hold: zero code changes. Decision doc only."

## Verification

- `npm run typecheck` — green.
- `npm run lint` — green (0 warnings).
- `npm test` — green.
- No source / config / dep edits; `npm run build` unchanged from `origin/main`.

## Cross-reference

- Wave 35 plan + PR #148 (gate definition + first NO-OP)
- Wave 36 PRs #149–155 (transformers v2→v4 migration; the path is current)
- Wave 38 report `docs/wave38-bundle-perf-report.md` (bundle accounting)
- `docs/BACKLOG.md` "Wave 35 follow-ups" — re-run row already exists; this trigger
  supersedes / formalizes it.

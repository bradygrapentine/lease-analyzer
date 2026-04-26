# Wave 26 — Housekeeping

**Goal:** invest in the codebase rather than the product. Push unit
coverage past 90% on branches, add user-flow e2e specs that exercise
paths the unit suite can't, work through the npm-audit findings, do a
controlled backlog/roadmap refresh, and tackle one focused tech-debt
slice. **Not** a feature wave — every change here is in service of
keeping the codebase honest enough to keep shipping fast.

## Scope-shaping decisions (READ BEFORE APPROVING)

The user request named six work areas (coverage, flow tests, backlog
extension, setup docs, tech debt, security review). Six areas in one
wave is too wide — each becomes shallow and the wave drags. The plan
below collapses them into three parts that share a theme per part:

1. **Part A — coverage + flow tests** (the testing axis).
2. **Part B — security + tech debt** (the dependency / health axis).
3. **Part C — backlog refresh + setup docs** (the documentation axis).

Each part has a cap; what doesn't fit rolls to Wave 27. The TODO
triage line item is folded into Part B's tech-debt sweep — `grep -rn
"TODO|FIXME|XXX|HACK" app/src` reports **0 hits** at plan time, so
that line item is already done; the sweep verifies the count holds
post-Wave-26 and adjusts the contract if hits reappear.

## Hard caps summary

| Part | Cap |
|------|-----|
| A | ≤ 4 src files touched for coverage; ≤ 4 new unit-test files; 2 new component flow tests in vitest; branch floor bump 89→90 contingent on actuals ≥ 90.5%; **no e2e here** |
| B | npm audit triage: write up findings + decisions in SECURITY.md; bump what's bumpable without a breaking change; 1 surgical refactor on the lowest-branch App hook (≤ 1 src file + test); **no breaking dep upgrades** (those are Wave 27 if needed) |
| C | 2 new e2e flow specs (annotation + redline); SETUP.md refresh for the Phase 18 path now that it works end-to-end; backlog section refresh from the current `ROADMAP.md` "Forward phases (15+)"; **no new product features** |

## Pre-flight

1. Wave 25 (A/B/C + plan + Phase 18 loader fix #102) merged. Wave 26
   starts from `main` at or after #102's merge SHA.
2. `cd app && npm run typecheck && npm run lint && npm run test:coverage`
   green; branches actual at **89.64%** (post-Wave-25).
3. `npm run check:budget && npm run check:csp` green.
4. Default e2e: 4 passed, 1 skipped (`hybrid-golden.spec.ts`
   real-model gated). Verify locally.
5. Read each part's cap. Caps are contracts.

## Parts (A, B, C all parallel-safe — different files, different axes)

### Part A — coverage push to 90%+ + 2 flow tests

**Branch:** `wave26-coverage-push`

**Cap:** **≤ 4 src files** touched for coverage (only if the new test
exposes a real bug); **≤ 4 new unit-test files**; **2 new component
flow tests** in vitest; branch floor bump 89→90 contingent on actual
≥ 90.5%. **NO e2e here** — that's Part C.

**Approach:**

Audit lowest-branch files first; the gap to 90% is small (89.64% →
90% is ~0.4 points), so a focused pass on 3-4 files moves the needle:

| File | Branch % | Likely gap |
|------|----------|------------|
| `app/src/parser/extractPages.ts` | 57.89 | error paths, page-extraction edge cases |
| `app/src/worker/handleRequest.ts` | 50.00 | error / unknown-message branches |
| `app/src/compare/similarity.ts` | 72.00 | edge cases on empty / tiny docs |
| `app/src/App/appHelpers.ts` | 82.22 | conditional branches in helper utilities |

For each: read the file, identify the uncovered branches, write a
small test or two that exercise them, never modify the source unless
the new test surfaces a real bug. **Do not** add tests for unreachable
defensive guards (Wave 24-C established that policy).

The 2 new component flow tests target paths the unit suite under-tests
because they involve multi-component coordination:

- **Flow 1 — annotation round-trip.** Mount `<App />` with an
  in-memory IDB. Upload sample bytes → analyze → click finding →
  add note → verify note persists across `unmount` + `remount`. Pins
  the IDB ↔ UI handoff on the annotation path.
- **Flow 2 — severity-override → reanalyze.** Mount `<App />`,
  upload, set a severity override on one rule, verify findings
  panel re-renders with the override applied (deterministic; no
  classifier). Pins the `useReanalyzeOnRulesChange` ↔ pipeline
  handoff.

**Files:**

- `app/src/parser/extractPages.test.ts` — coverage extension.
- `app/src/worker/handleRequest.test.ts` — coverage extension.
- `app/src/compare/similarity.test.ts` — coverage extension.
- `app/src/App/appHelpers.test.ts` — coverage extension.
- `app/src/App.flows.test.tsx` — new file with the 2 flow tests.
- `app/vite.config.ts` — `branches: 89` → `90` IFF actuals ≥ 90.5%.
- `docs/TESTING.md` — actuals refresh.

**Tests / verify:**

- `npm run test:coverage` shows branches ≥ 90.5%; if not, **SKIP**
  the floor bump and document.
- All existing tests still pass (no source changes unless a real
  bug surfaces).
- New flow tests run in under 5s combined.

**Out of scope:** rewriting the IDB test harness; jumping to ≥ 95%
on branches (the structural ceilings — defensive `?? 0` guards in
parser/matchers — make 95% expensive); a11y test additions (the
`vitest-axe` gate already covers that axis).

### Part B — security audit + tech debt sweep

**Branch:** `wave26-security-tech-debt`

**Cap:** npm audit triage written up in `SECURITY.md` (1 new section);
bump what's bumpable WITHOUT a breaking change; **NO breaking dep
upgrades** (those are Wave 27 if we decide to take them); **1 surgical
refactor** on `appHelpers.ts` (the lowest-branch App hook) limited to
≤ 1 src file + ≤ 1 test extension; verify TODO/FIXME count stays at
**0**.

**Approach:**

`npm audit` reports 4 critical + 9 moderate at plan time. Categorize:

- **Critical: `protobufjs <7.5.5`** (via `@xenova/transformers >= 2.0.2`).
  The advisory is "Arbitrary code execution in `protobufjs.parse()`";
  Phase 18 never calls that API (we use `pipeline()` for embedding,
  not protobuf parsing). The "fix" downgrades transformers to 2.0.1
  which removes our model. **Decision (Wave 26-B):** accept risk,
  document in SECURITY.md, schedule a re-audit when transformers
  ships an upstream fix.
- **Moderate: `esbuild` / `vite` chain via vite-plugin-pwa + vitest +
  @vitest/coverage-v8.** The advisory is "esbuild dev server allows
  cross-origin reads"; only relevant in dev mode, not production. The
  fix requires `vite@8` (breaking; we're on vite 5). **Decision:**
  accept dev-only risk, document, plan vite-7-or-8 upgrade as its own
  Wave 27 candidate (pre-flight: storybook 8 + vite-plugin-pwa
  compatibility).
- Anything we MISSED: re-run `npm audit` and re-categorize.

Tech-debt slice: `appHelpers.ts` sits at 82.22% branch coverage. Read
it; identify whether the gap is testable (real branches we missed) or
unreachable (defensive guards). If testable, add the missing case in
Part A's coverage pass and skip the refactor here. If unreachable AND
the file has accumulated dead-code / over-defensive patterns, do a
surgical cleanup pass (≤ 1 file).

**Files:**

- `docs/SECURITY.md` — new section "§N npm audit standing decisions"
  with the categorization above + revisit triggers + dates.
- `app/package.json` / `app/package-lock.json` — only if a non-breaking
  bump exists (`npm update --save` style, not `npm audit fix --force`).
- `app/src/App/appHelpers.ts` — surgical cleanup IFF Part A surfaces
  unreachable guards there.
- `app/src/App/appHelpers.test.ts` — extension if cleanup happens.
- `docs/BACKLOG.md` — append to "Known unknowns / risk register" with
  the audit decisions and the Wave 27 vite-upgrade pointer.

**Tests / verify:**

- `npm audit` post-Part-B shows the same critical + moderate counts
  (we're documenting, not silencing) OR a lower count if a non-breaking
  bump cleared something.
- All gates green (typecheck, lint, tests, budget, CSP).
- TODO sweep: `grep -rEn "TODO|FIXME|XXX|HACK" app/src --include='*.ts'
  --include='*.tsx' | wc -l` returns **0**. If non-zero post-Wave-26,
  triage each into a backlog entry.

**Out of scope:** the breaking dep upgrade itself (vite 7/8); a CSP
re-audit (Wave 23-C just did one); secrets scanning (separate concern,
existing security workflow handles it).

### Part C — backlog + setup doc refresh + 2 e2e flow specs

**Branch:** `wave26-docs-and-e2e`

**Cap:** **2 new e2e flow specs** under `tests/e2e/` (annotation flow,
redline flow); **SETUP.md refresh** for the Phase 18 path now that the
loader works end-to-end (#102); **BACKLOG.md** gets a new section for
the next coherent moves derived from `ROADMAP.md` "Forward phases
(15+)"; **no new product features** — every change is documentation
or test.

**Approach:**

E2E specs (mirror Wave 25-A/C structure — committed to `tests/e2e/`,
chromium project, no new deps):

- **`tests/e2e/annotation-flow.spec.ts`** — sample lease → click
  finding → add note via the annotations panel → reload page →
  verify note persists. The Wave 26-A vitest flow test covers
  same-session round-trip; this e2e covers cross-session via real
  IndexedDB.
- **`tests/e2e/redline-flow.spec.ts`** — sample lease → switch to
  Redline view → verify the redline editor mounts and the
  selected-finding paragraph is in the active document.

SETUP.md refresh:

- Note that `npm run build:classifier-assets` now also drops
  `ort-wasm-simd.wasm` into `public/classifier/onnx-runtime/` (Wave
  25 fix) — the existing copy says "downloads ~17.5 MiB" which
  understates by ~10 MiB.
- Add a "Verify Phase 18 works" snippet that runs the gated
  hybrid-golden spec.
- Cross-link `docs/SECURITY.md` from the troubleshooting section
  for the audit-decisions content Part B adds.

BACKLOG refresh:

- Walk `ROADMAP.md` "Forward phases (15+)" and convert any
  not-yet-tracked items into `[ ]` entries under appropriate
  sections. Don't invent scope — surface what the roadmap already
  describes.
- Update the "Current footprint" table to reflect post-Wave-25
  numbers (test count, App.tsx line count if changed by Part A).

**Files:**

- `tests/e2e/annotation-flow.spec.ts` — new file, ~80 lines.
- `tests/e2e/redline-flow.spec.ts` — new file, ~60 lines.
- `docs/SETUP.md` — refresh: Phase 18 paragraph, troubleshooting
  cross-link.
- `docs/BACKLOG.md` — new entries from ROADMAP "Forward phases";
  current-footprint table refresh.

**Tests / verify:**

- Full chromium e2e suite green (now 6 specs: 5 in main flow + 1
  gated real-model = 5 passing + 1 skipped).
- Each new spec under 5s.
- BACKLOG diff is additive — no entries removed without justification
  in the commit body.

**Out of scope:** documenting the Wave 25-C ONNX runtime nuances
beyond a short SETUP note (those live in commit history and the
loader.ts header); refactoring SECURITY.md beyond Part B's new
section; touching SYSTEM_DESIGN.md (separate doc, separate review).

## Merge order

A, B, C are parallel-safe (different files, different axes). Suggested
sequencing for review legibility:

```
A    (coverage push + flow tests)
B    (security audit writeup + tech debt slice)
C    (e2e specs + docs)
```

A first if the floor bump succeeds — locks in the new coverage
contract before B/C land any tests. B and C can swap order without
issue.

## TDD recommendation

**Direct (single Opus author) for all three.** Each part has judgment
calls — which uncovered branches are worth testing in A, what to
write in SECURITY.md in B, which roadmap items to elevate in C.
Subagent dispatch overhead exceeds the parallelism gain.

## Done definition

- Part A: branches actual ≥ 90.5%; floor bumped to 90 (or SKIPPED
  with the actual recorded). 2 new flow tests in `App.flows.test.tsx`
  pin the annotation round-trip + severity-override reanalyze paths.
- Part B: SECURITY.md gains an "npm audit standing decisions"
  section. TODO count = 0 verified. `appHelpers.ts` cleanup
  shipped IFF Part A surfaces unreachable guards there.
- Part C: 2 new e2e specs green on chromium. SETUP.md updated for
  Phase 18 end-to-end. BACKLOG.md gains roadmap-derived entries
  + current-footprint refresh.
- All thresholds held; no behavior changes.
- No new IDB store, no new audit `kind`, no new dep, no new
  product UI.

## Wave 27 preview (out of scope here, queued)

- **Vite 7 or 8 upgrade** — clears the moderate dev-time esbuild
  advisory chain. Pre-flight: storybook 8 + vite-plugin-pwa
  compatibility check; coverage threshold revalidation.
- **`@xenova/transformers` upstream fix watch** — when transformers
  ships a release with `protobufjs >= 7.5.5`, take the bump and
  retire the SECURITY.md "accept risk" line.
- **Branches ≥ 91 push** if Wave 26-A's actuals sit at 90.7-90.9%
  with another guard sweep available.
- **Nightly real-model GHA job** that runs Wave 25-C's gated spec
  on a schedule — would have caught the Phase 18 loader bug earlier.

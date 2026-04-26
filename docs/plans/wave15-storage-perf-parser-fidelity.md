# Wave 15 — Storage perf + parser fidelity + reanalyze guard

**Goal:** finish the data-layer + parser items that have been on the
"tech-debt rocks" list since Wave 7. A compound IndexedDB index that
unlocks cheap portfolio filtering, the long-deferred reanalyze-staleness
guard for `App.tsx`, span-level highlight overlay refinements in the
PDF viewer, and a real scanned-PDF fixture that exercises the OCR path
end-to-end. No new product surface — paying down the data + parser
debt that keeps cropping up in the BACKLOG risk register.

## Scope boundary vs. Wave 14

Wave 15 owns:

- `app/src/storage/storage.ts` (schema bump v5 → v6 + new compound
  index), `app/src/storage/storage.test.ts` (migration test), and
  any consumer that reads the new index (`app/src/portfolio/*`).
- `app/src/App.tsx` (single hook addition for reanalyze-staleness),
  `app/src/App.test.tsx` (new test), and the new
  `app/src/hooks/useReanalyzeStaleness.ts` (NEW).
- `app/src/ui/PdfViewer.tsx`, `app/src/ui/PdfViewer.test.tsx`, and
  any span-coord helper under `app/src/parser/spans*` it touches.
- `app/src/parser/needsOcr.test.ts` (extension), one new fixture
  builder script under `app/scripts/`, and the resulting test asset
  under `app/src/__fixtures__/` if a binary commit is the cleanest
  path (per `docs/CLAUDE.md` "no binary fixtures" — pre-flight
  decides).
- `docs/SYSTEM_DESIGN.md` IDB landscape subsection only (the v6
  bump). No other doc changes.

Wave 15 does **NOT** touch:

- Repo-root `package.json`, `playwright.config.ts`, `tests/e2e/`,
  `.github/workflows/`, `docs/RELEASING.md`, `docs/SECURITY.md`,
  `app/src/test/` — those belong to Wave 14.
- Any rule pack matchers, signing modules, or audit log internals.

Soft point of contact with Wave 14: both waves touch
`docs/BACKLOG.md` (different rows — Wave 14 ticks governance + a11y;
Wave 15 ticks storage / App.tsx / parser rows). Resolvable at merge.

## Pre-flight

1. Wave 12 (all 4 parts) and Wave 13 (all 4 parts) merged. Wave 13
   does not change the IDB schema, so the v5 → v6 migration in
   Wave 15-A starts from a stable baseline.
2. `cd app && npm run typecheck && npm run lint && npm test:coverage`
   is green on `main`.
3. Confirm `app/src/storage/storage.ts` is currently at IDB version 5
   (post-Wave 10-B). If a subsequent wave bumps it, recompute the
   migration target version in Part A's spec before dispatch.
4. Confirm `app/src/App.tsx` is currently between ~900 and ~1000
   lines. The reanalyze-staleness guard in Part B is the **only**
   App.tsx touch this wave; full decomposition is explicitly deferred
   to a later wave (Phase 18 candidate).
5. Confirm `app/src/ui/PdfViewer.tsx` still uses the canvas-overlay
   highlight model (Phase 1 / Phase 6). Wave 15-C refines the overlay
   math; it does not replace the canvas approach.
6. Decide the binary-fixture policy for Part D before dispatch:
   either commit a tiny scanned PDF under `app/src/__fixtures__/`
   (current convention is "no binary fixtures") OR generate the
   fixture at test setup time via a `pdf-lib` + Image build step.
   Default to the build-step approach; only commit a binary if the
   build step takes > 2 s.

## Parts (parallel-safe)

### Part A — Compound IDB index on LeaseRecord

**Branch:** `wave15-leaserecord-index`

**Files:**

- `app/src/storage/storage.ts` — bump `DB_VERSION` from 5 to 6 in
  the standard `if (oldVersion < 6)` block. Add the compound index
  `byFindingCountAndPackVersion` on `(findingCount, rulePackVersion)`
  to the existing `leases` store. Extend `listLeases(opts)` with
  optional `{ minFindingCount?: number; rulePackVersion?: string }`
  filter parameters that route through the new index when supplied
  (cursor over the compound index range; full scan fallback when
  the caller passes nothing).
- `app/src/storage/storage.test.ts` — extend with:
  - Migration test: open the DB at v5 with seeded data, close, reopen
    at v6, assert the compound index exists and yields the same rows.
  - Filter tests: `minFindingCount`, `rulePackVersion`, both combined.
  - Regression: callers that pass no filter still receive every lease
    (no behavior drift).
- `app/src/portfolio/listLeasesWithFilters.ts` (NEW, optional) — only
  if a portfolio consumer wants the typed wrapper. Pure function over
  `listLeases`. Skip if the existing API call sites are happy with
  the new optional arg.
- `docs/SYSTEM_DESIGN.md` IDB landscape subsection — bump the v5 →
  v6 line and document the new index purpose.
- `docs/BACKLOG.md` — flip `[ ] Secondary IndexedDB index on
  LeaseRecord.findingCount + rulePackVersion` to `[x]` with a
  2026-XX-XX date and a pointer to the new index name.

**Tests / verify:**

- v5 → v6 migration is forward-only; existing rows survive.
- New filter parameters are correctly typed and surface a regression
  if `findingCount` drifts off the persisted shape.
- `npm run test:coverage` floors hold (the new code is in a
  high-coverage module).

**Out of scope:** Portfolio UI changes that consume the new filters
(separate UX wave); rewriting `findingCount` semantics; index on
the standard-suite store (Wave 10-C added that store and it's
already small enough to scan).

### Part B — Reanalyze-staleness guard

**Branch:** `wave15-reanalyze-staleness`

**Files:**

- `app/src/hooks/useReanalyzeStaleness.ts` (NEW) — pure-ish custom
  hook: takes `{ activeRules, jurisdictions, severityOverrides,
  reanalyze }` props and triggers `reanalyze()` whenever any of the
  rule-affecting inputs change. Debounce by one microtask so an
  atomic `setRules` + `setJurisdiction` pair doesn't fire two
  reanalyses.
- `app/src/hooks/useReanalyzeStaleness.test.ts` (NEW) — RTL
  `renderHook` cases:
  - Activates on `activeRules` mutation.
  - Activates on jurisdiction toggle.
  - Activates on severity-override mutation.
  - **Does not** activate when only the lease changes (that already
    triggers `pipeline.analyze` via the upload path).
  - Coalesces atomic batched updates.
- `app/src/App.tsx` — wire the new hook in **one place** below the
  existing `usePipeline` call. The wire-up is additive — every existing
  reanalyze call site can stay until a follow-up cleanup wave removes
  the manual `pipeline.reanalyze()` invocations. Document each surviving
  manual call with a `// TODO(wave-N+1): remove after staleness guard
  proves out` comment so the cleanup PR has a grep target.
- `app/src/App.test.tsx` — extend with a single integration assertion:
  toggling a rule via the existing PackManager UI surface fires
  `pipeline.reanalyze` exactly once.
- `docs/BACKLOG.md` — flip `[ ] Reanalyze-staleness guard` to `[x]`
  with a 2026-XX-XX date and a pointer to `useReanalyzeStaleness.ts`.

**Tests / verify:**

- `useReanalyzeStaleness.test.ts` passes; existing App.tsx tests
  unchanged.
- The new hook adds no new audit `kind` strings (reanalyze emits
  the existing `analyze` kind via `pipeline.reanalyze`).
- Bundle-size budget unchanged (< 1 KiB hook addition).

**Out of scope:** removing the manual `pipeline.reanalyze()` calls
that the new hook obsoletes (separate cleanup PR — keeping the
double-fire is benign in the short term and avoids merge churn);
broader App.tsx decomposition (Phase 18 candidate, not this wave).

### Part C — PdfViewer span-highlight overlay refinement

**Branch:** `wave15-pdfviewer-highlight`

**Files:**

- `app/src/ui/PdfViewer.tsx` — refine the highlight overlay:
  - Use the parser's per-span bbox (already in `LeaseDocument` from
    Phase 8) instead of the paragraph bbox when a finding's
    `spans[]` field is populated.
  - Clip overlay rectangles to the canvas viewport (today they can
    extend past the right margin on landscape pages).
  - Smooth-scroll the matching span into view on selection (existing
    behavior is `scrollIntoView({ block: 'center' })` — keep that
    contract; just add `behavior: 'smooth'` and a
    `prefers-reduced-motion` opt-out).
- `app/src/ui/PdfViewer.test.tsx` — extend with:
  - Span-bbox path renders one rect per span when `finding.spans` is
    populated; falls back to paragraph bbox otherwise.
  - Reduced-motion path uses `behavior: 'auto'`.
  - Right-margin clipping never produces a rect that extends past
    `canvas.width`.
- `app/src/parser/spans.ts` (NEW or extended if it exists) — if the
  bbox math is non-trivial, hoist it to a pure module so the unit
  test can pin it without rendering.

**Tests / verify:**

- Existing PdfViewer tests pass unchanged.
- The new tests pin the bbox math without canvas rendering.
- No bundle-budget impact (< 500 B viewer code growth).

**Out of scope:** virtualization of the per-page render (still in
the streaming-render pattern from Wave 6-B); WebGL overlay (out of
scope for the PWA contract); pdf.js version bumps.

### Part D — Real scanned-PDF fixture + needsOcr negative-path test

**Branch:** `wave15-scanned-fixture`

**Files:**

- `app/scripts/build-scanned-fixture.mjs` (NEW) — generates a
  synthetic "scanned" PDF: rasterizes a small text PNG (say
  100 × 30 px, "RESIDENTIAL LEASE" in block letters) and embeds it
  as the only content of a single PDF page via `pdf-lib`. Output to
  `app/src/__fixtures__/scanned-residential.pdf` (or a
  vitest-managed temp path; pre-flight decided per the policy in
  step 6 above).
- `app/package.json` — add a `build:scanned-fixture` script entry
  pointing at the new builder. **Do not** add it to `postinstall`;
  the fixture is only needed for the new test.
- `app/src/parser/needsOcr.test.ts` — extend with:
  - Positive: the new scanned fixture is detected as
    `likelyScanned: true` with avg chars/page below the threshold.
  - Negative: the existing residential textual fixture stays at
    `likelyScanned: false` (regression — already covered, just
    re-pin alongside the positive case).
- `app/src/__fixtures__/scanned-residential.pdf` — committed binary
  **only if** the build step exceeds 2 s on the CI runner; otherwise
  the test invokes the builder in `beforeAll` and writes to a temp
  path. Document the decision in the commit body.
- No production-source changes. `needsOcr.ts` is already covered;
  this part adds the missing detection-side fixture without changing
  behavior.

**Tests / verify:**

- `npm test -- needsOcr` is green; no new flake.
- Coverage thresholds hold.
- If the binary fixture is committed, `app/src/__fixtures__/*.pdf`
  is added to the coverage exclude list (it shouldn't appear there
  in any case, since coverage targets `src/**/*.{ts,tsx}`).

**Out of scope:** wiring the fixture through the OCR-roundtrip path
(existing tests already cover the OCR happy path against synthesized
fixtures); committing actual photo-of-paper scans (privacy + size
concerns); cross-browser OCR tests.

## Merge order

A, C, D are independent of each other (storage, viewer, parser
fixture — disjoint subtrees). B touches `App.tsx` solo and lands
last to absorb any minor diff churn from `usePipeline` wiring or
the new hook signature.

**Suggested: A → C → D → B.**

Rationale: A is the highest-risk (schema bump) — landing it first
gives subsequent parts a stable IDB baseline to test against. C and
D are pure-additive and parallel-safe. B lands last because it's the
only part that touches `App.tsx`; the App-level integration test
benefits from A's filter API being already merged.

## TDD recommendation

**Direct dispatch (parallel subagents) for A, C, D. Optional TDD
escalation for B** if past App.tsx waves in this session have produced
"mostly_achieved" outcomes — the reanalyze guard is a behavioral hook
where a creative-license implementation can drift from the spec
("debounces by one microtask" is easy to mis-implement as a 16ms
RAF or a no-op). If TDD is chosen for B:

- spec-author writes `useReanalyzeStaleness.test.ts` from the
  acceptance bullets above on `tdd-wave/15/specs-reanalyze-staleness`.
- implementer iterates the hook + App.tsx wire-up against that spec.

A, C, D are crisp enough to run direct.

## Done definition

- All four PRs merged.
- IDB at v6 in `app/src/storage/storage.ts`; migration test green.
- `useReanalyzeStaleness` hook owns the rule-mutation → reanalyze
  edge; `App.tsx` mounts it once.
- `PdfViewer` highlights individual spans when `finding.spans` is
  populated; respects `prefers-reduced-motion`.
- `needsOcr` test suite covers the scanned positive path with a
  fixture-built input.
- BACKLOG ticks: secondary IDB index, reanalyze-staleness guard,
  scanned-PDF fixture (Phase 1 row).
- ROADMAP unchanged (no new phase).
- `docs/SYSTEM_DESIGN.md` IDB landscape line: `leaseguard` v5 → v6.
- No new audit `kind` strings, no new IDB stores beyond the existing
  schema bump on `leases`, no `app/src/App.tsx` touches outside the
  single hook wire-up in Part B.

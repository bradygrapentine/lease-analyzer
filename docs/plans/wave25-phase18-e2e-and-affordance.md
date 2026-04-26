# Wave 25 — Phase 18 e2e scaffold + click-to-explain + real-model golden

**Goal:** finish the Phase 18 verification story by standing up the
Playwright e2e harness this codebase has been deferring since Wave 14
and using it to land the real-model golden case the plan's been
rolling forward since Wave 23. Add a single small product affordance
— click-to-explain on the hybrid badge — so the `evidence` payload
becomes visible to the user, not just to audit consumers.

The branch-threshold push (≥ 90) is **deferred to Wave 26+** —
floors should sit on freshly-shipped actuals for at least one wave
before pushing again.

## Scope boundary

Wave 25 owns:

- `app/package.json` (Part A — adds `@playwright/test`, scripts).
- `app/playwright.config.ts` (Part A — new file, the only new
  config in this wave).
- `app/e2e/smoke.spec.ts` (Part A — new file, deterministic upload
  golden case using a fixture PDF generated inline via pdf-lib).
- `app/e2e/fixtures/` (Part A — generated fixtures live here; tiny,
  inline-built at suite startup).
- `.github/workflows/ci.yml` (Part A — one job that runs the
  Playwright smoke against the built `dist/`; the real-model case
  in Part C is gated behind a separate job that won't break PR CI
  if it flakes).
- `app/src/ui/FindingsPanel.tsx` (Part B — adds a click handler on
  the hybrid badge that toggles a small inline detail panel showing
  the `evidence` payload).
- `app/src/ui/FindingsPanel.test.tsx` (Part B).
- `app/e2e/hybrid-golden.spec.ts` (Part C — new file, the real
  MiniLM-L3 case behind a `RUN_REAL_MODEL=1` env gate so it stays
  off PR CI until Wave 26 wires it into a nightly job).
- `docs/TESTING.md` (Part A + C — adds the e2e section + how to
  run the gated real-model case).
- `docs/CLAUDE.md` (Part B — one line on the click-to-explain
  affordance contract).

Wave 25 does **NOT** touch:

- The Web Worker source. Phase 18 stays main-thread; worker-path
  classifier moves to Wave 26+ if and only if the main-thread
  approach proves to block the UI on real leases.
- IDB schema. The click-to-explain affordance reads from the
  existing `Finding.evidence` field and emits no new audit `kind`.
- Branch threshold floors. Just bumped 88→89 in Wave 24-C; let
  actuals settle before pushing toward 90.
- New product UI panels. The click-to-explain detail is an inline
  disclosure inside the existing finding row, not a new panel.
- Tauri / desktop wrapper changes. Playwright tests target the
  PWA build only.
- Replacing existing vitest tests with Playwright. The two layers
  coexist — vitest stays the unit/integration tier, Playwright
  is the smoke-and-real-browser tier.

## Pre-flight

1. Wave 24 (A/B/C + plan) merged. Wave 25 starts from `main` at or
   after Wave 24-C's merge SHA.
2. `cd app && npm run typecheck && npm run lint && npm run test:coverage`
   green on `main`. Branches actual ≥ 89.5% (post-24-C buffer).
3. Verify `app/e2e/` does NOT yet exist and `playwright` is not in
   `package.json` — Part A creates both.
4. Verify the build still emits `dist/` (`npm run build` green) —
   Playwright runs the production bundle, not the dev server.
5. Confirm GitHub Actions has a working Node 20 setup (the
   existing CI job already uses `actions/setup-node@v4` with
   Node 20; Playwright needs ≥ 18).

## Parts (A is precondition for C; B parallel-safe with both)

### Part A — Playwright scaffold + deterministic smoke

**Branch:** `wave25-playwright-scaffold`

**Cap:** **1 new dep** (`@playwright/test`), **3 new files**
(`playwright.config.ts`, `e2e/smoke.spec.ts`, fixture builder if
not inline), **2 src/config edits** (`package.json` scripts,
`.github/workflows/ci.yml` smoke job). **No production source
changes** — the smoke test exercises the existing build.

**Approach:**

```
npm i -D @playwright/test
npx playwright install --with-deps chromium
```

Add scripts:

```json
"e2e": "playwright test",
"e2e:headed": "playwright test --headed"
```

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

`e2e/smoke.spec.ts`:

- Boot the preview server (Playwright's `webServer` handles this).
- Navigate to `/`; assert the upload prompt is visible.
- Build a small PDF in-memory via `pdf-lib` (already a dep) with a
  paragraph that triggers a known deterministic rule
  (`auto-renew`).
- Use `setInputFiles` with a `Buffer` to upload the synthesized
  PDF.
- Assert the FindingsPanel renders the expected finding within
  10 s.

CI:

- New job `e2e-smoke` in `.github/workflows/ci.yml`. Runs
  `npm ci`, `npm run build`, `npx playwright install --with-deps
  chromium`, `npm run e2e -- --grep '@smoke'`. Tagged
  `@smoke` so Part C's heavier case stays out by default.

**Files:**

- `app/package.json` — `@playwright/test` devDep + `e2e` /
  `e2e:headed` scripts.
- `app/playwright.config.ts` — new file.
- `app/e2e/smoke.spec.ts` — new file, ~80 lines including
  fixture builder.
- `.github/workflows/ci.yml` — new `e2e-smoke` job; existing
  jobs unchanged.

**Tests / verify:**

- `npm run e2e` green locally.
- `npm run typecheck && npm run lint && npm run test:coverage` all
  hold (Part A adds zero unit-test impact; coverage doesn't
  regress because no production source changes).
- Bundle budget unchanged.
- `e2e-smoke` CI job runs in under 90 s end-to-end.

**Out of scope:** parallel browser projects (chromium-only for
now); visual-regression snapshots (no screenshots committed);
mobile device emulation; trace-viewer artifacts beyond on-retry.

### Part B — click-to-explain affordance on the hybrid badge

**Branch:** `wave25-explain-affordance`

**Cap:** **1 src edit** (`FindingsPanel.tsx`) + **1 test
extension**. **0 new files.** **1 doc line** in `CLAUDE.md`. No
new audit `kind`, no new IDB writes — the affordance is
read-only over `finding.evidence`.

**Approach:**

The Wave 24-B badge is a static span. Wave 25-B makes it a
`<button>` (or wraps it) that toggles a small inline disclosure
showing:

- Model id (`evidence.modelId`)
- Similarity (`evidence.similarity`, formatted as percentage)
- Threshold context: "Above the 70% similarity floor" — the
  threshold is a runtime constant in `hybridAnalyze.ts`; the
  affordance can hardcode the default since it's a display
  detail, not authoritative.

Disclosure pattern matches the existing "What this means"
plain-English disclosure (`aria-expanded`, button + sibling
`<p>`). Reuses the `openExplainers` set keyed by `findingKey`
with a `:hybrid` suffix to avoid collision.

**Files:**

- `app/src/ui/FindingsPanel.tsx` — promote the badge to a
  button; add the inline detail block when expanded.
- `app/src/ui/FindingsPanel.test.tsx` — add 2 cases:
  - Click on the badge expands the detail; aria-expanded
    flips true; modelId + similarity visible.
  - Click again collapses it.
- `docs/CLAUDE.md` — one line under the Wave 24-B badge bullet
  noting the affordance contract.

**Tests / verify:**

- All 24 existing FindingsPanel tests pass unchanged.
- New 2 cases pin the disclosure shape.
- a11y gate (`vitest-axe`) green — the new button has a real
  `aria-label`.

**Out of scope:** linking to the audit log entry that fired for
this finding (Phase 18 audit lookup is a Wave 26+ piece);
i18n for the new strings (English-only; existing `useI18n` flow
can pick them up later); deep-link / URL-state for which badge
is expanded.

### Part C — real-model golden e2e (env-gated)

**Branch:** `wave25-real-model-golden`

**Cap:** **1 new file** (`e2e/hybrid-golden.spec.ts`). **0 src
changes.** **1 doc paragraph** in `TESTING.md` for how to run
locally. **No CI wiring** — Part C runs only when
`RUN_REAL_MODEL=1` is set; Wave 26 decides whether to add a
nightly job.

**Approach:**

```
RUN_REAL_MODEL=1 npm run e2e -- --grep '@real-model'
```

Test body:

1. Skip if `process.env.RUN_REAL_MODEL !== '1'`.
2. Drop the classifier asset bundle into `dist/classifier/`
   (downloaded once via `npm run build:classifier-assets` —
   pre-flight in the spec).
3. Boot preview server (already wired by Part A's config).
4. Navigate to `/?phase18=on`.
5. Upload a fixture PDF whose paragraphs paraphrase a known
   `auto-renew` clause without using the literal regex tokens —
   deterministic engine emits 0; classifier should emit 1.
6. Assert: at least one hybrid finding renders, its badge is
   present, and clicking the badge (Part B) reveals
   `Xenova/paraphrase-MiniLM-L3-v2` as the modelId.
7. Assert: zero CSP violations in the page console
   (`page.on('console', ...)`).

**Files:**

- `app/e2e/hybrid-golden.spec.ts` — new file, ~120 lines.
- `docs/TESTING.md` — one paragraph under the new e2e section
  on running the gated case + the asset prereq.

**Tests / verify:**

- `RUN_REAL_MODEL=1 npm run e2e` green locally with the
  classifier assets present.
- Without `RUN_REAL_MODEL`, the spec is skipped (zero failures
  on PR CI).
- Without the classifier asset bundle, the spec fails fast with
  a clear "run `npm run build:classifier-assets` first" message
  rather than mid-test on a 404.

**Out of scope:** wiring the gated case into a nightly GHA
schedule (Wave 26); model-version pinning beyond the existing
`DEFAULT_MODEL_ID` constant; cross-browser runs (chromium-only).

## Merge order

A is the precondition for C (C uses Part A's `playwright.config`
and webServer setup). B is parallel-safe with both — different
files, different code paths.

```
A    (Playwright scaffold + smoke)
   ↓                ↘
   ↓                  C (real-model golden, env-gated)
B    (click-to-explain affordance)
```

Suggested execution: A first (unblocks C), then B and C in
parallel (B is unit-test, C is e2e — no overlap).

## TDD recommendation

**Direct (single Opus author) for all three.** Each part has
judgment calls — the Playwright config shape and CI wiring in A,
the disclosure copy in B, the fixture-paraphrase calibration in C.
Subagent dispatch overhead exceeds the parallelism gain at this
size.

## Done definition

- Part A merged: `npm run e2e` green locally and on PR CI; smoke
  job under 90 s; no production source changes.
- Part B merged: hybrid badge is now interactive; clicking expands
  modelId + similarity; existing tests + a11y gate green.
- Part C merged: gated real-model spec exists, skipped by default,
  passes locally with `RUN_REAL_MODEL=1` and the classifier assets
  present; documented in `TESTING.md`.
- All thresholds held (stmt 95 / branch 89 / func 91 / line 95);
  no new IDB store, no new audit `kind`, no new product UI panel
  beyond the existing finding-row disclosure.
- Bundle budget unchanged.

## Hard caps summary

| Part | Cap |
|------|-----|
| A | 1 new dep + 3 new files + 2 src/config edits; no production source changes |
| B | 1 src edit + 1 test extension + 1 CLAUDE.md line; no new files; no new audit kind |
| C | 1 new e2e file + 1 doc paragraph; 0 src changes; env-gated (skipped by default on CI) |

If a cap is breached, ship what fits and roll the overflow to
Wave 26. Do not negotiate caps up from inside a part.

## Wave 26 preview (out of scope here, queued)

- **Nightly real-model GHA job** that runs Part C's gated spec
  on a schedule, posts failures to a dashboard, and gates a
  separate "real-model-verified" badge.
- **Worker-path classifier wiring** if Wave 25's main-thread
  approach proves to block the UI on large leases (decision
  comes after Part C's golden case ships and we have real
  latency numbers).
- **Branches ≥ 90 push** if post-Wave-25 actuals sit at
  89.7–89.9% with one more guard sweep available.
- **Audit-log linkage** on the click-to-explain affordance —
  the inline detail surfaces the `llm-classify` audit entry id
  alongside the evidence payload, with a "view in audit log"
  button.

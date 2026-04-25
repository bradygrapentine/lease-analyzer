# Wave 12 — Hygiene infrastructure

**Goal:** close the longest-standing CI / quality / governance gaps that
keep showing up on the open-items list but never make it into a feature
wave. Pre-commit hooks, an in-browser e2e smoke, the deferred tesseract
licensing closeout, and the App.panels coverage flake. None of this
ships new product surface — it pays down hygiene debt.

## Scope boundary vs. Wave 13

Wave 12 owns:

- Repo root: `package.json` (root), `.husky/`, `.lintstagedrc*`,
  `.gitignore` extensions for new tool caches.
- `.github/workflows/e2e.yml` (new) and any tweaks to `ci.yml` /
  `lighthouse.yml` it implies.
- `tests/e2e/` (new top-level dir) and Playwright config under
  `playwright.config.ts` (root).
- `docs/SECURITY.md` (new §5 for tesseract licensing) and a new
  `app/public/NOTICE` (or `THIRD_PARTY_LICENSES.md` at root) for
  third-party attribution.
- `app/src/App.panels.test.tsx` (flake fix only — no behavioral
  changes), `app/vitest.config.ts` (timeout / pool tweaks),
  `app/src/rules/golden.test.ts` (commercial-table golden expansion),
  `app/src/parser/testFixtures.ts` (additive synthesizer for
  table-rich commercial fixtures).

Wave 12 does NOT touch any file under `app/src/ui/`, `app/src/workflow/`,
or `app/src/storage/`. Those belong to Wave 13.

Soft point of contact: both waves bump `app/package.json` (Wave 12
adds `@playwright/test`, `lint-staged`, `husky` as devDeps; Wave 13
may extend `pdf-lib` usage but no new deps expected). Resolvable at
merge — additive in both directions.

## Pre-flight

1. Wave 10 + Wave 11 fully merged; ROADMAP shows Phase 14 + Phase 16
   Done. (Verified at plan time; Wave 12 starts from current main.)
2. `cd app && npm run typecheck && npm run lint && npm test` is green
   on `main`.
3. Confirm `app/src-tauri/` Tauri scaffold is still wired and the
   existing `.github/workflows/tauri.yml` job is the build of record
   — Wave 12 does NOT touch Tauri (existing CI is sufficient for
   now; Rust toolchain matrix expansion is a future wave).
4. Confirm `app/lighthouserc.json` already enforces a11y ≥ 0.95 +
   best-practices ≥ 0.9 thresholds. Wave 12 does NOT re-author
   lighthouse thresholds; the open BACKLOG item "Lighthouse a11y +
   PWA scores ≥ 95 in CI" is materially shipped — Wave 12 just ticks
   it during the BACKLOG sync.

## Parts (parallel-safe)

### Part A — Pre-commit lint-staged hook

**Branch:** `wave12-precommit`

**Files:**
- `package.json` (root, NEW if absent — workspace root currently has
  no package.json) OR add `husky` + `lint-staged` to `app/package.json`
  with a clearly-scoped `prepare` script. Pick whichever matches the
  repo's existing layout; document the choice in the commit body.
- `.husky/pre-commit` (new) — runs `lint-staged` only on staged files.
- `.lintstagedrc.json` (new) — globs `app/**/*.{ts,tsx}` →
  `cd app && eslint --fix`, `app/**/*.{ts,tsx,json,md}` →
  `prettier --write` if Prettier is wired (verify in pre-flight).
- `app/CLAUDE.md` and root `docs/CLAUDE.md` — short note in the
  "Commands" section: pre-commit runs `lint-staged`; CI is still
  authoritative.

**Tests / verify:**
- After install, a deliberately-broken `*.ts` edit fails the commit
  with an ESLint error and the commit is blocked.
- A purely-doc edit (`README.md`) commits cleanly without running
  ESLint on TS files.
- `git commit --no-verify` is documented in the CLAUDE.md note as the
  escape hatch — but is NOT the default and never used by the
  assistant per the global rules in `~/.claude/CLAUDE.md`.

**Out of scope:** moving CI gates into the pre-commit hook (CI is
authoritative — local hook is a fast feedback loop only); commitlint;
secret-scan hooks (separate hardening wave).

### Part B — Playwright e2e smoke test

**Branch:** `wave12-e2e-smoke`

**Files:**
- `package.json` (root, NEW if absent — see Part A) — add
  `@playwright/test` as a devDep at the root so the e2e runner is not
  inside the `app/` workspace.
- `playwright.config.ts` (root, new) — `webServer:` boots
  `cd app && npm run preview` on `http://127.0.0.1:4173`; `projects:`
  Chromium only for CI; `expect.timeout` 5s; retries 2 in CI, 0 local.
- `tests/e2e/golden.spec.ts` (new) — single happy-path smoke:
  1. Load app (`/`).
  2. Click "Try sample lease" button.
  3. Wait for findings panel to populate (assert at least one finding).
  4. Click first finding → assert PDF viewer scrolls to highlight.
  5. Open Portfolio view → assert grid renders.
  6. Open Audit log → assert ≥ 1 entry visible.
- `tests/e2e/README.md` (new) — how to run locally
  (`npx playwright test`), how the CI workflow gates PRs.
- `.github/workflows/e2e.yml` (new) — installs Node + browsers,
  builds `dist/` via `cd app && npm run build`, runs
  `npx playwright install --with-deps chromium`, then
  `npx playwright test`. Uploads the HTML report on failure.
- `.gitignore` — add `playwright-report/`, `test-results/`,
  `node_modules/.cache/playwright/`.

**Tests / verify:**
- `npx playwright test` passes locally against a built `dist/`.
- The workflow runs in <5min on a clean CI runner.
- A deliberately broken assertion in the spec fails the workflow
  (sanity-check the gate actually gates).

**Out of scope:** WebKit / Firefox matrix (Chromium-only this wave);
visual regression snapshots (would couple to design work that isn't
in scope); test parallelism beyond Playwright defaults; e2e for the
review-link / counter-sign / delta-packet flows (file-system
fixtures needed — separate wave).

### Part C — Tesseract licensing closeout (governance)

**Branch:** `wave12-tesseract-licensing`

**Files:**
- `app/public/NOTICE` (new) OR root `THIRD_PARTY_LICENSES.md` (new) —
  exact attribution text required by Apache-2.0 for
  `tesseract-core.wasm`, the worker script, and the eng/spa
  `traineddata` files. Pick one location; cross-reference from both
  `README.md` and `docs/SECURITY.md`.
- `app/src/ui/OcrPanel.tsx` (or wherever the OCR opt-in copy lives;
  read first, do NOT touch unrelated UI) — single sentence linking
  the in-app "Attempt OCR" affordance to the NOTICE file. If the
  link can't be added without restructuring the panel, defer to the
  next polish wave and just add a footer link in the global app
  shell. Document the choice in the commit body.
- `docs/SECURITY.md` — new §5 "Third-party assets and licensing"
  documenting: Apache-2.0 obligations satisfied via
  `app/public/NOTICE`; what counts as "redistribution" for the
  precached PWA case; the trigger for re-review (any new tesseract
  asset added — not the existing eng + es bundle).
- `docs/BACKLOG.md` — tick the "Licensing audit of tesseract assets"
  risk-register item with a `(2026-04-25)` decision date and pointer
  to `SECURITY.md` §5.

**Tests / verify:**
- `app/scripts/check-csp.mjs` (Wave 11-D) still passes — NOTICE
  is plaintext, no script/origin additions.
- A small unit test asserting that the NOTICE file exists at build
  time (e.g., a fixture-style test in `app/src/security/`) so a
  refactor that drops the file fails CI.

**Out of scope:** Argon2id migration of the encrypted-archive format
(separate v2-archive wave with its own threat model); release /
versioning policy (still open — outside this part's scope).

### Part D — Test infrastructure hardening

**Branch:** `wave12-test-infra`

**Files:**
- `app/src/App.panels.test.tsx` — fix the line-754 `getByRole('button',
  { name: /export v.../ })` flake. Likely root cause: the version
  history list has a race between IDB hydration and RTL query;
  resolve by either (a) `await screen.findByRole(...)` instead of
  `screen.getByRole(...)`, or (b) splitting the version-export and
  version-restore assertions into two `it()` blocks so the IDB
  hydration awaits land at test boundaries. Diagnose first; fix
  with the smaller change.
- `app/vitest.config.ts` — explicit `testTimeout: 15_000` on the
  panel-smoke test file only (via `test.timeout` per-file directive)
  so coverage instrumentation doesn't blow up. Do NOT raise the
  global default.
- `app/src/rules/golden.test.ts` — extend with a commercial-table
  fixture exercising rent-schedule + escalator-grid table detection.
  Today the commercial golden is a textual-only fixture (Wave 7-C).
- `app/src/parser/testFixtures.ts` — additive synthesizer
  `makeCommercialTableLease(opts)` that produces a pdf-lib lease with
  a rent schedule table on page 2 and an escalator grid on page 3.
- `docs/TESTING.md` — refresh the coverage floor numbers and note the
  per-file timeout exemption.

**Tests / verify:**
- `npm run test:coverage` is green for 5 consecutive runs locally
  without `--testTimeout` overrides.
- Commercial golden test asserts the table-detection findings appear
  AND that they don't appear in the residential golden (the standard
  not-in-other invariant from `docs/CLAUDE.md`).
- Existing residential golden untouched.

**Out of scope:** App.tsx decomposition (next dedicated wave);
reanalyze-staleness guard (couples to App.tsx, deferred); broader
v8 / coverage instrumentation tuning.

## Merge order

A, B, C, D are independent of each other. Suggested merge order
prioritizes the lowest-risk first:

**A → C → D → B**

Rationale: A is a config-only opt-in. C is doc-only with a tiny test.
D modifies one test file + one config field. B introduces the largest
surface (new top-level dir + new workflow) — land last when the
hygiene from A/D is in place.

## TDD recommendation

Mixed. **Run as direct implementation** (single session, sequential
parts) — there is no overlapping success-criteria pressure, no panel
tests to spec, and the parts are small. Reserve the spec-author
overhead for waves where multiple panels + pure modules need to be
pinned in advance.

If parallel pressure becomes useful: A and C can be background-direct
in parallel (no file overlap), with B and D land sequentially in the
same session.

## Done definition

- All four PRs merged.
- `npm run lint` runs via pre-commit on a sample edit (smoke verified
  by maintainer).
- `npx playwright test` is green in CI on a clean runner.
- `app/public/NOTICE` exists and is referenced from `README.md` +
  `docs/SECURITY.md` §5.
- `App.panels.test.tsx` runs without the line-754 flake across 5
  consecutive `npm run test:coverage` runs.
- BACKLOG ticks: Pre-commit hook, Playwright smoke test,
  Lighthouse a11y/PWA scores in CI (already shipped — confirm tick),
  tesseract licensing audit, App.panels.test.tsx flake item,
  commercial table golden.
- ROADMAP risk register updated: tesseract licensing → closed; only
  release/versioning policy remains open.
- No new IDB stores, no schema bumps, no `app/src/ui/` modifications.

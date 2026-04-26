# Wave 14 — CI hardening + governance

**Goal:** close the cross-platform / cross-browser / governance gaps
left after Waves 12 + 13. Tauri desktop CI matrix beyond Linux, an e2e
matrix beyond Chromium, an explicit release/versioning policy, and an
automated a11y gate. None of this ships new product surface — it's
quality + trust infrastructure.

## Scope boundary vs. Wave 15

Wave 14 owns:

- `.github/workflows/tauri.yml`, `.github/workflows/e2e.yml`, and any
  new `.github/workflows/*.yml` it implies.
- `app/src-tauri/` (cross-platform config only — no new Rust code).
- `playwright.config.ts` (root) and `tests/e2e/` (extending the smoke +
  adding an a11y spec; **not** rewriting `golden.spec.ts`'s assertions).
- `docs/RELEASING.md` (NEW), `docs/SECURITY.md` §6 (NEW — versioning
  policy section after §5 third-party assets), and the
  governance-side ticks in `docs/BACKLOG.md` / `docs/ROADMAP.md`.
- `app/src/test/axe.ts` (NEW), `app/src/test/setup.ts` (extension only),
  one new a11y unit test under `app/src/ui/` (additive — touches no
  existing panel implementation).
- Root `package.json` and `app/package.json` devDep additions (axe +
  any a11y helper).

Wave 14 does **NOT** touch:

- `app/src/storage/`, `app/src/parser/`, `app/src/ui/PdfViewer*`,
  `app/src/App.tsx` — those belong to Wave 15.
- Any production rule-pack matchers, IDB schemas, or workflow modules.

Soft point of contact with Wave 15: both waves bump `app/package.json`
(Wave 14 adds `axe-core` / `vitest-axe`; Wave 15 has no new deps
expected). Merge-order resolves with no semantic conflict.

## Pre-flight

1. Wave 12 (all 4 parts) and Wave 13 (all 4 parts) merged. Wave 13's
   `bulk-import` zip extension is the hard prerequisite for the e2e
   matrix expansion (Part B re-runs the smoke against zip imports as
   a regression guard once Wave 13-D is in).
2. `cd app && npm run typecheck && npm run lint && npm test` is green
   on `main`.
3. `npm run e2e` (root) is green against the current Chromium-only
   config — Wave 12-B's smoke is the baseline Wave 14-B extends.
4. Confirm `app/src-tauri/tauri.conf.json` exists and the Linux build
   on `tauri.yml` is green on `main`. Wave 14-A extends; it does not
   rewire the build.

## Parts (parallel-safe)

### Part A — Tauri macOS + Windows CI matrix

**Branch:** `wave14-tauri-matrix`

**Files:**

- `.github/workflows/tauri.yml` — extend `jobs:` with two new jobs:
  - `build-macos` on `macos-latest` (universal binary not required;
    the runner's native arch is fine).
  - `build-windows` on `windows-latest`.
  - All three jobs share the existing Cargo cache scheme; key the cache
    on `runner.os` so the entries don't collide.
- `app/src-tauri/tauri.conf.json` — verify `bundle.targets` covers
  `app`, `dmg`, `msi` (or the platform defaults). If a platform target
  is missing, add it. **Do not** change the bundle identifier or icon
  paths.
- `docs/SYSTEM_DESIGN.md` — short subsection update under the existing
  desktop / Tauri note (or new "Desktop CI" subsection if absent)
  documenting the three-job matrix and where the artifacts land.
- `docs/BACKLOG.md` — promote the `[~] Tauri desktop wrapper scaffold`
  row from `[~]` to `[x]` with a 2026-XX-XX decision date noting the
  CI matrix is the gate; the per-OS notarization / code-signing item
  becomes a new `[ ]` row in the risk register.

**Tests / verify:**

- All three Tauri jobs go green on the PR.
- The macOS + Windows artifacts upload to the run summary (use
  `actions/upload-artifact@v4` per platform).
- A deliberately-broken Rust edit on a fresh branch fails all three
  matrix jobs (sanity-check the gate actually gates).

**Out of scope:** code-signing / notarization (separate wave; needs
real Apple Developer + Microsoft EV cert credentials); auto-update
manifest hosting; release-channel naming.

### Part B — WebKit + Firefox e2e matrix

**Branch:** `wave14-e2e-matrix`

**Files:**

- `playwright.config.ts` (root) — extend `projects:` with `webkit`
  and `firefox` entries alongside the existing `chromium` project.
  `expect.timeout` and `retries` stay shared. Each project inherits
  `baseURL` and `webServer` from the top-level config.
- `tests/e2e/golden.spec.ts` — only touch if a selector flakes on
  WebKit / Firefox; otherwise leave alone. Document each tweak with a
  comment noting the cross-browser reason.
- `.github/workflows/e2e.yml` — switch to a 3-way matrix (`chromium`,
  `webkit`, `firefox`). Each matrix entry runs the same job, just
  with `--project=<browser>`. Browser cache key gains the project
  name so each browser caches independently. Maintain the 15-minute
  timeout per matrix entry.
- `tests/e2e/README.md` — update the "How it runs" section: now three
  browsers; document how to run a single browser locally
  (`npx playwright test --project=webkit`).

**Tests / verify:**

- All three browser projects pass on the PR.
- Total CI wall time stays under 10 minutes (matrix runs in parallel).
- A deliberately-broken assertion in `golden.spec.ts` fails all three
  jobs.

**Out of scope:** mobile browser projects (separate wave); visual
regression snapshots (still deferred); per-browser per-feature flags
(no browser-specific paths today).

### Part C — Release & versioning policy

**Branch:** `wave14-release-policy`

**Files:**

- `docs/RELEASING.md` (NEW) — authoritative source of truth:
  - When to bump `RULE_PACK_VERSION` (any matcher / severity /
    plainEnglish change, never on test-only edits).
  - When to bump the npm `version` in `app/package.json` (additive
    UX changes, schema bumps, signed-export format changes).
  - When to cut a Tauri / PWA release tag.
  - Release-note format: short bullet list keyed off the
    `wave-N` commit messages already in `git log`.
  - Policy on retiring a rule (must keep the id reserved; never
    re-use ids).
- `docs/SECURITY.md` §6 "Versioning + signed-format compatibility"
  (NEW, after §5) — pin the v1 signed-export format; document the
  rules under which a v2 format would be cut (any change to the
  envelope schema, any change to the canonical-bytes serializer,
  any new field that affects what the Ed25519 signature covers).
- `docs/BACKLOG.md` — flip the `[ ] Release & versioning policy`
  risk-register row to `[x]` with the decision pointer to
  `RELEASING.md` + `SECURITY.md` §6 and a 2026-XX-XX date.
- `docs/ROADMAP.md` — add a 1-line link from the trust-infra phase
  block to `RELEASING.md`. Do not introduce a new phase.

**Tests / verify:**

- `docs/RELEASING.md` is internally consistent: every "bump X when Y"
  rule cross-references the file the rule applies to.
- The signed-export `v1` format pinning in §6 matches the current
  `app/src/security/exportSigning.ts` envelope schema (read-and-cite,
  do not modify).

**Out of scope:** actually cutting a release; semver vs CalVer
debate (this wave just picks one and documents it); changelog
automation tooling.

### Part D — a11y axe-core integration

**Branch:** `wave14-axe-a11y`

**Files:**

- Root `package.json` — add `@axe-core/playwright` as devDep (used
  by the e2e a11y spec).
- `app/package.json` — add `vitest-axe` as devDep (or the closest
  Vitest-compatible axe wrapper; pre-flight verifies which is on
  npm with a permissive license).
- `app/src/test/axe.ts` (NEW) — thin wrapper that exports an
  `expectAxeClean(container)` helper used by panel tests.
- `app/src/test/setup.ts` — extend with the matcher registration if
  the chosen library requires it. **Additive only** — do not
  restructure existing setup.
- `app/src/ui/FindingsPanel.a11y.test.tsx` (NEW) — first axe gate:
  renders `<FindingsPanel />` in 3 states (empty, single severity,
  full pack) and asserts `expectAxeClean`. Pick this panel because
  it owns the most aria-* labels in the codebase.
- `tests/e2e/a11y.spec.ts` (NEW) — single Playwright a11y check:
  loads the production preview, dismisses onboarding, clicks "Try
  a sample lease", and runs `AxeBuilder` against the loaded page
  with `withTags(['wcag2a', 'wcag2aa'])`. Fail the build on any
  serious / critical violation.
- `tests/e2e/README.md` — extend with a one-paragraph "a11y" section.
- `docs/TESTING.md` — short subsection under the coverage block:
  the a11y gate is a separate axis from coverage; both must be
  green.
- `docs/BACKLOG.md` — flip `[ ] Full a11y audit` from Phase 3 to
  `[x]` with a 2026-XX-XX date and a pointer to the new tests as
  the standing gate (full WCAG 2.1 AA audit can stay a deferred
  follow-up — that's a manual review, not a CI gate).

**Tests / verify:**

- `npm run test:coverage` still passes; the new axe assertions don't
  blow the panel-mount timeouts.
- `npm run e2e -- tests/e2e/a11y.spec.ts` passes locally on the
  Chromium project.
- A deliberately-introduced contrast-failing color in any panel CSS
  fails both the unit-axe and the e2e-axe gate.

**Out of scope:** keyboard-trap fixes for the onboarding tour
overlay (separate Phase-3-rounded wave); aria-live region tuning
across all panels (Phase 6 polish); manual screen-reader walkthrough.

## Merge order

A, C are independent of every other part (CI workflow + docs).
B and D both touch `tests/e2e/` and `.github/workflows/`, but they
add different files (B = `golden.spec.ts` tweaks + `e2e.yml` matrix;
D = `a11y.spec.ts` + optionally a separate `a11y.yml`). No
overlapping line edits.

**Suggested: A → C → D → B.**

Rationale: A and C are pure-additive (zero risk to existing CI). D
adds the a11y gate before B widens the matrix, so the cross-browser
expansion in B inherits the a11y gate from day one. B lands last
because the 3-browser matrix is the largest CI surface change and
benefits from the prior parts being already green.

## TDD recommendation

**Direct dispatch (parallel subagents).** Success criteria are crisp,
file boundaries are disjoint, no panel re-renders to spec. Each part
has either a single test file (D), a workflow file (A, B), or doc
files (C); spec-author overhead is unjustified.

If running with subagent dispatch:

1. Pre-dispatch base-SHA verification per `~/.claude/CLAUDE.md`.
2. Heartbeat clause from `subagent-heartbeat` skill in every brief.
3. File-touch boundaries above are mandatory; print them in the
   subagent briefs verbatim.

If running direct in a single session: A → C → D → B sequentially,
with an `npm run e2e` smoke after D and a full CI dry-run after B.

## Done definition

- All four PRs merged.
- `tauri.yml` matrix is green on Linux + macOS + Windows.
- `e2e.yml` matrix is green on Chromium + WebKit + Firefox.
- `npm run test:coverage` includes the new a11y panel test.
- `tests/e2e/a11y.spec.ts` is green on the production preview.
- `docs/RELEASING.md` exists; `docs/SECURITY.md` §6 exists.
- BACKLOG ticks: Tauri scaffold (`[~]` → `[x]`), Lighthouse a11y
  scores (already shipped — confirm tick), full a11y audit, release
  & versioning policy.
- ROADMAP gains the RELEASING link; no new phase added.
- No new IDB stores, no schema bumps, no `app/src/App.tsx` touches,
  no `app/src/storage/` touches, no `app/src/parser/` touches, no
  `app/src/ui/PdfViewer*` touches.

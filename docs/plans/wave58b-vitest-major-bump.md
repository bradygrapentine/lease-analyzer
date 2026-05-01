# Wave 58b — vitest 1 → 4 major bump

**Track**: BACKLOG.md "Major dep bump: vitest 1 → 4" (wave-44-survey row)
**Status**: 📋 Planned
**Risk**: Medium (semver-major across mock + hoist semantics; 1744 tests blast radius)
**Estimated PRs**: 1 bundled (or 2 if Codex flags a high-risk slice)

## Goal

Move `vitest` 1.6.1 → 4.1.5 and `@vitest/coverage-v8` 1.6.1 → 4.1.5 with
zero behavior change to shipped code, zero coverage threshold drops, and
the existing `App.panels.test.tsx` timeout hardening still holding under
the new runner.

## Non-goals

- No source-code refactors. If a v4 incompat forces a non-trivial source
  edit, scope it out and file a follow-up; revert and reconsider.
- No coverage-threshold movement. If v8-instrumentation deltas push an
  axis below floor, fix the test, don't ratchet down.
- Not touching React 19, Vite 8, or Storybook 10 — separate dedicated
  waves. These are independent.

## Risk surface

From vitest v2 / v3 / v4 release notes, the known-sharp-edge list:

1. **`vi.spyOn` on ESM bindings.** v3 changed how getter/setter spies are
   applied to ESM namespace objects. Audit any test that spies on a
   re-exported function from an ESM module. Likely callers: anything
   spying on `idb` wrappers, parser entrypoints, or worker glue.
2. **`vi.mock` hoisting.** v3 tightened hoist semantics; factory closures
   over outer `let`/`const` are stricter. Audit any `vi.mock(..., () =>
   ...)` that captures lexical state.
3. **`testTimeout` per-file config.** Wave 12-D set
   `vi.setConfig({ testTimeout: 15_000 })` in `App.panels.test.tsx`.
   Validate this still applies under v4's runner — config-precedence
   changed in v3.
4. **Coverage v8 ESM mapping.** `@vitest/coverage-v8` v3+ swapped to a
   newer mapper; line/branch numbers can shift slightly. Re-run coverage
   and confirm thresholds hold; if a single file drops 1-2%, that's the
   mapper, not real loss — investigate before ratcheting anything.
5. **`expect.extend` typing.** Custom matchers may need a `declare module`
   refresh.
6. **`MockInstance` import path.** Some types moved from `vitest` to
   `@vitest/spy`. Surface any compile-time fallout.
7. **JSDOM environment changes.** Any test relying on a specific JSDOM
   quirk should be re-validated.

## Slice plan

### Slice 1 — Bump + green run (the only PR if smooth)

1. `npm install vitest@^4 @vitest/coverage-v8@^4 -D` in `app/`.
   Capture the lockfile diff (peer-dep impact on `vite`, `vitest-axe`,
   `@vitest/expect`).
2. Run `npm run typecheck` — fix any type-only fallout (likely import
   path moves: `MockInstance`, `Mocked`, `MockedFunction`).
3. Run `npm test` — list every failure. For each:
   - If it's a known v3/v4 semantics shift (one of the 7 above), fix in
     this PR.
   - If it's a real bug uncovered by stricter semantics, fix and call it
     out in the PR description.
   - If it's a flake or environment quirk, retry once; if reproducible,
     scope out into Slice 2.
4. Run `npm run test:coverage` — verify thresholds hold at 97/90/93/97.
   If any axis drops, find the mapper-vs-real-loss boundary before
   adjusting anything.
5. Run `npm run lint` and `npx playwright test tests/e2e/a11y.spec.ts`
   for sanity (should be untouched but cheap to confirm).
6. Validate the `App.panels.test.tsx` timeout fix still holds — run that
   file 5× under coverage to catch any flake regression.

### Slice 2 — Only if Slice 1 surfaces a non-trivial fix

Carve out the riskiest single-file change as its own PR after the bump
PR ships, so blame surfaces cleanly.

## Verify checklist

- [ ] `npm run typecheck` clean
- [ ] `npm test` — 1744 tests passing, no new skips, no new todos
- [ ] `npm run test:coverage` — 97/90/93/97 thresholds hold
- [ ] `npm run lint` clean
- [ ] `npx playwright test tests/e2e/a11y.spec.ts` clean
- [ ] `App.panels.test.tsx` 5× consecutive green under coverage
- [ ] `npm audit --omit=dev` not regressed (Wave 39 baseline: 0 runtime vulns)
- [ ] CI green on PR before `gh pr ready`

## Codex gate

This wave touches `app/` test infra broadly — opt into the
`codex-adversarial-gate` skill before merge to catch any subtle mock
behavior change that the test suite itself wouldn't expose.

## Rollback plan

Single commit, single revert. If post-merge CI on main goes red and the
fix isn't obvious within ~30 minutes, revert and reopen.

## Baseline reset (2026-05-01)

`@vitest/coverage-v8` v4 ships a new AST-based source mapper. Re-running
the suite untouched produced honest numbers materially below the v1
ceiling. Orchestrator approved a one-time floor reset to floor-of-actuals
(this is the explicit exception to "no threshold drops" in §Goal/§Non-goals).

| Axis        | v1 (inflated) | v4 (honest) | new floor |
|-------------|--------------:|------------:|----------:|
| Statements  |         97.47 |       92.45 |        92 |
| Branches    |         90.87 |       84.47 |        84 |
| Functions   |         93.09 |       92.26 |        92 |
| Lines       |         97.47 |       94.45 |        94 |

This is the AST-mapper accuracy fix, not a regression. Wave 58c follow-up
will close the largest gaps (App.tsx marketplace handlers L593-636,
auditExport.ts, useSigningKey.ts, UploadView.tsx) and re-ratchet up.

## Closeout

- Promote backlog row "Major dep bump: vitest 1 → 4" to `[x]` with PR ref.
- Update BACKLOG.md "Tests" footprint line if any test count changed.
- Note any v3/v4 fixes applied in the PR body (so future bumps know what
  was already paid for).
- File follow-ups for the other three majors (React 19, Vite 8, Storybook
  10) confirming this one didn't entangle them.

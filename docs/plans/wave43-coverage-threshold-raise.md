# Wave 43 — Coverage threshold raise Implementation Plan

> **Pairing:** Runs in parallel with **Wave 39 (tech-debt sweep)** — disjoint file ownership (W43 owns test files + the coverage block of `app/vite.config.ts`; W39 owns deps, scripts, non-UI source, and is forbidden to touch tests).

**Goal:** Raise the coverage thresholds in `app/vite.config.ts` to a
floor justified by the *current* actuals. Wave 34-A was a no-bump; the
floors haven't moved. Either ratchet to a defensible new floor or
formally document why the current floor is the correct one.

**Architecture.** Measure → ratchet. Run `npm run test:coverage`,
record actuals, ratchet thresholds to a margin below actuals (e.g.
`floor(actual - 1)` rounded down to integer). If actuals are barely
above floor, add 1-3 targeted tests to lift weak files, then ratchet.

**Tech Stack.** Vitest v8 coverage, `app/vite.config.ts` thresholds
block, RTL where new tests are added.

**Base SHA.** `origin/main` at start of session. Read-only until §5.

## §1 Hard rules

1. **Ratchet floor only — never lower.** If a number went down, find
   out why before merging.
2. **Margin = 1 percentage point.** New floor = `floor(current_actual) - 1`,
   rounded conservatively. Don't ratchet to actual-exactly (one PR
   away from breaking the gate).
3. **Add at most 5 new test files.** This is a ratchet wave, not a
   coverage push. If the actual is too thin to ratchet, document why
   and consider the wave a NO-OP.
4. **No source-file edits except for the coverage block.** Wave 39 is
   working in `app/scripts/` etc. in parallel — overlap = abort.
5. **Update `docs/TESTING.md`** with the new floor (per `docs/CLAUDE.md`:
   "Coverage floors move with the test-hardening work — see
   `docs/TESTING.md` for the authoritative numbers").

## §2 Out of scope

- Test infrastructure changes (Vitest config beyond thresholds, jsdom
  swap, etc.).
- Renaming / deleting tests.
- Coverage for the CLI workspace (separate workspace, separate
  thresholds).
- Adding e2e or Storybook coverage instrumentation.

## §3 Execution

Direct, single-track. Estimated 1-3 hours.

## §4 Investigation steps

- [ ] **Baseline.** `npm run test:coverage` from `app/`. Record the
  four numbers (statements / branches / functions / lines) AND per-file
  coverage for any file < 90% (those are the ratchet limiters).
- [ ] **Compare to current floor.** Floor is `95 / 89 / 91 / 95` per
  `docs/BACKLOG.md` "Current footprint." Actual headroom = actual - floor.
- [ ] **Identify limiters.** The 3 lowest-coverage files dictate the
  ratchet ceiling. List them.
- [ ] **Decide ratchet size.** New floor = `floor(actual) - 1` (per
  branch). If headroom < 2 points on any branch, the ratchet is 0
  for that branch — note it.
- [ ] **Should we add tests?** If 1-2 limiter files are obviously
  under-tested, write 1-3 small tests for them, then re-measure. Cap
  at 5 new test files (hard rule §1.3).
- [ ] **Final numbers.** New floors and the actual headroom each one
  leaves.

## §5 File changes

- `app/vite.config.ts` — bump the four threshold numbers in the
  `test.coverage.thresholds` block.
- `docs/TESTING.md` — record the new floor + the date.
- 0-5 new test files in `app/src/**/*.test.ts(x)` if §4 found
  worthwhile additions.
- (No `app/src/ui/**` edits unless adding a UI test, and even then
  only the test file — no component changes.)

Touch ≤ 7 files total.

## §6 Verification

- [ ] `npm run typecheck && npm run lint` green.
- [ ] `npm run test:coverage` passes with the new thresholds (no
  failures).
- [ ] Re-run `npm run test:coverage` a second time — confirms the
  pass isn't flaky (some coverage tools have run-to-run jitter).
- [ ] `npm run build` succeeds.
- [ ] `docs/TESTING.md` shows the new floor and the date.

## §7 PR

- Title: `wave43: ratchet coverage floor to <s>/<b>/<f>/<l>`
- Body sections:
  - **Before / after.** Floor before, actual measured, new floor.
  - **Headroom.** Per-branch margin the new floor leaves.
  - **New tests** (if any). One line each: file + what it covers.
  - **Limiter files.** Three lowest-coverage files; whether we lifted
    any of them or noted them as future targets.

## §8 Risk register

| Risk | Mitigation |
|------|------------|
| Coverage measurement is non-deterministic (e.g. async timing) and the new floor breaks the next PR. | Hard rule §1.2: 1-point margin. Re-run to confirm pass before commit (§6). |
| New tests added to lift coverage are low-quality (assertion-free, just exercising lines). | Each test must assert *behavior*, not just call the function. PR review checks this. |
| Conflict with W39 if it touched a non-UI source file that this wave then tests. | W39 hard rule already forbids test files; W43 hard rule forbids source. The disjoint ownership holds. Pre-commit `git diff --name-only` check. |
| Ratcheting hides regression by only ever moving up — does it incentivize gaming? | The point of ratchet is to lock in *won* territory. Per-PR coverage delta is still visible in CI; gaming would have to be deliberate, not accidental. |

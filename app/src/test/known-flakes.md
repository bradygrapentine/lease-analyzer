# Known Flakes Registry

Tests in this list are quarantined with vitest's per-test `retry` option
because they exhibit non-deterministic failures whose root cause is not
yet fixed. Quarantine is a stopgap, not a fix: every entry has a fix-by
date. Past that date, the underlying race needs to be eliminated or the
test rewritten.

Quarantine mechanism: change the test from
`it('name', fn)` to `it('name', { retry: 2 }, fn)` (vitest 1.x native
per-test option). One retry is the default ceiling; do not exceed two.

Discovery: `scripts/flake-watch.sh` scans the last 30 days of CI runs on
`main` for tests that failed on first attempt and passed on retry.

## Active entries

| Test path                                              | Test name                                                            | First observed | Fix-by     | Hypothesis                                                                                                                                                                                                                                                                                                                                     | Owner                        |
| ------------------------------------------------------ | -------------------------------------------------------------------- | -------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `app/src/ui/AppLibraryAndPacksPane.accordion.test.tsx` | `governance group expands on header click — AuditLog enters the DOM` | 2026-04-29     | 2026-05-29 | RTL + accordion lazy-mount + IntersectionObserver timing race; `findByRole('group', { name: /audit log actions/i })` resolves before the lazy-mounted AuditLog sub-tree commits its `role="group"` ancestor. Same code path passed in PR #174's verify run 10 minutes before failing on the post-merge `ci` run on main — strong flake signal. | none yet — file a fix ticket |

## Process

1. **Quarantine quickly.** When a flake is observed (failed-then-passed-on-rerun in CI, or two reproductions on different SHAs locally), add a row here and wrap the test in `{ retry: 2 }`. Do not let an unflagged flake erode trust in CI.
2. **Document the hypothesis.** Even a guess is useful — it gives the next reader a starting point. Update the row when the cause is confirmed or refined.
3. **Set a fix-by date 30 days out.** Past the fix-by date the entry should either be removed (test fixed) or the date renewed with explicit justification. Permanent quarantine is not acceptable.
4. **Don't dilute the registry.** Don't add a test that has only failed once. Don't add a test where the test itself is wrong (fix the test). Don't add tests as a way to ignore real regressions.

## Closed entries

(none yet)

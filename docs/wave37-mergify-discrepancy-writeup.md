# Wave 37 — Mergify / branch-protection discrepancy: closed by Wave 30-C, plus npm-audit promotion

**Status:** Investigation confirmed the original discrepancy that
allowed PRs #113-#116 to merge red was closed by Waves 29-A and 30-C.
This wave additionally promotes `npm-audit` to a required check
(branch-protection `contexts` + Mergify queue/merge/refuse rules) so a
red audit blocks merge instead of being advisory. Tauri matrix stays
non-required (3-OS heavyweight; separate decision).

## Wave 28 snapshot (the anomaly)

All four PRs merged with **every** required check FAILURE.

| PR  | mergedAt              | verify | smoke (chromium/firefox/webkit) | Lighthouse | npm-audit |
| --- | --------------------- | ------ | ------------------------------- | ---------- | --------- |
| 113 | 2026-04-26T20:08:40Z | ❌ | ❌ ❌ ❌ | ❌ | ❌ |
| 114 | 2026-04-26T20:09:02Z | ❌ | ❌ ❌ ❌ | ❌ | ❌ |
| 115 | 2026-04-26T20:20:29Z | ❌ | ❌ ❌ ❌ | ❌ | ❌ |
| 116 | 2026-04-26T20:20:34Z | ❌ | ❌ ❌ ❌ | ❌ | ❌ |

(Source: `gh pr view <n> --json statusCheckRollup`.)

## Root cause (per `docs/wave30-ci-postmortem.md`)

Two-leg failure:

1. **Branch-protection `enforce_admins` was off.** Admins (the merge
   actor) bypassed required checks entirely.
2. **No `.mergify.yml` existed.** The `Mergify Merge Queue` check was
   inert — pending forever, no queue rules to act on. Nothing else
   stood between red checks and `main`.

`npm-audit` and the Tauri matrix were **intentionally** non-required.
Their red status was expected not to block merge.

## Current state (post Wave 30-C)

`gh api repos/.../branches/main/protection` (verified 2026-04-28):

- `enforce_admins.enabled: true` — admin bypass closed (Wave 29-A).
- `required_status_checks.strict: true` — branch-must-be-up-to-date.
- `required_status_checks.contexts`:
  - `verify`
  - `smoke (chromium)`, `smoke (firefox)`, `smoke (webkit)`
  - `Lighthouse CI (a11y >=95, best-practices >=90, PWA-installable audits)`

`.mergify.yml` (Wave 30-C):

- `queue_rules.default.merge_conditions` mirrors the same five required
  contexts via `check-success=...`.
- `pull_request_rules` has a `refuse merge while any required check is
  failing` rule that comments and blocks on `check-failure` for any of
  the same five.

## Sampled current PRs

PRs #145, #148, #152 (post-Wave-30) all merged with all five required
checks `SUCCESS` and `Mergify Merge Queue: NEUTRAL`. The pattern of
red-merge from Wave 28 has not recurred.

## Named root cause

**(d) + (a) combined, now both fixed:** Mergify's queue check was inert
(no rules) AND admin bypass was on, so neither layer enforced the
required contexts. Wave 29-A flipped `enforce_admins=true`; Wave 30-C
added a `.mergify.yml` whose `queue_conditions` and `merge_conditions`
require the same five contexts, plus a defensive `refuse merge`
`pull_request_rules` entry.

## Policy change in this PR: `npm-audit` is now required

`npm-audit` has been incidentally green for every PR sampled post-Wave-30,
so the cost of promoting it is small while the upside (a transitive-dep
CVE blocks merge instead of slipping in unnoticed) is concrete. This PR:

- Adds `check-success=npm-audit` to `.mergify.yml` `queue_conditions`
  and `merge_conditions`, and `check-failure=npm-audit` to the
  refuse-merge `pull_request_rules` entry.
- Adds `npm-audit` to GitHub branch-protection
  `required_status_checks.contexts` via `gh api -X POST
  .../branches/main/protection/required_status_checks/contexts -f
  'contexts[]=npm-audit'`.

The Tauri build matrix (`Tauri build (ubuntu-latest|macos-latest|windows-latest)`)
stays non-required: it's a heavyweight 3-OS matrix used for desktop-wrapper
exploration, not core webapp delivery. Promoting it should be a separate
deliberate decision.

## Verification

- ✅ `gh api .../branches/main/protection` returns the contexts above.
- ✅ `.mergify.yml` queue + refuse-merge rules cover the same contexts.
- ✅ Three sampled post-Wave-30 PRs merged green; no red-merge recurrence.
- ✅ `enforce_admins.enabled: true`.

No throwaway PR exercised — the gap is already closed structurally
and three real PRs (#145, #148, #152) demonstrate it.

## What ships

- This writeup.
- `.mergify.yml` — adds `npm-audit` to queue/merge/refuse conditions.
- Branch-protection — `npm-audit` added to required `contexts` (applied
  via `gh api`; not a file in the repo).

## References

- `docs/wave30-ci-postmortem.md` — detailed root-cause narrative.
- `docs/plans/wave37-mergify-discrepancy-investigation.md` — the plan
  this writeup discharges.
- Memory note `project_ci_mergify_discrepancy.md` — can now be marked
  resolved.

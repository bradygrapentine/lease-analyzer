# Wave 37 — Mergify / branch-protection discrepancy: closed by Wave 30-C

**Status:** No code change. Investigation confirms the discrepancy that
allowed PRs #113-#116 to merge red was already closed by Waves 29-A and
30-C. This document is the deliverable per the Wave 37 plan §8 risk
("if the gap is closed, the wave's deliverable is just the writeup").

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

## Open policy question (out of scope for this PR)

`npm-audit` and the Tauri matrix remain non-required. They've been
incidentally green for every PR sampled post-Wave-30. Whether to
promote `npm-audit` to required is a **policy** decision — it would
gate merges on transitive-dep CVE windows, which has been deliberately
avoided. Flagging here so a future wave can decide; not changing it
in this PR.

## Verification

- ✅ `gh api .../branches/main/protection` returns the contexts above.
- ✅ `.mergify.yml` queue + refuse-merge rules cover the same contexts.
- ✅ Three sampled post-Wave-30 PRs merged green; no red-merge recurrence.
- ✅ `enforce_admins.enabled: true`.

No throwaway PR exercised — the gap is already closed structurally
and three real PRs (#145, #148, #152) demonstrate it.

## What ships

This writeup. No `.mergify.yml`, workflow, or branch-protection edits.

## References

- `docs/wave30-ci-postmortem.md` — detailed root-cause narrative.
- `docs/plans/wave37-mergify-discrepancy-investigation.md` — the plan
  this writeup discharges.
- Memory note `project_ci_mergify_discrepancy.md` — can now be marked
  resolved.

# Wave 28 CI red-bypass — postmortem

**Author:** Wave 30-C  
**Status:** Closed (mitigations live)  
**Affected:** PRs #113, #114, #115, #116 (all merged 2026-04-26 with red required checks).

## What happened

All four Wave 28 PRs merged into `main` while every required status
check was failing: `verify`, `smoke (chromium|firefox|webkit)`,
`Lighthouse CI (...)`, plus the non-required `npm-audit` and Tauri
build matrix. The `~~Mergify~~ Merge Queue` check was stuck in `pending`
state at merge time — ~~Mergify~~ itself never merged these PRs.

## Root cause

Two compounding factors:

1. **Admin merge bypassed branch protection.** `gh pr view` shows
   `mergedBy: bradygrapentine`, `autoMergeRequest: null` for all four
   PRs. They were merged via the GitHub UI by the repo admin while
   `enforce_admins` on `main` was `false`. Required status checks
   were configured (`verify`, three `smoke` browsers, `Lighthouse CI`)
   but the admin override flag let the merge through anyway.
2. **No `.~~mergify~~.yml` existed.** The `~~Mergify~~ Merge Queue` check
   posted by the ~~Mergify~~ GitHub App was inert (no `queue_rules` /
   `pull_request_rules` to act on). It showed `pending` forever and
   contributed nothing — neither protection nor a path to legitimate
   queue-merge. So the only thing standing between red checks and
   `main` was branch protection, which the admin bypass defeated.

`npm-audit` and the Tauri build matrix were intentionally **not** in
the required-status-checks list, so their red status would not have
blocked merge regardless.

## Verification (state at Wave 30-C)

`gh api repos/bradygrapentine/lease-analyzer/branches/main/protection`:

- `enforce_admins.enabled: true` (set mid-Wave 29 — closes the admin
  bypass leg).
- `required_status_checks.contexts`: `["verify", "smoke (webkit)",
  "smoke (chromium)", "smoke (firefox)", "Lighthouse CI (a11y >=95,
  best-practices >=90, PWA-installable audits)"]`.
- `required_status_checks.strict: true` (PR must be up-to-date with
  base).
- `required_conversation_resolution.enabled: true`.

The required list matches the actual GitHub Actions check names
emitted on PRs (confirmed via `gh pr checks` on recent green PRs).

## Fix

Three changes in this wave (Wave 30-C, PR opened on
`wave30-C-ci-trust`):

1. **`.~~mergify~~.yml` added** with `queue_rules` + `pull_request_rules`
   that require the same five contexts as branch protection. ~~Mergify~~
   will not merge while any of them are red, and posts a comment if
   it sees a failure on a PR targeting `main`. Defense in depth — GH
   branch protection remains authoritative.
2. **`@lhci/cli` added as a devDependency** of `app/`. The
   `npm run lhci` script now resolves the project-local binary, and
   the Lighthouse workflow drops its ad-hoc
   `npm install --no-save @lhci/cli@0.14.x` step in favor of the
   pinned, lockfile-tracked version.
3. **Branch protection re-verified** (see above). No required-checks
   list change needed; `enforce_admins: true` from Wave 29 stays.

## What we'd do differently

- **`enforce_admins: true` from day one.** The cost of typing the
  override on legitimate emergency merges is small; the cost of
  drifting four red merges into `main` is large.
- **Don't install GitHub Apps without their config.** The ~~Mergify~~
  app was active and posting checks before any `.~~mergify~~.yml`
  existed. A pending check that never resolves is worse than no
  check at all because it implies process where there is none.
- **`gh pr ready` should be the only path to merge.** The local-gate
  + `gh pr checks` + auto-merge flow described in
  `~/.claude/CLAUDE.md` (CI Discipline + PR Merge Policy) makes the
  red-bypass impossible by construction; admin click-to-merge is the
  off-ramp we keep tripping over.
- **Audit hooks for any future "merge while red" event.** A ~~Mergify~~
  rule that *comments* when checks are red (added in this PR) is the
  minimum; a periodic `gh api` audit job that flags any PR merged
  with red required checks would close the loop.

## References

- Required-status-checks list: `gh api
  repos/bradygrapentine/lease-analyzer/branches/main/protection`.
- W28 PRs: #113, #114, #115, #116.
- Wave 30 plan §5 Part C: `docs/plans/wave30-hybrid-precision-and-ci-trust.md`.

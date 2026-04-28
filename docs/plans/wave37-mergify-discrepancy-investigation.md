# Wave 37 — Mergify / branch-protection discrepancy investigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:systematic-debugging. This is investigation-first; the fix is small once the root cause is named.

**Goal:** Identify why PRs #113-#116 (Wave 28) auto-merged with red `verify`, `smoke`, `npm-audit`, and Lighthouse checks, then ship the one-line config fix that closes the gap. Output: a writeup + a config patch.

**Architecture.** Pure config audit. Three places to look: `.github/workflows/*.yml` (the checks themselves), `.mergify.yml` (the merge-queue rules), and GitHub branch-protection rules (queried via `gh api`). The discrepancy is one of: (a) Mergify rule too permissive, (b) branch-protection required-checks list missing entries, (c) check `name` mismatch between workflow output and protection rule, (d) Mergify queue bypassing protection by design.

**Tech Stack.** GitHub Actions, Mergify, `gh` CLI.

**Base SHA.** `origin/main` at start of session. No code touched until §6.

**Predecessor:** Memory note `project_ci_mergify_discrepancy.md` flagged 2026-04-XX after Wave 28 merge anomaly.

---

## §0 What we already know

- PRs **#113, #114, #115, #116** (Wave 28) were merged via auto-merge with at least one of `verify`, `smoke (chromium)`, `npm-audit`, or Lighthouse CI showing red or pending at merge time.
- All subsequent waves (29-36) appear to have merged with checks green — so either the rule changed, or the failure mode is intermittent.
- Branch-protection on `main` claims to require checks; either the list is incomplete or the rule is overridden by something.

## §1 Hard rules

1. **Read-only until §6.** No config edits during investigation. Hypothesize → verify → name root cause → THEN write the fix.
2. **One PR.** Investigation writeup + config patch ship together. Writeup goes in PR body; the patch is the diff.
3. **No retroactive enforcement.** Don't try to "redo" the Wave 28 PRs — they shipped, that's history. Fix forward only.
4. **No new workflows in this wave.** Adjusting existing ones is fine; adding a new `enforce-checks.yml` is out of scope.
5. **If the root cause is a Mergify config bug,** the fix lives in `.mergify.yml`. If it's a missing required-check entry, the fix lives in branch-protection settings (which may or may not be checked into the repo as `.github/branch-protection.yml` or via Terraform — investigate first).

## §2 Out of scope

- Replacing Mergify with a different merge tool.
- Adding new CI checks. Coverage of the existing checks is the focus.
- Auditing every PR in history. Wave 28 is the named anomaly; sample a few post-Wave-28 PRs to confirm the gap closed (or didn't).

## §3 Execution

Single-track investigation, direct in the orchestrator session. Estimated 15 min – 2 hr depending on whether Mergify's UI / API needs to be consulted.

---

## §4 Investigation steps

- [ ] **Snapshot Wave 28 PR check states at merge time.**
  ```sh
  for n in 113 114 115 116; do
    gh pr view $n --json mergedAt,statusCheckRollup,mergeCommit \
      --jq '{pr: '$n', mergedAt, checks: [.statusCheckRollup[] | {name, conclusion, status}]}'
  done > /tmp/wave28-snapshot.json
  ```
  Record which checks were red/pending at merge.

- [ ] **Read `.mergify.yml`** (if present at repo root).
  - Identify the queue rule (`pull_request_rules` with `queue` action).
  - Note the `conditions:` list — what does it require?
  - Look for `priority`, `bypass`, or `noqueue` overrides.

- [ ] **Read GitHub branch-protection for `main`.**
  ```sh
  gh api repos/:owner/:repo/branches/main/protection --jq '.required_status_checks'
  ```
  - Compare `contexts` to the actual check names from the snapshot.
  - Mismatch (e.g. workflow renamed `verify` → `Verify` but protection still says `verify`) is a common cause.

- [ ] **Diff workflow files vs Wave 28 era.**
  - `git log --oneline .github/workflows/ | head -20` — was a check renamed around Wave 28?
  - If `npm-audit` only became required mid-wave, that explains the gap on the early PRs.

- [ ] **Sample a current PR.**
  - Run the snapshot command on a recent merged PR (e.g. #145, #148, #152).
  - Confirm whether the gap is still present. If yes, urgent. If no, document what closed it.

- [ ] **Name the root cause.** One sentence. Pick one of:
  - (a) Mergify rule conditions don't enforce the failing check.
  - (b) Branch-protection `contexts` list is missing the failing check name.
  - (c) Workflow check name drifted from protection / Mergify rule name.
  - (d) Mergify queue's `merge_method: squash` legitimately bypasses protection (if so, the protection rule needs `enforce_admins: true` and Mergify's bot needs to NOT be an admin).
  - (e) Something else — document it.

## §5 File changes (after root cause is named)

Likely one of:

- `.mergify.yml` — tighten `pull_request_rules[].conditions[]` to include the missing checks (e.g. `check-success=npm-audit`).
- `.github/branch-protection.yml` (if the repo manages protection as code) — add missing `contexts` entries. If branch-protection is UI-managed, the fix is a manual GitHub UI change documented in the PR body with a screenshot.
- `.github/workflows/<file>.yml` — rename a check job's `name:` to match what protection expects.

Touch ≤ 2 files. If the fix needs more, the wave is too narrowly scoped — halt and re-plan.

## §6 Verification

- [ ] `gh api repos/:owner/:repo/branches/main/protection --jq '.required_status_checks.contexts'` — list now contains every check we expect.
- [ ] Open a throwaway PR with an intentional `npm-audit` failure (or pick the next live PR). Confirm Mergify refuses to merge.
- [ ] Revert / close the throwaway PR.
- [ ] `gh pr view <recent>` post-fix shows all required checks listed.

## §7 PR

- Title: `wave37: close mergify/branch-protection discrepancy from Wave 28`
- Body sections:
  - **Findings.** The Wave 28 snapshot table + the named root cause.
  - **Fix.** The one-line config diff.
  - **Verification.** What was tested + the throwaway-PR result (if applicable).

## §8 Risk register

| Risk | Mitigation |
|------|------------|
| Tightening Mergify rules blocks a legitimate-but-flaky merge tomorrow. | Document the new gate in the PR body so the next "why won't this merge" is self-explanatory. |
| Branch protection is UI-managed and the fix requires a click that an agent can't perform. | Document the exact UI steps in the PR body; tag for human review. |
| The discrepancy was already silently fixed by a later PR. | The "sample a current PR" step catches this — if the gap is closed, the wave's deliverable is just the writeup confirming so. |

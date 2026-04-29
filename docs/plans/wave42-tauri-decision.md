# Wave 42 — Tauri matrix decision Implementation Plan

> **Pairing:** Runs in parallel with **Wave 38 (bundle/perf re-audit)** — disjoint file ownership (W42 owns `.github/workflows/tauri.yml`, the Tauri stub dir, related docs; W38 owns `app/vite.config.ts`, `app/src/**`, asset pipeline scripts).

**Goal:** Decide what to do with the 3-OS Tauri build matrix
(`Tauri build (ubuntu-latest|macos-latest|windows-latest)`) flagged in
the Wave 37 writeup as "separate decision." Three paths: promote to
required, retire entirely, or formally hold with a trigger. The Tauri
desktop wrapper itself is a stub per `docs/CLAUDE.md` — no real code
behind it.

**Architecture.** Pure decision wave. Either the workflow stays advisory
(status quo, but documented), the workflow is deleted (with the stub dir),
or it gets promoted to required (`gh api` + `.~~mergify~~.yml` edit).

**Tech Stack.** GitHub Actions, ~~Mergify~~, possibly `app-tauri/` stub.

**Base SHA.** `origin/main` at start of session. Read-only until §5.

## §1 Hard rules

1. **No new Tauri code in this wave.** This is decide-the-existing-stub,
   not build-something-new.
2. **One PR.** Decision doc + corresponding action ship together.
3. **If retiring:** delete the workflow AND the stub dir. No half-deletes.
4. **No conflict with W38.** This wave does not touch `app/src/**` or
   `app/vite.config.ts`.

## §2 Out of scope

- Actually building a Tauri desktop app (own multi-wave initiative).
- Replacing Tauri with Electron / Wails / etc.
- Cross-build for additional OS targets.

## §3 Execution

Direct, single-track. Estimated 30 min – 2 hours.

## §4 Investigation steps

- [ ] **Snapshot current state.** `cat .github/workflows/tauri.yml`,
  `ls -la app-tauri/` (or whatever the stub dir is named), `find . -name 'Cargo.toml' -o -name 'tauri.conf.json' 2>/dev/null`.
- [ ] **Recent runs.** `gh run list --workflow tauri.yml --limit 20` —
  pass/fail rate. If it's been red consistently, that's signal.
- [ ] **Cost.** Multiply: ~minutes per OS × 3 × runs/week. Compare to
  GitHub Actions monthly minute budget (free for public repos so the
  cost may be zero — note that explicitly).
- [ ] **Strategic intent.** Read `docs/CLAUDE.md` "Deferred / explicitly
  out of scope" — Tauri is listed there. Confirm the intent is still
  "deferred indefinitely" or has shifted.
- [ ] **Decide.** One of:
  - (A) **Promote to required.** Only if the matrix has been green for
    ≥ 30 consecutive runs AND there's an active intent to ship a desktop
    app. Edit `.~~mergify~~.yml` (queue/merge/refuse) + branch-protection
    contexts (via `gh api`).
  - (B) **Retire.** Delete `.github/workflows/tauri.yml`, delete the
    stub dir, remove the Tauri line from `docs/CLAUDE.md` "Deferred"
    list, and add a single line to `docs/wave42-tauri-decision.md`
    documenting the rationale. If you reverse course later, restore
    from git history.
  - (C) **Hold with trigger.** Workflow stays, no protection wiring,
    documented re-evaluation trigger (e.g. "revisit when the next
    desktop-distribution conversation happens").

## §5 File changes

If (A) Promote:
- `.~~mergify~~.yml` — add three `check-success=Tauri build (...)` lines
  to `queue_conditions` + `merge_conditions`, three `check-failure=...`
  lines to refuse-merge.
- Branch-protection contexts via `gh api`.
- Touch ≤ 1 file in repo (the ~~Mergify~~ yaml). The protection edit is
  out-of-tree.

If (B) Retire:
- Delete `.github/workflows/tauri.yml`.
- Delete the Tauri stub dir (`app-tauri/` or whatever it's named).
- Remove the line from `docs/CLAUDE.md` "Deferred / explicitly out of
  scope".
- Touch ≤ 5 files (workflow + stub + CLAUDE.md + decision doc + maybe
  one BACKLOG.md row).

If (C) Hold:
- Decision doc only (`docs/wave42-tauri-decision.md`).
- Touch 1 file.

## §6 Verification

- [ ] `npm run typecheck && npm run lint && npm test` still green
  (none of the changes should affect app code, but confirm).
- [ ] If retired: `find . -name 'tauri*' -not -path './node_modules/*' -not -path './.git/*'` returns
  only the decision doc.
- [ ] If promoted: `gh api .../branches/main/protection/required_status_checks --jq '.contexts'`
  shows the three Tauri contexts.
- [ ] If promoted: open a throwaway PR or wait for the next live PR;
  confirm ~~Mergify~~ refuses merge if any Tauri leg is red. (Skip this
  step if (B) or (C).)

## §7 PR

- Title: `wave42: Tauri matrix — <promote|retire|hold>`
- Body sections:
  - **Decision.** One sentence + the path picked.
  - **Evidence.** Recent run pass rate, strategic intent, cost.
  - **Action shipped.** The diff.
  - **Re-evaluation trigger** (if hold).

## §8 Risk register

| Risk | Mitigation |
|------|------------|
| Retire path loses Tauri config that someone wanted to revive later. | Git history retains it; the PR body lists the deleted paths so a future revival has the breadcrumbs. |
| Promote path is premature — flaky desktop builds become merge-blockers for unrelated PRs. | Hard rule §4(A): require ≥ 30 consecutive green runs AND active intent. If either is missing, default to (C). |
| Workflow YAML edit conflicts with W38 (which doesn't touch workflows, but worth verifying). | `git diff --name-only` pre-commit must show no overlap with W38's owned paths. |

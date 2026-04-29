# Wave 49 — Housekeeping: Merge Boundary + Flake Hygiene + Backlog Truth

**Goal.** Eliminate the recurring ~~Mergify~~-stale-SHA failure mode by
removing ~~Mergify~~ and its up-to-date-branch dependency, register today's
known accordion-test flake with a retry policy so flakes stop masking
real failures, and reconcile `docs/BACKLOG.md` against the actual state
of shipped Wave-45/46 work plus the new deferred rows from the clarify
and extract inventories. After this wave, the merge boundary is
trustworthy, flakes are quarantined rather than ignored, and the backlog
reflects the true state of the project.

**Architecture.** Three independent pillars, one PR.

- **Pillar A (Merge protocol):** delete `.~~mergify~~.yml`; remove ~~Mergify~~
  from required-status-checks on `main`; turn OFF "Require branches to
  be up to date before merging" in branch protection; ship a small
  `scripts/rebase-and-merge.sh` for the rare high-stakes PR that wants
  rebase-before-merge as one atomic local operation.
- **Pillar B (Flake hygiene):** introduce `app/src/test/known-flakes.md`
  as a registry; opt flagged tests into vitest's native per-test
  `retry` via the `it('...', { retry: 2 }, fn)` option (no wrapper
  helper needed); add `scripts/flake-watch.sh` that scans the last 30
  days of CI runs and lists tests that failed on first attempt and
  passed on retry.
- **Pillar C (Backlog reconcile):** rewrite `docs/BACKLOG.md` §0 status
  board, promote shipped rows to §7 Done, file the deferred rows from
  `docs/audits/clarify-inventory-2026-04-29.md` and
  `docs/audits/extract-inventory-2026-04-29.md`. Run `/backlog-sync` to
  validate.

**Tech Stack.** Bash scripts, Vitest 1.x retry config, GitHub branch
protection, GitHub Actions (no new workflows). No new npm dependencies.

**Base SHA.** `origin/main` after Wave 46 merged (`111e743`). Verify
`git fetch origin && git log origin/main --oneline -3 | grep "wave(46)"`
returns the closeout commit before branching.

**Prerequisites.** Wave 46 merged (`111e743` on main). Waves 47 and 48
remain queued; Wave 49 is independent of both content-wise but should
land before either to avoid threading the merge-protocol change through
in-flight wave PRs.

---

## §1 Hard rules

1. **One PR.** Whole wave on one feature branch `wave49-housekeeping`.
2. **No new dependencies.** Reuse existing Vitest config + bash. No new GitHub Actions, no new npm packages.
3. **Pillar A's branch-protection change requires admin.** Document the steps in the PR body so the user can apply them via GitHub Settings UI; do NOT attempt to apply via gh API in the PR commit.
4. **Pillar A is reversible.** If post-merge `ci` starts failing more often than expected, restoring `.~~mergify~~.yml` is one PR. The change is not load-bearing on anything else.
5. **Memory entries get rewritten, not deleted.** `feedback_rebase_before_push.md` (project memory) becomes "rebase only for high-stakes PRs touching `security/`, `audit/`, `storage/`." `project_ci_~~mergify~~_discrepancy.md` gets a "resolved by Wave 49 — ~~Mergify~~ removed" closeout note.
6. **Pillar B retries must be opt-in per test.** No global vitest retry — that would mask real regressions wholesale. Only tests listed in `known-flakes.md` get the retry wrapper, and the registry includes a "fix-by" date for each entry to prevent permanent quarantine.
7. **Pillar C runs after A and B in the same PR but in a separate commit** so the BACKLOG diff is reviewable independently.
8. **Local gate green** (`npm run typecheck && npm run lint && npm run test:coverage`) before push.
9. **No Codex adversarial gate required.** This wave touches no production code paths; the gate is intended for code-quality finds, not infrastructure or doc reconciliation. State this explicitly in the PR body so the convention isn't accidentally relaxed for future waves.
10. **No `gh pr ready` while CI is red.** Per CLAUDE.md.

## §2 Out of scope

- **Major dep bumps** (Storybook 8→10, React 18→19, ~61 stale deps). Each is a wave's worth of risk and shouldn't bundle with merge-protocol change. File a backlog row per dep family.
- **Type-strictness round 2.** ~50 markers remain post-Wave-44. Diffuse, low user-value; defer.
- **GitHub native Merge Queue adoption.** Considered as alternative to Pillar A; rejected because squash-merging makes the up-to-date requirement (and therefore queue serialization) unnecessary. File a backlog row noting the option exists if we ever revisit.
- **Fixing the underlying accordion-test race.** Pillar B quarantines it with a fix-by date; the actual fix is its own ticket because it requires understanding the RTL + IntersectionObserver + accordion lazy-mount interaction.
- **Promoting `MIN_PASSPHRASE_LEN`** to client-side validation. Filed as a backlog row in Pillar C, deferred to a future Wave.
- **Replacing `vi.spyOn(window, 'prompt')` patterns project-wide** with the Wave 47-planned Dialog migration. That's Wave 47's job.

## §3 Files in scope

**Pillar A — Merge protocol:**
- Delete: `.~~mergify~~.yml` (if present at repo root)
- New: `scripts/rebase-and-merge.sh` (high-stakes PR escape hatch)
- Modify: `docs/CLAUDE.md` — "PR Merge Policy" + "Subagent Dispatch Rules" + "CI Discipline" sections to reflect: rebase-before-push is no longer mandatory; rebase-and-merge.sh is the opt-in path for `security/`, `audit/`, `storage/` PRs.
- Modify: `~/.claude/projects/-Users-bradygrapentine-projects-lease-analyzer/memory/feedback_rebase_before_push.md` — rewrite scope.
- Modify: `~/.claude/projects/-Users-bradygrapentine-projects-lease-analyzer/memory/project_ci_~~mergify~~_discrepancy.md` — append "resolved by Wave 49" closeout.
- New memory: `~/.claude/projects/-Users-bradygrapentine-projects-lease-analyzer/memory/project_post_merge_ci_safety_net.md` — explains that the post-merge `ci` workflow on `main` is now the canonical semantic-conflict safety net (instead of the up-to-date branch requirement).
- PR body must document the GitHub Settings UI steps for the user to apply branch protection changes (turn off "Require branches to be up to date before merging"; remove ~~Mergify~~ Merge Queue from required status checks if listed).

**Pillar B — Flake hygiene:**
- New: `app/src/test/known-flakes.md` — registry with columns: test path, test name, first-observed date, fix-by date, hypothesis, owning skill/file. Today's accordion test is the seed entry.
- Modify: `app/src/ui/AppLibraryAndPacksPane.accordion.test.tsx` — convert the "governance group expands on header click — AuditLog enters the DOM" test from `it('name', fn)` to `it('name', { retry: 2 }, fn)` per vitest 1.x's native per-test retry option. No helper file needed.
- New: `scripts/flake-watch.sh` — scans `gh run list --workflow ci --branch main --limit 100 --json` for runs that failed-then-passed via rerun; lists culprit tests grouped by frequency. Run weekly or on demand.

**Pillar C — Backlog reconcile:**
- Modify: `docs/BACKLOG.md` — §0 status board count refresh; §7 Done append all shipped Wave-45/46 follow-up rows; §1 Ready append the new deferred rows enumerated below.
- Verification: run `/backlog-sync` skill at the end of the pillar to validate against `git log` and open PRs (zero, post Wave 46).

**New BACKLOG rows to file (Pillar C):**

From `docs/audits/clarify-inventory-2026-04-29.md`:
- VersionHistoryPanel destructive-confirm (sev=M)
- `MIN_PASSPHRASE_LEN` client-side promotion (sev=L)
- Slice 2 — audit-log kind→label adapter + OnboardingTour severity vocab fix + PackManager "Community"→"Unsigned" rename
- Slice 3 — empty-state + helper-text + jargon plain-readings polish (~15 strings, ~10 panels)

From `docs/audits/extract-inventory-2026-04-29.md`:
- Slice 2 — Card density/surface variants (collapses MiniCardListRow's 5 raised + 3 sunken callsites)
- Slice 3 — StatusMessage + ConfirmDialog primitives (17 + 6 callsites)
- ComparePanel h3 migration to PanelHeader (deferred from Wave 48)
- EvidenceQuote re-eval after Wave 47 (currently 2 callsites; below threshold)
- `state-hover` / `state-active` token alias promotion in DESIGN.json

From this session's incidents:
- Underlying RTL + IntersectionObserver race fix for `AppLibraryAndPacksPane.accordion.test` (linked to known-flakes.md entry)
- GitHub native Merge Queue revisit option (background row, no urgency)
- Storybook 8→10 major bump (defer to dedicated wave)
- React 18→19 major bump (defer to dedicated wave)
- Type-strictness round 2 (~50 markers; diffuse low-value)

## §4 Item ordering

1. **Pillar A first.** Merge-protocol change. Branch-protection edits remain user-applied via GitHub Settings UI; `.~~mergify~~.yml` deletion + `scripts/rebase-and-merge.sh` + CLAUDE.md/memory rewrites all land in one commit titled `chore(49-A): drop ~~Mergify~~, document gh-native merge path`.
2. **Pillar B second.** `known-flakes.md` + `withRetry` helper + accordion-test wrap + `flake-watch.sh` in one commit titled `chore(49-B): flake registry + per-test retry + watch script`.
3. **Pillar C last.** Single commit `chore(49-C): reconcile BACKLOG with shipped Wave 45/46 + deferred rows from clarify + extract inventories`.
4. Push, open PR, attempt one `gh pr merge --auto --squash --delete-branch` after CI green.

## §5 Verification gates

1. **Pillar A.** Locally simulate the merge protocol: open a tiny test PR, verify it merges via `gh pr merge --auto --squash` after CI green without requiring a rebase. (Optional, skip if confidence is high.)
2. **Pillar B.** Run `app/src/ui/AppLibraryAndPacksPane.accordion.test.tsx` 10× locally (`for i in {1..10}; do npx vitest run AppLibraryAndPacksPane.accordion --reporter=basic; done`). With `withRetry(it, 2)`, observed flakes should self-heal; net result: 10/10 pass. Without the wrapper, expect 1-2 false reds.
3. **Pillar C.** `/backlog-sync` skill invocation reports clean: zero stale "In progress" rows, status-board counts match §1+§2+§3 enumeration.
4. **Local gate.** `npm run typecheck && npm run lint && npm run test:coverage` green.
5. **CI.** `gh pr checks` all green, no pending.

## §6 Risks and mitigations

- **Pillar A: semantic-conflict slipping through PR-CI but caught only by post-merge `ci`.** Mitigation: post-merge `ci` runs on every commit to `main`; today's flake on `bed8be6` proved the safety net works. Reverts on `main` are cheap (single PR). Acceptable risk for the rebasing toil eliminated.
- **Pillar A: branch-protection change requires user admin action.** Mitigation: PR body lists exact Settings UI steps; the change is reversible. The `.~~mergify~~.yml` deletion + rebase-and-merge.sh ship even if the user defers the protection edit; they're additive.
- **Pillar B: flake registry becomes a permanent garbage dump.** Mitigation: every entry has a fix-by date; `flake-watch.sh` could grow to alert on entries that pass their fix-by date.
- **Pillar B: per-test retry masks a real regression.** Mitigation: only tests in the registry get `withRetry`; default suite remains zero-retry. New flakes still fail loudly until added to the registry, forcing inspection.
- **Pillar C: backlog rewrite collides with concurrent edits.** Mitigation: no other PRs are open (Wave 46 just merged); land Pillar C as the final commit before push to minimize the window.
- **Cross-pillar: this is the first wave shipping under the new merge protocol.** Mitigation: it's also the wave that defines the new protocol — meta-self-validation. If it can't merge cleanly, A is wrong and we revert.

## §7 Success definition

- `.~~mergify~~.yml` removed from repo (or absent if it was never tracked); GitHub branch protection on `main` no longer requires up-to-date branches; `scripts/rebase-and-merge.sh` exists and is tested.
- `app/src/test/known-flakes.md` exists with at least the accordion-test entry; the test self-heals on retry; `flake-watch.sh` runs and reports.
- `docs/BACKLOG.md` reflects current truth: shipped Wave-45/46 follow-ups in §7 Done; new rows from clarify + extract inventories filed; status-board counts accurate.
- CLAUDE.md and memory entries updated; no contradictory rebase guidance remains.
- One follow-up backlog row each for: deferred dep bumps, type-strictness round 2, accordion-test underlying race fix, GitHub native Merge Queue option.

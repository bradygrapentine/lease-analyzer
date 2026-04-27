# Wave 34 — Hygiene 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear three accumulated friction debts so Wave 36's transformers migration can dispatch cleanly: (B) fix subagent Bash-permission failures, (C) audit all 40 Storybook stories in dark mode and fix top issues, (A) finish the orphaned Wave 33-E branch-coverage push.

**Architecture.** B is a project-local permissions config edit + a one-paragraph CLAUDE.md addition; runs first, directly in the orchestrator session. C is a full Storybook walk in light + dark with a capped fix pass. A inherits Wave 33 §4 Part E rules unchanged: targeted unit/component tests at branch-coverage cliffs, conditional floor bump. **B merges before C+A dispatch** — that ordering doubles as B's end-to-end verification.

**Tech Stack.** Claude Code project settings (JSON), React 18 + TypeScript (`strict`, `noUncheckedIndexedAccess`), Vite, Vitest + RTL with v8 coverage, Tailwind v4, Storybook 8.

**Base SHA.** B branches from `origin/main = 640f35e` (Wave 33-B merge). C and the rebased A branch from post-B-merge main.

**Predecessor:** [Wave 34 Hygiene 2 design spec](../superpowers/specs/2026-04-27-wave34-design.md).

---

## §0 What changed since Wave 33 (context for fresh agents)

Wave 33 (PRs #140 docs, #141 C, #142 B, #143 A) shipped:

- **A** — `npm audit` scoped to runtime deps via `app/scripts/audit-prod.mjs`; custom `ALLOW_ADVISORIES` accept-risk filter for the protobufjs/@xenova chain.
- **B** — `AppRedlinePane` + `AuditLogPanel` converted to `React.lazy` boundaries; "shell-eligible" rule added to `docs/SYSTEM_DESIGN.md`.
- **C** — Dark-mode regression allow-list tightened in `app/src/test/dark-mode-regression.test.ts`.
- **E** — Coverage push **was orphaned** at 90.22% branches; pulled into Wave 34 as Part A.

State at Wave 34 start: `origin/main = 640f35e`, no open PRs, working tree clean, branch-coverage floor `branches: 90` in `app/vite.config.ts:93`.

## §1 Hard rules

1. **Order.** B merges first (direct, this session). After B in main, dispatch C and A in parallel as Sonnet subagents.
2. **B's verification gate.** After B merges, before dispatching C+A, run a throwaway Agent dispatch that executes `gh pr list && npm test --silent --reporter=basic 2>&1 | tail -5` from a temp worktree without prompting. If it prompts, do not dispatch C+A — re-investigate.
3. **C cap is absolute.** ≤8 fixed regressions in this wave, even if the audit surfaces 20. Remainder go to `docs/BACKLOG.md`.
4. **A floor-bump rule** (W33 §4-E carry-over): final branches ≥ 91.2 → bump to 91; ≥ 90.7 → bump to 90.5; else no bump.
5. **No CSP / IDB schema / new third-party deps in Wave 34.**
6. **Heartbeat.** Each dispatched subagent appends `date -u +%Y-%m-%dT%H:%M:%SZ` to `.claude/agent-status/<branch>.log` every ~5 min.

## §2 Out of scope

- Wave 33-D / a11y carve-outs (dropped; nothing concrete is open).
- Storybook chromatic / snapshot infrastructure.
- Restructuring stories or adding new variants.
- Stale-worktree cleanup for Waves 27–33.
- Wave 35 hybrid-data action; Wave 36 transformers migration.

## §3 Execution dependency graph

```
   ┌──────────────────┐
   │ Part B           │
   │ subagent perms   │
   │ (direct, Opus)   │
   └────────┬─────────┘
            │ merge to main
            ▼
   verify dispatch ─── (throwaway Agent runs gh + npm test)
            │
            ▼
   ┌──────────┐   ┌──────────┐
   │ Part C   │   │ Part A   │
   │ darkmode │   │ wave33-E │
   │ walk     │   │ coverage │
   │ (Sonnet) │   │ (Sonnet) │
   └──────────┘   └──────────┘
```

---

## §4 File structure

### Part B
- **Modify:** `.claude/settings.local.json` — replace exact-string allow entries with curated wildcard patterns.
- **Modify (or create if empty):** `.claude/CLAUDE.md` — append one short paragraph documenting the subagent perm convention.

### Part C
- **Create:** `wave34-darkmode-audit-results.md` (PR-only artifact in PR description; do **not** commit) — table of 40 stories × {light, dark, notes}.
- **Modify:** up to 8 of `app/src/ui/**/*.{tsx,css}` — token swaps and dark-aware variants only. No JSX restructure.
- **Modify:** `app/src/test/dark-mode-regression.test.ts` (only if a fix changes the regression-test scope).
- **Modify:** `docs/BACKLOG.md` — append a `### Wave 34 dark-mode follow-ups` section listing remaining audit issues.

### Part A
- **Create or modify:** up to 6 files under `app/src/**/*.test.{ts,tsx}` — targeted branch-coverage tests.
- **Modify (conditional):** `app/vite.config.ts:93` — `branches` floor per the bump rule.

---

## §5 Part B — Subagent Bash-permission fix (direct, this session)

**Branch:** `wave34-B-subagent-perms`
**Worktree:** `worktrees/wave34-B-subagent-perms`
**Mode:** Direct (Opus, in this session). No subagent dispatch for this part.
**Cap:** 0 src, 0 test, 1 tracked doc file (`docs/CLAUDE.md`).

> **Post-brainstorm correction (2026-04-27):** `.claude/` is gitignored project-wide. The `settings.local.json` rewrite below applies as a **local-only** edit on the orchestrator's main checkout — it does not ship in any PR. The wave34-B PR ships only the **convention paragraph** in `docs/CLAUDE.md` (a tracked file) plus the spec and plan docs themselves. New machines need to recreate the wildcard set on first dispatch; the convention section in `docs/CLAUDE.md` documents the canonical shape.

### Task B1: Create the worktree and branch

**Files:**
- New worktree at `worktrees/wave34-B-subagent-perms`

- [ ] **Step 1: Verify base**

```bash
git fetch origin
git rev-parse origin/main
```

Expected: `640f35e9...` (Wave 33-B merge SHA from `git log origin/main --oneline -1`).

- [ ] **Step 2: Create worktree**

```bash
git worktree add -b wave34-B-subagent-perms worktrees/wave34-B-subagent-perms origin/main
```

Expected: `Preparing worktrees/wave34-B-subagent-perms (identifier wave34-B-subagent-perms)` then `HEAD is now at 640f35e ...`.

### Task B2: Replace exact-string allow entries with wildcards

**Files:**
- Modify: `worktrees/wave34-B-subagent-perms/.claude/settings.local.json`

- [ ] **Step 1: Inspect the current allow-list**

```bash
cat worktrees/wave34-B-subagent-perms/.claude/settings.local.json
```

Note every existing entry. The current file (per Wave 34 brainstorm 2026-04-27) has these:

```
Bash(mkdir -p /Users/bradygrapentine/projects/lease-analyzer/.claude/worktrees/agent-a8f23ca95ea8a1fe2/.claude/agent-status)
Bash(echo "2026-04-25T19:00:00Z reading plan")
Bash(mkdir -p /Users/bradygrapentine/projects/lease-analyzer/.claude/worktrees/agent-a39d1e379ac9ef4a7/.claude/agent-status)
Bash(date)
Bash(echo "started hardening")
Bash(gh pr *)
Bash(git checkout *)
Bash(git pull *)
Bash(mkdir -p /Users/bradygrapentine/projects/lease-analyzer/.claude/agent-status)
Bash(echo "$\(date -u +%Y-%m-%dT%H:%M:%SZ\) wave27-A: starting implementation - read plan, read existing files")
Bash(echo "$\(date -u +%Y-%m-%dT%H:%M:%SZ\) [wave27-B] Starting - reading plan and inventorying components")
Bash(echo "$\(date -u +%Y-%m-%dT%H:%M:%SZ\) Wave27-C implementer starting")
Bash(mkdir -p .claude/agent-status worktrees)
Bash(git worktree *)
```

- [ ] **Step 2: Rewrite the file with wildcard patterns**

Overwrite `worktrees/wave34-B-subagent-perms/.claude/settings.local.json` with exactly:

```json
{
  "permissions": {
    "allow": [
      "Bash(echo *)",
      "Bash(date *)",
      "Bash(date)",
      "Bash(mkdir -p *)",
      "Bash(ls *)",
      "Bash(ls)",
      "Bash(cat *)",
      "Bash(grep *)",
      "Bash(find *)",
      "Bash(git *)",
      "Bash(gh *)",
      "Bash(npm *)",
      "Bash(npx *)"
    ]
  }
}
```

Rationale: every retired exact-string entry is subsumed by one of these wildcards. The bare `Bash(date)` and `Bash(ls)` entries cover the no-arg invocations that subagents use for heartbeat / cwd-check.

- [ ] **Step 3: Commit**

```bash
cd worktrees/wave34-B-subagent-perms
git add .claude/settings.local.json
git commit -m "wave34-B: replace exact-string allow entries with wildcard patterns

Subagents launched via Agent inherit settings.local.json but not the
orchestrator's bypassPermissions defaultMode. Exact-string entries
like Bash(echo \"started hardening\") never match the next subagent's
unique timestamp/agent-id, forcing inline takeover. Curated wildcards
match what subagents actually run.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task B3: Document the subagent perm convention in `.claude/CLAUDE.md`

**Files:**
- Modify: `worktrees/wave34-B-subagent-perms/.claude/CLAUDE.md`

- [ ] **Step 1: Inspect current contents**

```bash
cat worktrees/wave34-B-subagent-perms/.claude/CLAUDE.md
```

The file is currently empty (1 line). It will receive the project-local subagent perm doc.

- [ ] **Step 2: Write the file**

Write `worktrees/wave34-B-subagent-perms/.claude/CLAUDE.md` with this content:

```markdown
# Project guidance — lease-analyzer

## Subagent Bash permissions

Subagents launched via the Agent tool inherit this directory's
`.claude/settings.local.json` allow-list **but do not inherit the
orchestrator's `bypassPermissions` default mode** (that is by design
— bypass is unsafe to propagate). Keep the allow-list pattern-based
(`Bash(npm *)`, `Bash(git *)`, etc.), never exact-string. Exact
strings like `Bash(echo "2026-04-25T19:00:00Z reading plan")` only
match one specific invocation and force every subsequent subagent
into inline takeover.

When you see permission prompts in a dispatched subagent, the fix is
almost always to widen `.claude/settings.local.json` with a new
wildcard, not to grant a one-off exact-string entry.
```

- [ ] **Step 3: Commit**

```bash
cd worktrees/wave34-B-subagent-perms
git add .claude/CLAUDE.md
git commit -m "wave34-B: document subagent perm convention in project CLAUDE.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task B4: Push, open PR, merge

- [ ] **Step 1: Push**

```bash
cd worktrees/wave34-B-subagent-perms
git push -u origin wave34-B-subagent-perms
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "wave34-B: subagent Bash-permission fix (wildcards + CLAUDE.md note)" --body "$(cat <<'EOF'
## Summary
- Replace exact-string allow-list entries in \`.claude/settings.local.json\` with curated wildcard patterns subagents actually hit.
- Add a short \`.claude/CLAUDE.md\` paragraph documenting the convention so future entries stay pattern-based.

## Why
Every parallel-dispatched subagent in Waves 31/32/33 needed inline takeover because exact-string entries like \`Bash(echo "started hardening")\` matched exactly one prior invocation. Subagents inherit \`settings.local.json\` but not the orchestrator's \`bypassPermissions\` mode, so the narrow allow-list is the binding constraint.

## Test plan
- [ ] CI green (verify, smoke, Lighthouse).
- [ ] After merge, dispatch a throwaway Agent task that runs \`gh pr list && npm test --silent --reporter=basic\` and confirm it does not prompt.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Auto-merge once**

```bash
gh pr merge --auto --squash
```

If rejected: print PR URL, current `gh pr checks` status, what's blocking, then **stop** and hand off. Do not retry.

- [ ] **Step 4: Wait for merge, sync local main**

```bash
gh pr checks --watch
git -C /Users/bradygrapentine/projects/lease-analyzer fetch origin
git -C /Users/bradygrapentine/projects/lease-analyzer checkout main
git -C /Users/bradygrapentine/projects/lease-analyzer pull --ff-only
git -C /Users/bradygrapentine/projects/lease-analyzer log --oneline -3
```

Expected: top commit is the squashed `wave34-B: subagent Bash-permission fix ...`.

### Task B5: End-to-end verification

- [ ] **Step 1: Dispatch a throwaway test subagent**

In the orchestrator session, dispatch via the Agent tool with this prompt (use general-purpose subagent_type, Sonnet):

> "Run these commands from `/Users/bradygrapentine/projects/lease-analyzer` and report exit codes only:
> 1. `gh pr list --state open --limit 5`
> 2. `cd app && npm test --silent --reporter=basic 2>&1 | tail -5`
> Report the final tail-5 lines of output and whether any command prompted for permission. Under 100 words."

- [ ] **Step 2: Confirm no prompt occurred**

Expected result: subagent reports both commands ran; no permission prompt mentioned. If a prompt fired, **halt** — the wildcard set missed something. Investigate which command tripped, widen the allow-list, repeat.

If verification passes, B is done. Proceed to dispatch C+A.

---

## §6 Part C — Storybook dark-mode walk (parallel dispatch)

**Branch:** `wave34-C-storybook-darkmode`
**Worktree:** `worktrees/wave34-C-storybook-darkmode`
**Heartbeat:** `.claude/agent-status/wave34-C.log`
**Subagent type:** Sonnet, fresh context.
**Cap:** ≤8 modified src/css, ≤4 test files, ≤1 doc (`docs/BACKLOG.md`). 0 new src.
**Base SHA:** post-B-merge `origin/main`.

### Task C1: Set up the worktree (orchestrator does this before dispatch)

- [ ] **Step 1: Verify base after B merge**

```bash
git fetch origin
git rev-parse origin/main
```

Capture the SHA — this is the base for C.

- [ ] **Step 2: Create worktree and heartbeat log**

```bash
git worktree add -b wave34-C-storybook-darkmode worktrees/wave34-C-storybook-darkmode origin/main
mkdir -p .claude/agent-status
date -u +%Y-%m-%dT%H:%M:%SZ > .claude/agent-status/wave34-C.log
```

- [ ] **Step 3: Symlink node_modules to avoid reinstall**

```bash
ln -s ../../app/node_modules worktrees/wave34-C-storybook-darkmode/app/node_modules
```

### Task C2: Dispatch the C subagent

- [ ] **Step 1: Send the brief**

Use the Agent tool (`general-purpose`, Sonnet, run in background). The prompt below is self-contained:

> **Wave 34 Part C — Storybook dark-mode audit + capped fix**
>
> **Worktree:** `/Users/bradygrapentine/projects/lease-analyzer/worktrees/wave34-C-storybook-darkmode`
> **Branch:** `wave34-C-storybook-darkmode` (already created off post-B-merge main).
> **Heartbeat:** append `date -u +%Y-%m-%dT%H:%M:%SZ` to `.claude/agent-status/wave34-C.log` every ~5 min while working.
>
> **Goal.** Walk all 40 Storybook stories under `app/src/ui/**/*.stories.tsx` in both light and dark themes. Record findings as a per-story table (light OK?, dark OK?, notes). Fix the **8 most user-visible** dark-mode regressions in this PR. File the rest as backlog rows.
>
> **Theme toolbar.** Wired by Wave 32-B in `app/.storybook/preview.tsx`. Use it to toggle each story.
>
> **Storybook command.** From the worktree's `app/` dir: `npm run storybook` (port may differ — read the CLI output).
>
> **Audit priority order for the ≤8 fixes:**
> 1. Top-level pane components shown on app load (`AppHeader`, primary panels).
> 2. System primitives in `app/src/ui/system/*` (`Button`, `Card`, `SectionGroup`, `Field`, `Section`, `EmptyState`, `Badge`, `Tokens`).
> 3. Domain panels (`SeverityOverridesPanel`, `FindingsPanel`, etc.).
>
> **Fix style.** Token swaps and dark-aware variants only. No JSX restructure. No new aria-* / role / data-* attrs (preserve test selectors).
>
> **Caps.** ≤8 modified `app/src/ui/**/*.{tsx,css}` files. ≤4 test files (only if a fix expands the regression-test scope). ≤1 doc (`docs/BACKLOG.md`).
>
> **Backlog format.** Append a `### Wave 34 dark-mode follow-ups` section under `docs/BACKLOG.md`'s open-items area with `[ ]` rows. Each row names the story and the issue.
>
> **Existing dark-mode regression test** at `app/src/test/dark-mode-regression.test.ts` must stay green.
>
> **Local gates before push:** `cd app && npm run typecheck && npm run lint && npm test` — all green.
>
> **PR.** Title `wave34-C: storybook dark-mode audit + ≤8 fixes`. Body must include the 40-row audit table, the 8 (or fewer) applied fixes with one-line rationale each, and a link to the new BACKLOG section.
>
> **Auto-merge:** `gh pr merge --auto --squash`. If rejected, stop and report; do not retry.
>
> **No git stash** (shared `.git` cross-pollutes WIP across worktrees).
>
> Heartbeat reminder: timestamp every ~5 min.

- [ ] **Step 2: Note the agent ID and log location**

When the Agent tool returns the dispatch ID, record it. Poll `.claude/agent-status/wave34-C.log` every ~10 min; >30 min idle → treat as stalled per `subagent-heartbeat` skill.

---

## §7 Part A — Wave 33-E branch-coverage push (parallel dispatch)

**Branch:** `wave34-A-coverage` (new — replaces orphaned `wave33-E-coverage`)
**Worktree:** `worktrees/wave34-A-coverage`
**Heartbeat:** `.claude/agent-status/wave34-A.log`
**Subagent type:** Sonnet, fresh context.
**Cap:** 0 src, ≤6 test, conditional 1 config (`app/vite.config.ts`).
**Base SHA:** post-B-merge `origin/main`.

### Task A1: Set up the worktree (orchestrator)

- [ ] **Step 1: Create worktree and heartbeat**

```bash
git worktree add -b wave34-A-coverage worktrees/wave34-A-coverage origin/main
mkdir -p .claude/agent-status
date -u +%Y-%m-%dT%H:%M:%SZ > .claude/agent-status/wave34-A.log
ln -s ../../app/node_modules worktrees/wave34-A-coverage/app/node_modules
```

(The orphaned `wave33-E-coverage` worktree at `worktrees/wave33-E-coverage` had no commits beyond main and is superseded — leave it alone, it'll be cleaned up in the worktree-housekeeping pass.)

### Task A2: Dispatch the A subagent

- [ ] **Step 1: Send the brief**

Use the Agent tool (`general-purpose`, Sonnet, run in background). Prompt:

> **Wave 34 Part A — Branch-coverage push (W33-E carry-over)**
>
> **Worktree:** `/Users/bradygrapentine/projects/lease-analyzer/worktrees/wave34-A-coverage`
> **Branch:** `wave34-A-coverage` (created off post-B-merge main).
> **Heartbeat:** append `date -u +%Y-%m-%dT%H:%M:%SZ` to `.claude/agent-status/wave34-A.log` every ~5 min.
>
> **Goal.** Lift `npm run test:coverage` branch coverage above the current 90.22% baseline by adding targeted unit / component tests at coverage cliffs. Then apply the conditional floor-bump rule.
>
> **Conditional floor bump (W33 §4-E carry-over):**
> - Final branches ≥ **91.2%** → bump `branches` floor in `app/vite.config.ts:93` from 90 to **91**.
> - Final branches ≥ **90.7%** → bump to **90.5**.
> - Else **no bump**; PR description must state the no-bump rationale.
>
> **Caps.** 0 new or modified src files. ≤6 test files (new or extended). At most 1 config edit (`app/vite.config.ts`, conditional on the rule).
>
> **No contrived tests on defensive code.** Wave 24-C's lesson: only add tests that exercise meaningful error / fallback branches. If the only way to bump coverage is `?? 0` / `?? ''` artifacts, prefer a no-bump.
>
> **Approach.**
> 1. From the worktree's `app/`: run `npm run test:coverage`. Capture the per-file branch coverage from the v8 text reporter.
> 2. Identify 3–6 files with the largest uncovered-branch counts that aren't defensive-guard noise.
> 3. Add targeted tests. Each new test must assert observable behavior, not implementation detail.
> 4. Re-run coverage. Capture before / after numbers.
> 5. Apply the floor-bump rule.
>
> **Local gates before push:** `cd app && npm run typecheck && npm run lint && npm run test:coverage` — all green.
>
> **PR.** Title `wave34-A: branch-coverage push (W33-E carry-over)`. Body must include before / after coverage numbers (statements / branches / functions / lines) and the chosen floor decision with rationale.
>
> **Auto-merge:** `gh pr merge --auto --squash`. If rejected, stop and report; do not retry.
>
> **No git stash.** Heartbeat reminder: timestamp every ~5 min.

- [ ] **Step 2: Record agent ID, monitor heartbeat**

Same protocol as C — poll log every 10 min, halt if stalled >30 min.

---

## §8 Wave wrap-up (orchestrator, after both C and A merge)

- [ ] **Step 1: Verify both PRs merged**

```bash
git fetch origin
git log origin/main --oneline -5
gh pr list --state open --limit 5
```

Expected: top of main has `wave34-C` and `wave34-A` squash commits; no Wave 34 PRs open.

- [ ] **Step 2: Run full local gates against post-merge main**

```bash
git checkout main && git pull --ff-only
cd app
npm run typecheck && npm run lint && npm test
npx playwright test
```

Expected: all green. Multi-PR auto-merge can mask semantic-integration regressions; this is the catch.

- [ ] **Step 3: Update memory**

In `~/.claude/projects/-Users-bradygrapentine-projects-lease-analyzer/memory/`, update the dated session file with: Wave 34 outcome, B's verification result, any new follow-up items in BACKLOG.

- [ ] **Step 4: Archive worktrees (optional, deferred)**

Stale Wave 27–33 worktrees can be cleaned up at session end via `/clean_gone` or manual `git worktree remove`. Not blocking.

---

## §9 Risks and mitigations (carried from spec)

| Risk | Mitigation |
|---|---|
| Wildcard set is still incomplete; verification subagent prompts. | B's Task B5 halts the wave; widen allow-list and re-verify before dispatching C+A. |
| C audit surfaces >8 user-visible regressions. | Strict priority order in the brief; any drop of a top-level pane regression escalates to orchestrator for cap-bump approval rather than ships a known visible regression. |
| A pushes coverage just under a tier (e.g., 90.69%). | Intended behavior — no bump, no contrived tests. PR documents rationale. |
| Two parallel subagents hit a real conflict on `docs/BACKLOG.md` or `app/vite.config.ts`. | C touches BACKLOG, A touches vite.config — file-disjoint by design. |
| C subagent's local gates take long enough to mask a typecheck regression introduced by A (or vice versa). | §8 Step 2 re-runs the full gate suite against merged main as the integration check. |

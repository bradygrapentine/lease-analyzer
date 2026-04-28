# Wave 39 — Cross-cutting tech-debt sweep Implementation Plan

> **Pairing:** Runs in parallel with **Wave 43 (coverage threshold raise)** — disjoint file ownership (W39 owns deps, scripts, non-UI source; W43 owns test files and `app/vite.config.ts` coverage block only).

**Goal:** Pick **2-3** items from the "Cross-cutting tech debt" section
of `docs/BACKLOG.md` (line ~637) and ship them in one PR. Read the
section, score by ratio of (annoyance × frequency) ÷ (effort), pick the
top 2-3, and ship.

**Architecture.** Stay non-invasive. Tech debt items vary; the bias is
toward small mechanical wins (rename, dedupe, dead-code prune, dep
upgrade) over architectural changes. Anything that touches >5 files or
needs a migration belongs in its own dedicated wave, not here.

**Tech Stack.** Whatever the chosen items touch. Likely TS/Vite/eslint
config, scripts in `app/scripts/*.mjs`, or non-UI modules.

**Base SHA.** `origin/main` at start of session. Read-only until §4.

## §1 Hard rules

1. **2-3 items max.** Not 4. If you find 5 great ones, ship 3 and
   document the other 2 as follow-up wave candidates.
2. **No UI files in this wave.** Wave 41 (WCAG audit) owns `app/src/ui/**`
   in the parallel session. Conflict = abort.
3. **No test files in this wave.** Wave 43 owns coverage work;
   Wave 39 ships only fixes that don't require new tests *or* extends
   tests for the specific files it edits (1-2 files max).
4. **Each item gets a 1-paragraph "why" in the PR body.** If you can't
   articulate why it's worth shipping, it isn't.
5. **Touch ≤ 6 files total** across all items. Hard cap.

## §2 Out of scope

- Anything labeled "Wave NN" in the backlog (those have / will have
  their own plans).
- Storybook story additions (Wave 32/34 territory).
- Coverage threshold changes.
- New rules / new matchers / new panels.

## §3 Execution

Direct, single-track. Estimated 1-2 hours.

## §4 Selection steps

- [ ] **Read** `docs/BACKLOG.md` "Cross-cutting tech debt" section.
- [ ] **Score** each open `[ ]` item: estimate effort (S/M/L), annoyance
  (1-5), and frequency-of-impact (1-5). Skip anything labeled L
  (large) — those need dedicated waves.
- [ ] **Pick 2-3** with the best (annoyance × frequency) ÷ effort ratio.
  Prefer items that touch disjoint files (so a single review is easy).
- [ ] **Confirm scope with the orchestrator** before editing — print the
  list and the file impact estimate. (If running headless, proceed but
  surface the picks prominently in the PR description.)

## §5 File changes

Driven by the picks. Likely shapes:

- A small rename (`git mv` + import-update sweep).
- A dead-code prune (`grep -r` to confirm unreferenced, then delete).
- A dep upgrade in `app/package.json` (minor/patch only — major bumps
  are their own wave). Run `npm install` and confirm `npm audit` is
  still green.
- A `.eslintrc` rule promotion from warn → error if the warn count is
  already 0.
- A script consolidation in `app/scripts/*.mjs`.

If any pick balloons past the file cap, drop it and pick the next one.

## §6 Verification

- [ ] `npm run typecheck && npm run lint && npm test` green.
- [ ] `npm run build` succeeds.
- [ ] If any dep changed: `npm audit --omit=dev` clean.
- [ ] `git diff --stat` ≤ 6 files (excluding lockfile).
- [ ] Manual smoke if any user-visible code was touched.

## §7 PR

- Title: `wave39: tech-debt sweep (<n> items)`
- Body sections per item:
  - **What.** One sentence.
  - **Why.** One paragraph — annoyance × frequency × effort score.
  - **Files.** List.
- Plus a **Deferred** section listing items considered but not picked,
  with one-line reasons. (This is the breadcrumb for Wave 40+.)

## §8 Risk register

| Risk | Mitigation |
|------|------------|
| "Quick" rename breaks an import the type-checker missed (e.g. dynamic require, string literal). | Run `grep -r '<old-name>' app/ cli/ tests/ docs/` after the rename. |
| Dep upgrade silently breaks runtime in production-only code path. | Lighthouse + e2e CI catches load-path regressions. If the dep is in a code path neither covers, defer it. |
| Picking items that overlap with Wave 41's UI work. | Hard rule §1.2 — `app/src/ui/**` is off-limits. Verify with `git diff --name-only` before commit. |

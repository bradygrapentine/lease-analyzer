# Wave 30 — Hybrid precision panel, accordion persistence, CI trust infra, coverage

> **For agentic workers:** REQUIRED SUB-SKILL: use
> `superpowers:subagent-driven-development` to dispatch Parts A–C per
> the matrix in §6. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal.** Close the hybrid-quality loop opened by Wave 29-C and pay down
the Wave 28 trust-infra debt. Four threads, each closing a specific loop:

1. **Hybrid precision panel** — first consumer of the
   `kind:'hybrid-feedback'` audit stream Wave 29-C started writing.
   Per-rule dashboard (fires · not-relevant · precision %) so the next
   wave's allowlist edits are data-driven, not vibes.
2. **Accordion persistence** — reverse Wave 28 §1.2: bottom-pane
   accordions default **closed**, per-section open/closed state
   persists to `localStorage`. Was deferred from Wave 28 retro pending
   its own UX brainstorm (this wave).
3. **CI trust infra** — root-cause and close the Wave 28 ~~Mergify~~
   red-bypass (PRs #113–#116 auto-merged with red `verify`/`smoke`/
   `npm-audit`/`Lighthouse`); install `lhci` binary in CI; verify
   branch-protection required-status-checks list.
4. **Coverage push + small carve-outs** — push branch coverage from
   post-Wave-29 baseline toward 90.0% (conditional floor bump per the
   Wave 29 §1.6 pattern). Optionally absorb 1–2 small a11y carve-outs.

**Architecture.** Four parts. A/B/C dispatchable in parallel against
disjoint file sets. **E (coverage) rebases last** so it can target real
gaps revealed by A/B/C's new code. (Letter D intentionally skipped to
keep the "E rebases last" convention from Waves 21/29 intact.)

**Tech Stack.** React 18 + TypeScript (`strict`,
`noUncheckedIndexedAccess`, `noImplicitOverride`), Vite, Vitest + RTL +
`@testing-library/user-event`, Tailwind v4, Storybook 8, Lighthouse CI
(a11y ≥ 95). CSP-strict — no new network egress, no new third-party
deps, no IDB schema bumps.

---

## §0 What changed since Wave 29 (context for fresh agents)

Wave 29 (PRs #122 plan + #123–#126 parts) shipped:

- **A** — Phase 8 commercial-lease golden fixture (tables + definitions
  + xrefs). Closed last open Phase 8 BACKLOG row.
- **B** — Hybrid classifier allowlist expansion (5–8 new rule ids);
  `golden-real-model` env-gated e2e re-baselined.
- **C** — `kind:'hybrid-feedback'` audit writer + `HybridFeedbackButton`
  on hybrid findings; idempotent on `(ruleId, paragraphIndex, leaseId)`.
  **No consumer UI** — that's Wave 30 Part A.
- **D** — Branch-coverage push toward 90% with conditional floor bump.
- **E** — Severity-bg token pairs; `Button` `sm`/`md` size variants;
  view-mode `role="tablist"` semantics + axe test.

A separate Wave 28 / 29 carry-over: **`enforce_admins: true` was set on
main branch protection mid-Wave 29** to close the bypass pattern, but
the underlying ~~Mergify~~ config that allowed red checks to pass through
the queue is **still unfixed**. Part C of this wave closes that loop.

## §1 Scope-shaping decisions (READ BEFORE APPROVING)

1. **Part A is read-only over the audit chain.** No new audit `kind`s,
   no IDB writes, no schema bumps. The panel iterates the audit chain
   (or a chain-iteration helper if one exists — verify in A.1) and
   aggregates `llm-classify` (denominator) + `hybrid-feedback`
   (numerator-of-rejects) by `ruleId`. Precision = 1 − (rejects / fires).
2. **Part A lives as a sub-tab of the existing rule-manager pane,** not
   as a top-level slot in the `current` view. Groups all "rule
   operations" in one place. Verify the rule-manager component path in
   A.1 and document it in the PR description.
3. **Part A handles the "no data yet" case explicitly.** Fresh installs
   and pre-Wave-29 audit chains have no `hybrid-feedback` entries.
   `EmptyState` (Wave 28-B primitive) renders with copy explaining the
   panel populates as users mark findings not-relevant.
4. **Part B reverses Wave 28 §1.2.** Accordions default **closed**.
   Per-section state keyed `lg.accordion.<sectionId>.open` in
   `localStorage`; presence of the key wins over the default. SSR/jsdom-
   safe (`typeof window === 'undefined'` guard).
5. **Part B does NOT reset accordion state on `delete-lease`.**
   Accordion preferences are UI-level, not lease-level. They persist
   across leases and across `delete-lease` audit events. (Confirmed
   with user during brainstorm.)
6. **Part C diagnoses BEFORE prescribing.** Step C.1 documents the
   actual root cause of the Wave 28 red-bypass (~~Mergify~~ `conditions:`
   missing required check names? branch protection
   `required_status_checks` list incomplete? `enforce_admins` only just
   landed?) before any config edit. No speculative fixes.
7. **Part C `lhci` install is dev/CI parity.** `npm run lhci`
   currently relies on a `lhci` binary that isn't installed in the CI
   environment. Add `@lhci/cli` as a devDependency and wire it into
   the existing Lighthouse workflow. No new workflow files; no new
   external services.
8. **Part E is conditional, like Wave 29-D.** If post-A/B/C branch
   coverage clears 89.5% / 90.0% with ≥0.2% margin, bump the floor
   accordingly. Otherwise add tests without bumping.
9. **No CSP / bundle-budget / dep changes** beyond `@lhci/cli`
   devDependency in Part C. All other parts stay inside the existing
   surface.

## §2 Out of scope

- Hybrid feedback "review queue" UI (lists all flagged findings with
  jump-to-paragraph). Bigger than precision panel; gate on whether the
  precision data justifies a triage workflow.
- Inline aggregate counts in finding tooltips ("N users marked similar
  findings as not-relevant"). Decorative until volume exists.
- Per-rule similarity thresholds. Still gated on Wave 29-B data.
- Demoting rules off the hybrid allowlist based on Part A's data —
  that's the *next* wave's payoff.
- Dark-mode tokens (own wave; explicitly deferred from Wave 29 retro).
- Full WCAG 2.1 AA external audit (deferred per `docs/CLAUDE.md`).
- Real-model on by default (productization step, own wave).

## §3 Execution dependency graph

```
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ Part A   │  │ Part B   │  │ Part C   │
   │ hybrid   │  │ accordion│  │ CI trust │
   │ precision│  │ persist  │  │ infra    │
   └────┬─────┘  └────┬─────┘  └────┬─────┘
        │             │             │
        └─────────────┴──────┬──────┘
                             ▼
                       ┌──────────┐
                       │ Part E   │
                       │ coverage │
                       │ (rebase) │
                       └──────────┘
```

A, B, C branch off `origin/main` and dispatch in parallel. E rebases
off `main` after the others merge so it sees the actual post-merge
coverage delta.

## §4 File-touch matrix

| Part | Branch                              | Src cap | Test cap | Storybook | Notes |
|------|-------------------------------------|---------|----------|-----------|-------|
| A    | `wave30-A-hybrid-precision`         | ≤ 3     | ≤ 2      | 1         | New `HybridPrecisionPanel.tsx` + audit-mining helper + rule-manager wire-up. |
| B    | `wave30-B-accordion-persist`        | ≤ 2     | ≤ 1      | n/a       | Accordion component + storage helper. |
| C    | `wave30-C-ci-trust`                 | 0 src   | 0        | n/a       | `.~~mergify~~.yml`, `.github/workflows/*`, `app/package.json` (`@lhci/cli` dep), branch-protection verification script/notes. |
| E    | `wave30-E-coverage`                 | 0       | as needed| n/a       | Tests only; conditional floor bump. |

Disjoint file sets across A/B/C. E rebases off post-merge `main`.

## §5 Per-part details

### Part A — Hybrid precision panel

**Branch:** `wave30-A-hybrid-precision`

**Goal.** New panel listing each hybrid-eligible rule with: total
fires (count of `kind:'llm-classify'` audit entries for that ruleId),
not-relevant count (count of `kind:'hybrid-feedback'` with
`signal:'not-relevant'` for that ruleId), and derived precision %
(`1 − rejects / fires`). Mounted as a sub-tab of the existing rule-
manager pane.

**Files (new + modified):**

- New `app/src/audit/hybridStats.ts` — pure helper:
  `computeHybridStats(entries: AuditEntry[]): HybridRuleStats[]`
  where `HybridRuleStats = { ruleId, fires, notRelevant, precision }`.
  No IDB access; takes already-loaded entries.
- New `app/src/ui/HybridPrecisionPanel.tsx` — presentational; takes
  `{ stats: HybridRuleStats[] }`; renders table or empty state.
  Sortable by precision asc (worst-first) and fires desc.
- New `app/src/ui/HybridPrecisionPanel.stories.tsx` — Storybook CSF;
  empty state, populated state, single-rule state.
- New `app/src/ui/HybridPrecisionPanel.test.tsx` — RTL; covers empty
  state, sort, precision rounding (e.g. `2/3 = 67%`).
- Modified rule-manager component (verify path in A.1 — likely
  `app/src/ui/RuleManagerPane.tsx` or a sibling) to add the sub-tab.

**Acceptance.**

- [ ] **A.1** Verify rule-manager component path + sub-tab pattern;
      verify audit-chain iteration helper exists or write one in
      `audit/hybridStats.ts`. Document both in PR description.
- [ ] **A.2** Build `computeHybridStats` with full unit-test coverage
      (fires=0 → undefined precision rendered as "—"; rejects > fires
      handled defensively).
- [ ] **A.3** Build `HybridPrecisionPanel` + Storybook + RTL test.
- [ ] **A.4** Wire as rule-manager sub-tab; integration test asserting
      tab renders, switches, and shows `EmptyState` on no data.
- [ ] **A.5** Local gate: `npm run typecheck && npm run lint && npm test`
      + Storybook smoke (new story renders without console errors).

**Out of scope:**

- Any UI to demote rules off the allowlist.
- Time-windowed precision (last 7d, last 30d).
- Per-jurisdiction breakdown.
- Export of stats to CSV / JSON.

### Part B — Accordion default-closed + localStorage persistence

**Branch:** `wave30-B-accordion-persist`

**Goal.** Reverse Wave 28 §1.2: bottom-pane accordions default
**closed**. Per-section open/closed state persists across reloads via
`localStorage` keyed `lg.accordion.<sectionId>.open` (string `'1'` or
`'0'`). Presence of the key overrides the default.

**Files:**

- Modified accordion component (verify path — likely
  `app/src/ui/system/Accordion.tsx` or component under
  `app/src/ui/system/` from Wave 28-C). Default `defaultOpen={false}`;
  on mount, read `localStorage` key and apply if present; on toggle,
  write key.
- New `app/src/ui/system/accordionStorage.ts` — small helper:
  `readAccordionState(id)` / `writeAccordionState(id, open)`. SSR-safe
  (`typeof window === 'undefined'` guard); swallows
  `QuotaExceededError`.
- Modified accordion test (or new `accordionStorage.test.ts`) covering:
  default-closed when no key; respects stored `'1'`; respects stored
  `'0'`; ignores malformed values; SSR no-op.

**Acceptance.**

- [ ] **B.1** Verify accordion component path + Wave 28-C section ids
      pattern. Document in PR description.
- [ ] **B.2** Add storage helper with unit tests including SSR + quota
      paths.
- [ ] **B.3** Update accordion component default + wire reads/writes.
- [ ] **B.4** Update existing accordion test for new default; assert
      storage round-trip on toggle.
- [ ] **B.5** Local gate: `typecheck && lint && test`. Manual browser
      check: open one section, reload, observe persistence.

**Out of scope:**

- Reset on `delete-lease` (per §1.5).
- "Expand all" / "Collapse all" affordance.
- Migration / cleanup of stored keys.
- Persistence beyond accordions (e.g. view-mode tab).

### Part C — CI trust infra (~~Mergify~~, lhci, branch protection)

**Branch:** `wave30-C-ci-trust`

**Goal.** Three CI hygiene fixes:

1. **Diagnose + close** the Wave 28 ~~Mergify~~ red-bypass (PRs #113–#116
   auto-merged with red checks). Update `.~~mergify~~.yml` so the queue
   merge condition requires the actual GitHub Actions check names
   currently emitted (verify with `gh pr checks` on a recent PR).
2. **Install `lhci` in CI.** `npm run lhci` currently fails locally
   (per `docs/CLAUDE.md`); add `@lhci/cli` as a devDependency and
   confirm the existing Lighthouse workflow runs it via the
   project-local binary.
3. **Verify branch-protection required-status-checks list** via
   `gh api repos/.../branches/main/protection`. Document the actual
   list in the PR description; if any required check is missing
   (verify, smoke, npm-audit, Lighthouse), update the protection rule
   and document the change.

**Files:**

- `.~~mergify~~.yml` (root) — `conditions:` updates so the queue requires
  the real status check names.
- `.github/workflows/*.yml` (verify which workflow owns Lighthouse) —
  ensure `npx lhci ...` (project-local) rather than expecting a system
  binary.
- `app/package.json` — `@lhci/cli` devDependency (and `package-lock`
  regen).
- New `docs/wave30-ci-postmortem.md` — short write-up: what bypassed
  the checks in Wave 28, the fix, the verification.

**Acceptance.**

- [ ] **C.1** Diagnose ~~Mergify~~ config + branch protection state.
      Document the actual root cause in PR description (and in the
      postmortem doc) BEFORE editing config.
- [ ] **C.2** Update `.~~mergify~~.yml` `conditions:`. Verify by inspecting
      current required check names from a recent PR via `gh pr checks`.
- [ ] **C.3** Add `@lhci/cli` devDep; update workflow if needed; run
      `npm run lhci` locally to confirm it works against the project-
      local binary.
- [ ] **C.4** Verify required-status-checks via `gh api`; document
      gaps; update protection if missing checks identified.
- [ ] **C.5** Write `docs/wave30-ci-postmortem.md` (≤ 1 page) covering
      root cause, fix, verification, and a "what we'd do differently"
      paragraph.
- [ ] **C.6** Local gate (no app code changed; `npm install` clean,
      `npm run lhci` green locally).

**Out of scope:**

- Migrating off ~~Mergify~~ entirely (own discussion).
- Adding new CI checks (security, perf budget tightening, etc.).
- Self-hosted runners.
- Reverting Wave 29's `enforce_admins: true` change (it stays).

### Part E — Coverage push + optional carve-outs (rebases last)

**Branch:** `wave30-E-coverage` (cut **after** A/B/C merge)

**Goal.** Push branch-coverage from post-Wave-29 baseline toward
90.0%. Conditional floor bump per Wave 29 §1.6 pattern (89.5% if
cleared with ≥0.2% margin; 90.0% if cleared cleanly; otherwise add
tests without bumping).

**Approach.**

1. After A/B/C merge, run `npm run test:coverage` on `main` and
   capture branch-coverage number.
2. Use `coverage/lcov-report/index.html` to identify lowest-coverage
   modules with reachable branches. Prioritize:
   `audit/hybridStats.ts`, `ui/HybridPrecisionPanel.tsx`,
   `ui/system/accordionStorage.ts`, plus any pre-existing low-
   coverage modules.
3. Add targeted unit tests until floor target met.
4. Apply conditional floor bump per §1.8 in `app/vitest.config.ts`
   (verify path).
5. Optionally absorb 1–2 small a11y carve-outs surfaced by Wave 29-E
   (e.g. arrow-key cycling on view-mode tablist, if axe flagged it).

**Files:** tests only. No src changes (a11y carve-outs are exception:
≤ 1 src file if absorbed).

**Acceptance.**

- [ ] **E.1** Capture pre-E coverage on post-A/B/C `main`.
- [ ] **E.2** Identify ≥3 modules with reachable uncovered branches;
      list in PR description.
- [ ] **E.3** Add tests; rerun coverage until floor target met.
- [ ] **E.4** Apply floor bump per §1.8 (or document why no bump).
- [ ] **E.5** Local gate green; CI green before `gh pr ready`.

**Out of scope:**

- Refactoring src to make untested branches unreachable.
- Coverage on hooks already at 100%.
- Large new a11y features (deferred WCAG 2.1 AA stays deferred).

## §6 Dispatch matrix

| Part | Branch                            | Files cap (src/test/story) | Depends on                | Heartbeat dir                         |
|------|-----------------------------------|----------------------------|---------------------------|----------------------------------------|
| A    | `wave30-A-hybrid-precision`       | 3 / 2 / 1                  | `origin/main`             | `.claude/agent-status/wave30-A.log`   |
| B    | `wave30-B-accordion-persist`      | 2 / 1 / 0                  | `origin/main`             | `.claude/agent-status/wave30-B.log`   |
| C    | `wave30-C-ci-trust`               | 0 / 0 / 0 (config + dep)   | `origin/main`             | `.claude/agent-status/wave30-C.log`   |
| E    | `wave30-E-coverage`               | 0 / N / 0                  | A + B + C merged          | `.claude/agent-status/wave30-E.log`   |

Per `~/.claude/CLAUDE.md` Subagent Dispatch Rules: each subagent
heartbeats every ~5 min; orchestrator polls every 10 min and treats
≥30 min idle as stalled.

## §7 PR / merge protocol

1. **Per-part local gate.** `npm run typecheck && npm run lint && npm test`
   green before any push. Per global CI Discipline rule.
2. **CI gate.** `gh pr checks <pr>` must be green before
   `gh pr ready`. **Part C must merge first** if its diagnosis reveals
   the queue is still bypassing red checks — otherwise A/B/E inherit
   the bypass risk. (If C confirms the bypass is already closed by
   Wave 29's `enforce_admins`, A/B can merge in parallel.)
3. **Auto-merge attempt.** `gh pr merge --auto --squash` exactly
   once. If rejected, print PR URL + blocking reason and stop.
4. **Merge order.** C first (or in parallel with A/B if C.1 confirms
   no remaining bypass risk). E last, rebased off post-merge `main`.
5. **Post-wave sweep.** Run `npm run test:coverage` on `main` after E
   merges; record final number in PR E's body and update
   `docs/TESTING.md` if the floor moved.

## §8 Success criteria

- [ ] Hybrid precision panel live as rule-manager sub-tab; renders
      empty state on fresh install; renders populated state on audit
      chains with `hybrid-feedback` entries.
- [ ] Bottom-pane accordions default closed; per-section state
      persists across reloads via `localStorage`.
- [ ] Wave 28 ~~Mergify~~ red-bypass diagnosed and closed; postmortem
      written; `lhci` runs from project-local binary in CI.
- [ ] Branch coverage ≥ 89.5% (target 90.0%); floor bumped per §1.8.
- [ ] All four PRs CI-green at merge (no ~~Mergify~~-bypass red status).
- [ ] No new audit `kind`s. No CSP / bundle / IDB schema bumps. Only
      new dep is `@lhci/cli` devDependency in Part C.

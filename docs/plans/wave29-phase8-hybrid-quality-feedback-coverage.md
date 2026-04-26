# Wave 29 — Phase 8 closeout, hybrid quality + feedback, coverage push, design-system polish

> **For agentic workers:** REQUIRED SUB-SKILL: use
> `superpowers:subagent-driven-development` to dispatch Parts A–E per
> the matrix in §6. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal.** Five independent threads, each closing a specific loop:

1. **Phase 8 final row** — commercial-lease golden fixture exercising
   tables + definitions + cross-references simultaneously (last open
   Phase 8 row in `docs/BACKLOG.md`).
2. **Phase 18 quality** — expand the hybrid-classifier rule allowlist
   to 5–8 additional rule ids where keyword matching is brittle, then
   re-baseline the env-gated `golden-real-model` Playwright spec.
3. **Phase 18 feedback signal** — add a "not relevant" thumbs-down on
   hybrid findings, persisted to audit as `kind: 'hybrid-feedback'`.
   Builds the negative-signal stream future quality work will mine.
4. **Coverage discipline** — branch-coverage push from 89.08% toward
   90%. Conditional floor bump (89.5% if cleared with margin, 90% if
   cleared cleanly, otherwise no bump).
5. **Design-system & a11y polish** — three Wave-28 spillover
   carve-outs grouped: severity-bg color-pair tokens
   (`--severity-bg-{warn,error,info}`), button `sm`/`md` size tokens
   for ≥44×44 tap targets, view-mode `role="tablist"` semantics.

**Architecture.** Five parts, all dispatchable in parallel against
disjoint file sets. **Part D (coverage) rebases last** so it can target
real gaps revealed by A/B/C/E's new code. Each part owns its own
branch, files, tests, and Storybook updates where applicable.

**Tech Stack.** React 18 + TypeScript (`strict`,
`noUncheckedIndexedAccess`, `noImplicitOverride`), Vite, Vitest + RTL +
`@testing-library/user-event`, Tailwind v4 (Wave 27 substrate),
Storybook 8, Playwright (existing specs), Lighthouse CI (a11y ≥ 95).
CSP-strict — no new network egress, no new third-party deps, no IDB
schema bumps.

---

## §0 What changed since Wave 28 (context for fresh agents)

Wave 28 (PRs #112–#116, plus C/F that finished after the Wave-29 plan
landed) shipped:

- **A** — span-bbox parser foundation: `Paragraph.lines?: LineSpan[]`
  with per-line bbox + `start`/`end` char offsets. Non-breaking, no
  IDB schema bump.
- **B** — design-system primitives: `SectionGroup`, `EmptyState`,
  shared focus-ring utility under `src/ui/system/`.
- **D** — component polish: severity-table contrast fix (ad-hoc, to
  be tokenized in Wave 29 Part E), button hover/active states.
- **E** — span-bbox viewer integration: `spanHighlight.ts` helper +
  `PdfViewer.tsx` + `AppCurrentPane.tsx` wiring; `computeSpanRects`
  defaults to identity transform (`PdfViewer` uses hand-rolled
  `overlayStyle()` rather than pdf.js viewport conversion).

Carry-over candidates surfaced from the Wave 28 retrospective and
**deferred to Wave 30** (not in scope here):

- Accordion defaults closed + `localStorage` persistence (reverses
  Wave 28 §1.2; warrants its own UX brainstorm).
- `lhci` binary install in dev/CI envs (infra; own housekeeping wave).
- Dark-mode tokens (genuine theme; half-a-wave of its own).

A separate concern flagged at planning time: **Wave 28 PRs #113–#116
auto-merged via Mergify with red GitHub Actions status checks**
(verify, smoke, npm-audit, Lighthouse) despite green local gates.
Investigate **before** any Wave 29 part merges — see
`memory/project_ci_mergify_discrepancy.md`. If Wave 29 parts merge
while CI is red, regressions compound.

## §1 Scope-shaping decisions (READ BEFORE APPROVING)

1. **Part A is "the test is the deliverable."** No new parser /
   facts code. The fixture should pass with the current parser /
   `extractLeaseFacts` / xref resolver. If it surfaces a real
   parsing bug, ship a `.skip` with a TODO referencing a follow-up
   wave rather than fixing inline. Keeps the part honest and
   single-purpose.
2. **Part B allowlist expansion targets 5–8 rule ids.** The list is
   chosen for variable-phrasing brittleness in keyword matchers
   (e.g. quiet-enjoyment, force-majeure, holdover, surrender,
   indemnification). Single global similarity threshold stays —
   per-rule thresholds are explicitly out of scope (see §1.7).
3. **Part B re-baselines `golden-real-model` env-gated e2e only.**
   That spec runs only with `RUN_REAL_MODEL=1`; CI does not run it.
   We update its expected finding count + commit a new baseline.
   No CI workflow changes.
4. **Part C audit kind is `hybrid-feedback`,** payload
   `{ ruleId, paragraphIndex, modelId, similarity, signal: 'not-relevant' }`.
   Idempotent (re-clicking does not double-write — idempotency is
   keyed on `(ruleId, paragraphIndex, leaseId)`). Read-only mining
   — no UI consumes the feedback yet; that's a future wave.
5. **Part C is additive only.** No change to existing badge
   click-to-explain UX from Wave 25-B. Thumbs-down sits next to the
   badge. **No thumbs-up** — only negative signal (positive
   acceptance is implicit). Deterministic findings render no
   thumbs-down (the button is hybrid-only, like the badge).
6. **Part D conditional floor bump.** If post-A/B/C/E branch
   coverage clears 89.5% with ≥0.2% margin, D bumps the floor to
   89.5%. If it clears 90.0% with ≥0.2% margin, D bumps to 90.0%.
   Otherwise floor stays at 89%, and D adds tests without bumping.
   No threshold-bump-only commits.
7. **No per-rule hybrid thresholds.** The `Rule` type stays as is.
   If global threshold demonstrably can't accommodate the expanded
   allowlist, we file a follow-up wave with measurements.
8. **No new audit `kind`s beyond `hybrid-feedback`.** Per project
   convention.
9. **No CSP / bundle-budget / dep changes.** All five parts stay
   inside the existing surface.
10. **Part E is token + a11y semantics, not visual redesign.** Token
    pairs `--severity-bg-{warn,error,info}` replace ad-hoc fix from
    Wave 28-D. Button `sm` (32×32) / `md` (44×44 default) size
    tokens land alongside the existing variant tokens. View-mode
    container gets `role="tablist"`, children get `role="tab"`,
    panels get `role="tabpanel"` + `aria-controls`/`aria-labelledby`.
    No layout changes.

## §2 Out of scope

- Accordion default-closed behavior + `localStorage` persistence (Wave 30).
- Dark-mode tokens (Wave 30 candidate).
- Lighthouse `lhci` binary install in dev/CI (housekeeping wave).
- Per-rule hybrid similarity thresholds (future, gated on data).
- Hybrid-feedback consumer UI (read-only audit-mining is a future wave).
- Real-model on by default (productization step, own wave).
- Full WCAG 2.1 AA external audit (already deferred per `docs/CLAUDE.md`).
- CI / Mergify investigation (separate session before Wave 29 merges).

## §3 Execution dependency graph

```
   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ Part A   │  │ Part B   │  │ Part C   │  │ Part E   │
   │ Phase 8  │  │ hybrid   │  │ hybrid   │  │ tokens + │
   │ golden   │  │ quality  │  │ feedback │  │ a11y     │
   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
        │             │             │             │
        └─────────────┴──────┬──────┴─────────────┘
                             ▼
                       ┌──────────┐
                       │ Part D   │
                       │ coverage │
                       │ (rebase) │
                       └──────────┘
```

A, B, C, E branch off `origin/main` and dispatch in parallel. D
rebases off `main` after the others merge so it sees the actual
post-merge coverage delta and targets real gaps.

## §4 File-touch matrix

| Part | Branch                              | Src cap | Test cap | Storybook | Notes |
|------|-------------------------------------|---------|----------|-----------|-------|
| A    | `wave29-A-phase8-golden`            | 0       | ≤ 2 new  | n/a       | Pure test; new fixture file + extension to `golden.test.ts`. |
| B    | `wave29-B-hybrid-quality`           | ≤ 2     | ≤ 1      | n/a       | `hybridAnalyze.ts` or `packV1.ts` rule metadata + `e2e/golden-real-model.spec.ts` rebaseline. |
| C    | `wave29-C-hybrid-feedback`          | ≤ 3     | ≤ 2      | 1         | `FindingsPanel.tsx` + new `HybridFeedbackButton.tsx` + audit module. |
| D    | `wave29-D-coverage`                 | 0       | as needed| n/a       | Tests only; no src. Conditional floor bump. |
| E    | `wave29-E-tokens-a11y`              | ≤ 3     | ≤ 1      | updates   | Tokens CSS + `Button.tsx` + view-mode shell + 1 axe test. |

Disjoint file sets. C and B both touch hybrid territory but B is
logic/e2e and C is UI; no overlap.

## §5 Per-part details

### Part A — Phase 8 commercial golden fixture

**Branch:** `wave29-A-phase8-golden`

**Goal.** Close the last open Phase 8 BACKLOG row by adding a
commercial-lease fixture that exercises tables (rent schedule),
definitions (`"Premises" shall mean ...`), and cross-references
(`Section 4.2`, `Exhibit B`) in one document, asserting end-to-end
that all three feature extractions land correctly.

**Files (new):**

- `app/src/rules/fixtures/commercial-full.ts` — `pdf-lib` synthesizer
  emitting a multi-page commercial lease with a rent-schedule table,
  3+ definitions, 5+ cross-references, and 2–3 rules-engine triggers.
- Extension to `app/src/rules/golden.test.ts` — new `describe` block
  asserting:
  - Parser emits ≥1 `Table` from the rent-schedule region.
  - `extractLeaseFacts` returns a non-empty `rentSchedule` with
    correct from/to/amount.
  - `DefinitionEntry[]` length ≥ 3 with expected term/definition pairs.
  - `CrossReference[]` includes both `section:4.2` and `exhibit:B`
    targets.
  - Rules engine fires the expected finding ids.

**Acceptance.**

- [ ] **A.1** Synthesize fixture; verify it parses cleanly via
      `parseLeasePdf`.
- [ ] **A.2** Write the four assertions above. **All four must pass
      with current parser/facts/rules code** — if any fails, mark
      with `.skip` + TODO comment referencing a follow-up wave and
      flag in PR description.
- [ ] **A.3** Local gate: `npm run typecheck && npm run lint && npm test`
      green.
- [ ] **A.4** Update `docs/BACKLOG.md` Phase 8 row to `[x]` with
      PR reference.

**Out of scope:**

- Fixing any parser bugs the fixture surfaces.
- Adding new rules to fire on the fixture.

### Part B — Hybrid classifier quality (allowlist + e2e rebaseline)

**Branch:** `wave29-B-hybrid-quality`

**Goal.** Expand the rule ids eligible for the LLM classifier to 5–8
additional rules where keyword matching is brittle, and re-baseline
the env-gated `golden-real-model` Playwright spec.

**Pre-implementation step (REQUIRED before code touches).** Propose
the candidate rule-id list in the PR description draft and **wait for
human approval** before implementing. Candidate criteria:

- Existing `keyword` or `regex` matcher with ≥3 known-variant phrasings.
- Severity ≥ `info` (avoid noise on advisory-only rules).
- Not already in the Wave 22-A allowlist.

**Files:**

- `app/src/rules/hybridAnalyze.ts` **or** rule-metadata fields in
  `app/src/rules/packV1.ts` (whichever the existing allowlist
  mechanism uses — verify before edit).
- `app/e2e/golden-real-model.spec.ts` — update expected finding count.

**Acceptance.**

- [ ] **B.1** Verify current allowlist source-of-truth file and
      shape. Document in PR description.
- [ ] **B.2** Propose candidate rule-id list (5–8 ids) in PR
      description; await human approval.
- [ ] **B.3** Implement allowlist expansion. Add 1 unit test
      covering the new allowlist behavior (e.g. `runHybridAnalyze`
      now considers ruleId `xyz`).
- [ ] **B.4** Run `RUN_REAL_MODEL=1 npm run test:e2e -- golden-real-model`
      locally; observe new expected finding count; commit baseline.
- [ ] **B.5** Local gate: `npm run typecheck && npm run lint && npm test`
      green. (CI does not run real-model e2e.)

**Out of scope:**

- Per-rule similarity thresholds.
- Default-on behavior.
- Tuning the global threshold value.

### Part C — Hybrid finding "not relevant" feedback

**Branch:** `wave29-C-hybrid-feedback`

**Goal.** Add a thumbs-down button next to the existing hybrid badge
on `FindingsPanel`. Click writes a `kind: 'hybrid-feedback'` audit
entry, idempotent on `(ruleId, paragraphIndex, leaseId)`. Read-only
— no consumer UI in this wave.

**Files (new + modified):**

- New `app/src/ui/HybridFeedbackButton.tsx` — small component;
  takes `{ finding, leaseId, onSubmit }` props; renders a
  `<button>` with `aria-label` exposing rule + signal direction;
  no internal state beyond submitted flag.
- New `app/src/ui/HybridFeedbackButton.stories.tsx` — Storybook
  CSF; default + submitted states.
- New `app/src/ui/HybridFeedbackButton.test.tsx` — RTL; click
  fires `onSubmit` once; second click does not.
- Modified `app/src/ui/FindingsPanel.tsx` — wires the button
  next to the existing `finding-llm-badge` only when
  `finding.evidence` is present (deterministic findings render
  neither badge nor feedback).
- Modified `app/src/audit/types.ts` (or wherever audit `kind`
  union lives — verify) to add `'hybrid-feedback'` to the union.

**Audit payload.**

```ts
{
  kind: 'hybrid-feedback',
  payload: {
    ruleId: string,
    paragraphIndex: number,
    modelId: string,
    similarity: number,
    leaseId: string,
    signal: 'not-relevant',
  },
}
```

**Idempotency.** Before writing, check existing audit chain for an
entry with matching `(ruleId, paragraphIndex, leaseId, signal)`.
If found, no-op. Tests must cover the no-op path.

**Acceptance.**

- [ ] **C.1** Verify audit `kind` union location; confirm union
      type extension is the right pattern (vs. free-form string).
- [ ] **C.2** Build `HybridFeedbackButton` + Storybook + test.
- [ ] **C.3** Wire into `FindingsPanel`. Add 1 RTL test asserting:
      button renders only for hybrid findings; click writes audit;
      second click is a no-op.
- [ ] **C.4** Update `docs/CLAUDE.md` audit-event list to include
      `hybrid-feedback` with one-line description.
- [ ] **C.5** Local gate: `npm run typecheck && npm run lint && npm test`
      + `npm run storybook` smoke (the new story renders without
      console errors).

**Out of scope:**

- Thumbs-up / positive signal.
- Consumer UI that reads the feedback stream.
- Bulk feedback / undo affordance.
- Persistence beyond audit (e.g. no `localStorage` cache).

### Part D — Branch-coverage gap-fill toward 90% (rebases last)

**Branch:** `wave29-D-coverage` (cut **after** A/B/C/E merge)

**Goal.** Push branch-coverage from 89.08% (Wave 21 baseline) toward
90%. Conditional floor bump per §1.6.

**Approach.**

1. After A/B/C/E merge, run `npm run test:coverage` on `main` and
   capture the new branch-coverage number.
2. Use `coverage/lcov-report/index.html` to identify the lowest-
   coverage modules with reachable branches.
3. Prioritize: `usePipeline.ts`, `hybridAnalyze.ts`, audit module,
   and any Wave 29 newly-introduced files.
4. Add targeted unit tests until branch-coverage clears 89.5%
   (and ideally 90.0%) with ≥0.2% margin.
5. Apply conditional floor bump per §1.6 in `app/vitest.config.ts`
   (or wherever the coverage thresholds live — verify).

**Files:** tests only. No src.

**Acceptance.**

- [ ] **D.1** Capture pre-D coverage on post-A/B/C/E `main`.
- [ ] **D.2** Identify ≥3 modules with reachable uncovered
      branches; list in PR description.
- [ ] **D.3** Add tests; rerun coverage until floor target met.
- [ ] **D.4** Apply floor bump per §1.6 (or document why no bump).
- [ ] **D.5** Local gate green; CI green before `gh pr ready`.

**Out of scope:**

- Refactoring src to make untested branches unreachable.
- Coverage on hooks already at 100%.

### Part E — Design-system & a11y polish (severity tokens, button sizes, tablist semantics)

**Branch:** `wave29-E-tokens-a11y`

**Goal.** Three small carve-outs from the Wave 28 retrospective,
grouped by file neighborhood:

1. Replace Wave-28-D's ad-hoc severity-table contrast fix with
   reusable `--severity-bg-{warn,error,info}` token pairs alongside
   existing `--severity-fg-*` tokens.
2. Add `Button` `size` prop with `sm` (32×32 min) and `md` (44×44
   min, new default) for ≥44×44 tap-target compliance. Existing
   call sites stay on `md` default; no migration churn.
3. Wire `role="tablist"` / `role="tab"` / `role="tabpanel"` +
   `aria-controls` / `aria-labelledby` onto the view-mode shell
   (current / portfolio / redline switcher).

**Files:**

- Tokens CSS (verify file — likely `app/src/ui/system/tokens.css`
  or equivalent): add three `--severity-bg-*` token pairs.
- `app/src/ui/system/Button.tsx`: add `size?: 'sm' | 'md'` prop,
  default `'md'`. Storybook updated with both sizes.
- View-mode shell component (verify which file owns the
  current/portfolio/redline switcher — likely `App.tsx` or a
  dedicated `ViewModeTabs.tsx` after Wave 27 decomp): add ARIA
  roles + `aria-controls` wiring.
- `app/src/ui/__tests__/viewmode.a11y.test.tsx` (new): axe-core
  scan asserting `role="tablist"` + correct `aria-selected` flow.

**Acceptance.**

- [ ] **E.1** Verify file paths above (tokens CSS, view-mode shell);
      document in PR description.
- [ ] **E.2** Add severity-bg token pairs; replace ad-hoc fix in
      Wave-28-D severity-table site with the tokens.
- [ ] **E.3** Add `Button` size variants; update Storybook; visual
      smoke that tap targets are ≥44×44 in `md`.
- [ ] **E.4** Wire tablist ARIA; add axe-core test.
- [ ] **E.5** Local gate: `typecheck && lint && test && storybook`
      smoke.

**Out of scope:**

- Migrating existing button call-sites (default stays `md`, behavior
  unchanged).
- Restyling tabs visually.
- Full keyboard-navigation overhaul of view-mode (arrow-key tab
  cycling can land in a follow-up if axe doesn't flag it).

## §6 Dispatch matrix

| Part | Branch                            | Files cap (src/test/story) | Depends on                | Heartbeat dir                    |
|------|-----------------------------------|----------------------------|---------------------------|----------------------------------|
| A    | `wave29-A-phase8-golden`          | 0 / 2 / 0                  | `origin/main`             | `.claude/agent-status/wave29-A.log` |
| B    | `wave29-B-hybrid-quality`         | 2 / 1 / 0                  | `origin/main` + approval  | `.claude/agent-status/wave29-B.log` |
| C    | `wave29-C-hybrid-feedback`        | 3 / 2 / 1                  | `origin/main`             | `.claude/agent-status/wave29-C.log` |
| D    | `wave29-D-coverage`               | 0 / N / 0                  | A + B + C + E merged      | `.claude/agent-status/wave29-D.log` |
| E    | `wave29-E-tokens-a11y`            | 3 / 1 / updates            | `origin/main`             | `.claude/agent-status/wave29-E.log` |

Per `~/.claude/CLAUDE.md` Subagent Dispatch Rules: each subagent
heartbeats every ~5 min; orchestrator polls every 10 min and treats
≥30 min idle as stalled.

## §7 PR / merge protocol

1. **Per-part local gate.** `npm run typecheck && npm run lint && npm test`
   green before any push. (Per global CI Discipline rule.)
2. **CI gate.** `gh pr checks <pr>` must be green before
   `gh pr ready` — **especially** in light of the Wave 28 Mergify
   discrepancy. **Resolve the CI / Mergify issue before any Wave 29
   PR merges**, even if the fix is "rebaseline Lighthouse for the
   Wave 27 substrate."
3. **Auto-merge attempt.** `gh pr merge --auto --squash` exactly
   once. If rejected, print the PR URL + blocking reason and stop.
4. **Merge order.** A, B, C, E in any order. **D last**, rebased
   off post-merge `main`.
5. **Post-wave sweep.** Run `npm run test:coverage` on `main` after
   D merges; record final number in PR D's body and update
   `docs/TESTING.md` if the floor moved.

## §8 Success criteria

- [ ] Phase 8 BACKLOG row marked `[x]`; commercial-fixture golden
      test green.
- [ ] Hybrid allowlist expanded by 5–8 rule ids; `golden-real-model`
      env-gated e2e re-baselined.
- [ ] Thumbs-down button live on hybrid findings; `kind:
      'hybrid-feedback'` audit entries write idempotently.
- [ ] Branch coverage ≥ 89.5% (target 90.0%); floor bumped per §1.6.
- [ ] Severity-bg tokens replace ad-hoc fix; button `sm`/`md` size
      tokens shipped; view-mode tablist semantics in place.
- [ ] All five PRs CI-green at merge (no Mergify-bypass red status).
- [ ] No new audit `kind`s beyond `hybrid-feedback`. No CSP / bundle /
      dep changes. No IDB schema bumps.

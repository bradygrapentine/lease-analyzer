# Wave 33 — Operational hygiene: audit scope, lazy-shell, regression-allowlist, coverage

> **For agentic workers:** REQUIRED SUB-SKILL: use
> `superpowers:subagent-driven-development` (or the project's `/wave`
> skill) to dispatch Parts A, B, C per the matrix in §7. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Design spec:** `docs/superpowers/specs/2026-04-27-wave33-design.md`
(read first if any §X.Y step is ambiguous).

**Goal.** Clear four accumulated operational papercuts so the next
user-facing wave starts from a clean baseline: noisy npm-audit on
every PR; cap-pinned bundle budget; allow-list-shaped dark-mode
regression test; missing coverage push.

**Architecture.** A is a one-flag CI patch + docs paragraph. B
converts ≤ 5 interaction-gated panels to `React.lazy` boundaries to
reclaim ≥ 10 KiB of app-shell budget AND codifies the shell-eligible
rule in `docs/SYSTEM_DESIGN.md`. C deletes the W32-B regression-test
allow-list entries (or fixes any non-token classes the grep
surfaces). E rebases last with the established conditional bump.

**Tech stack.** React 18 + TypeScript (`strict`,
`noUncheckedIndexedAccess`), Vite, Vitest + RTL, Tailwind v4,
Storybook 8, GitHub Actions. CSP-strict; no new third-party deps; no
IDB schema bumps.

**Base SHA.** All branches branch from `origin/main =
380b7b97b0389acfc386c9b1cc7919293915621f` (Wave 32-C merge).

---

## §0 What changed since Wave 32 (context for fresh agents)

Wave 32 (PRs #134 docs + #135–#137 parts) shipped:

- **A** — Nightly real-model GHA workflow at
  `.github/workflows/real-model-nightly.yml`. Runs daily at 06:00
  UTC + on `workflow_dispatch`; auto-manages the
  `nightly-real-model-broken` issue.
- **B** — Dark-mode regression sweep. Audit found only one hit
  (`#ddd` border in `SideLetterPanel.tsx`); permanent regression test
  at `app/src/test/dark-mode-regression.test.ts`. Storybook theme
  toolbar wired in `app/.storybook/preview.tsx`. Three files
  allow-listed:
  - `src/ui/HybridFeedbackButton.tsx`
  - `src/ui/HybridPrecisionPanel.tsx`
  - `src/ui/FindingsPanel.tsx`
- **C** — `findClassifyEntry` helper + audit-entry `entryHash`
  readout (truncated to 8 chars; full hash in `title=`) in the
  hybrid-finding disclosure inside `FindingsPanel.tsx`. C also bumped
  the app shell budget from 352k to 354k in
  `app/scripts/check-bundle-budget.mjs`. The budget comment now
  says: *"Future waves should lazy-load new shell-bound UI to claw
  back headroom rather than nudging this number; the next add will be
  a meaningful refactor, not a bump."*

Mid-wave CI fixes:
- **PR #138** — wired ~~Mergify~~ queue action with `auto_merge_enabled`,
  not a valid ~~Mergify~~ condition; merged with broken config.
- **PR #139** — replaced trigger with `label=automerge`. Workflow now:
  add the `automerge` label to a PR via UI or
  `gh pr edit <num> --add-label automerge`; ~~Mergify~~ queues +
  rebases + merges. `gh pr merge --auto --squash` continues to work
  as a parallel fallback.

The `npm-audit` CI job is currently a noisy false-positive: 4 critical
vulns trace through `@storybook/addon-actions` → `uuid` (devDep
transitives). The deployed PWA bundle (`dist/`) has none of those
deps; `--omit=dev` should return zero locally.

## §1 Scope-shaping decisions (READ BEFORE APPROVING)

1. **Part A is a one-flag patch + a docs paragraph.** Add `--omit=dev`
   to the existing `npm audit` command in
   `.github/workflows/security.yml`. Document the dev-vs-prod
   vulnerability split in `docs/SECURITY.md`. No app code, no tests.
2. **Part B converts ≤ 5 panels** rendered conditionally / on
   interaction to `React.lazy`. Target reclaim ≥ 10 KiB; **soft goal.**
   If real reclaim is 6 KiB after honest measurement, document the
   bail-out and proceed — don't reach.
3. **Part B candidates are discovered**, not pre-enumerated. Likely:
   `AnnotationsPanel`, `AuditLogPanel`, `SideLetterPanel`,
   `RedlinePanel`, `ClauseSimilarityPanel`. Verify each is currently
   eager and gated behind a render-time conditional before converting.
4. **Part C may be a 3-line PR.** Clean case = delete the three
   allow-list entries. Dirty case = swap to semantic tokens within
   the 3-file boundary; allow-list survivors only with a one-line
   comment explaining deliberate intent.
5. **Part C does NOT add new semantic tokens** (Wave 32-B rule).
6. **Part C halts on call-site color-prop drift.** If a parent passes
   `className="bg-amber-50"` into one of the three files, fix
   requires touching the parent — that's drift. Stop and report.
7. **Part E rebases last.** Source cap **0**. Conditional floor bump:
   ≥91.2 → 91; ≥90.7 → 90.5; else no bump. Wave 31-C discipline.
8. **B/C boundary on `FindingsPanel.tsx`:** B owns import-style edits
   (lazy conversion); C owns className edits (token swaps). Both can
   touch the file in parallel without cherry-pick conflict.
9. **No CSP / IDB schema / new third-party deps** in Wave 33.

## §2 Out of scope

- Upgrading Storybook past the vuln window; dropping
  `addon-essentials`; adding `npm overrides` for `uuid`. Part A's
  `--omit=dev` scope is the correct fix.
- Restructuring the entire bundle architecture beyond the ≤ 5 lazy
  conversions. The shell-eligible rule is documented *policy*, not a
  redesign.
- Codifying the lazy rule as an ESLint plugin / build-time check.
- Coverage past 91% via contrived tests on defensive code.
- Hybrid review queue UI; "jump to audit log" cross-ref;
  `@xenova/transformers` upstream-bump watch; worker-path classifier;
  real-model on by default — all parked at Wave 32 §2 status.

## §3 Execution dependency graph

```
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ Part A   │   │ Part B   │   │ Part C   │
   │ npm-     │   │ system-  │   │ tighten  │
   │ audit    │   │ atic     │   │ dark-    │
   │ scope    │   │ lazy-    │   │ mode     │
   │ to prod  │   │ load     │   │ allowlist│
   └────┬─────┘   └────┬─────┘   └────┬─────┘
        │              │              │
        └──────────────┴──────┬───────┘
                              ▼
                        ┌──────────┐
                        │ Part E   │
                        │ coverage │
                        │ (rebase) │
                        └──────────┘
```

A, B, C branch from `origin/main` (`380b7b9`) in parallel. E rebases
off post-merge `main` after A, B, C merge.

---

## §4 Part A — Scope npm audit to runtime deps

**Branch:** `wave33-A-audit-prod-only`
**Worktree:** `worktrees/wave33-A-audit-prod-only`
**Heartbeat:** `.claude/agent-status/wave33-A.log`

**Files (cap: 0 src, 0 test):**

- Modify: `.github/workflows/security.yml` (the existing audit step)
- Modify: `docs/SECURITY.md` (add a paragraph; verify exact path in A.1)

### Acceptance

- [ ] **A.1** Pre-implementation verification.
  - Find the audit job:
    ```
    grep -rn "npm audit" .github/workflows/
    ```
    Likely result: a step in `.github/workflows/security.yml` running
    `cd app && npm audit --audit-level=high` or similar. Read the
    full step (name + run line); copy verbatim to PR description.
  - Capture local before/after counts:
    ```
    cd app && npm audit --audit-level=high            # current
    cd app && npm audit --omit=dev --audit-level=high # new
    ```
    Record both counts in the PR description. The new run should
    return 0 vulnerabilities.
  - Verify `docs/SECURITY.md` exists. Read the file and identify a
    natural location for the dev-vs-prod paragraph (likely near an
    existing "accept-risk" register, a "vulnerabilities" heading, or
    the end of the document if no obvious anchor exists). Do NOT
    create a new file.

- [ ] **A.2** Patch the workflow. In `.github/workflows/security.yml`,
      change the npm-audit step. Example before/after — adapt the
      step name and exact path to match what A.1 found:

```yaml
# Before:
- name: Audit app (high+ only)
  working-directory: app
  run: npm audit --audit-level=high

# After:
- name: Audit app (high+ only, prod deps only)
  working-directory: app
  run: npm audit --omit=dev --audit-level=high
```

  Don't touch other steps in `security.yml` (gitleaks, trivy,
  osv-scanner, etc. — different concerns). Commit:

```bash
git add .github/workflows/security.yml
git commit -m "wave33-A: scope npm audit to prod deps (--omit=dev)"
```

- [ ] **A.3** Document the policy. Add to `docs/SECURITY.md` at the
      location identified in A.1:

```markdown
### Dev vs. prod vulnerability scope

The `npm-audit` CI job runs with `--omit=dev` because LeaseGuard's
deployed surface is the static PWA bundle (`dist/`), which contains
only runtime deps. Build-time / dev-time deps (Storybook, ESLint,
vitest tooling) are NOT bundled and cannot be exploited by an end
user. Their vulnerabilities are tracked separately and
accepted-with-context in §accept-risk if material. Run `npm audit`
(no flag) locally to see all transitives if you're doing a deeper
review.
```

  Adapt the heading depth (`###` vs `##`) and any "§accept-risk"
  cross-reference to match `SECURITY.md`'s existing voice and
  structure. Keep the paragraph short.

  Commit:
```bash
git add docs/SECURITY.md
git commit -m "wave33-A: document dev-vs-prod npm-audit scope"
```

- [ ] **A.4** Local sanity:
```
cd app && npm audit --omit=dev --audit-level=high
```
  Expected: exit 0 (no vulnerabilities at high+ in prod deps).

- [ ] **A.5** Push and PR:
```
git push -u origin wave33-A-audit-prod-only
```
  PR title: `wave33-A: scope npm audit to runtime deps`
  Body must include:
  - The exact A.1 step before/after.
  - Before/after vuln counts from local `npm audit`.
  - The doc-location decision.

  Then label-route via ~~Mergify~~:
```
gh pr edit <num> --add-label automerge
```

  (~~Mergify~~ queue is functional post-Wave-32 PR #139.) Auto-merge via
  `gh pr merge --auto --squash` is also acceptable as the GitHub-side
  fallback.

## §5 Part B — Systematic shell lazy-load

**Branch:** `wave33-B-lazy-shell`
**Worktree:** `worktrees/wave33-B-lazy-shell`
**Heartbeat:** `.claude/agent-status/wave33-B.log`

**Files (cap: ≤ 5 component conversions + parent call-site edits + 1
docs paragraph; mechanical test edits as needed for sync→async query
updates):**

- Modify: ≤ 5 source component files in `app/src/ui/**` or
  `app/src/App/**` (lazy-conversion sites + their import sites).
- Modify: their existing test files (sync→async query updates).
- Modify: `docs/SYSTEM_DESIGN.md` (add the shell-eligible paragraph).
- DO NOT touch: `app/scripts/check-bundle-budget.mjs` (cap stays at
  354_000 in this PR; the reclaim is visible in measured size, not
  the cap).

### Acceptance

- [ ] **B.1** Identify candidates. Run a clean build:
```
cd app && rm -rf dist && npm run build
ls -lh dist/assets/index-*.js
```
  Capture current shell file sizes (largest `index-*.js` is the
  primary).

  Inspect existing lazy patterns:
```
grep -rn "lazy(() =>" app/src/App app/src/ui --include='*.tsx' | head
```

  Existing lazy boundaries (do NOT re-convert):
  - `HybridFeedbackButton` — Wave 29-C
  - `HybridPrecisionDisclosure` — Wave 30-A

  Identify currently-eager panels rendered conditionally or on
  interaction. For each candidate:
  - Confirm it's eagerly imported.
  - Confirm it's gated behind a render-time conditional (view-mode
    branch, `<details>` body, click-handler open state, etc.). If it
    renders unconditionally on app load, it's NOT a candidate — skip.

  Write the candidate list with current vs. expected weight to the
  PR body. Pin the chosen ≤ 5. **If you can't credibly meet ≥ 10 KiB
  with ≤ 5 conversions, lower the target and document why.** Don't
  reach.

- [ ] **B.2** Convert each chosen panel. Pattern (mirror existing
      `HybridFeedbackButton` boundary in
      `app/src/ui/FindingsPanel.tsx`):

```tsx
// Before — eager:
import { AnnotationsPanel } from './ui/AnnotationsPanel';
// ...
<AnnotationsPanel ... />

// After — lazy:
import { lazy, Suspense } from 'react';
const AnnotationsPanel = lazy(() =>
  import('./ui/AnnotationsPanel').then((m) => ({ default: m.AnnotationsPanel })),
);
// ...
<Suspense fallback={null}>
  <AnnotationsPanel ... />
</Suspense>
```

  - If the parent already lives inside a `<Suspense>`, don't add
    another — just lazy-import.
  - **Do NOT introduce a new `Suspense` fallback pattern.** Match
    existing usage (`null` for no flash; or whatever the existing
    boundary uses).
  - The named-import bridging (`{ default: m.AnnotationsPanel }`) is
    necessary because `React.lazy` expects a default export and these
    components use named exports.

  Run the local gate after each conversion:
```
cd app && npm run typecheck && npm run lint && npm test
```

  Mechanical test edits expected: tests using
  `screen.getByText(...)` synchronously after a previously-eager
  render must change to `await screen.findByText(...)` (or `await
  waitFor(...)`) once the component is lazy. Update tests in the
  same conversion commit. Don't bulk-edit unrelated tests.

  Commit each conversion (or batch of related conversions):
```
git add app/src/ui/<Panel>.tsx app/src/<call-site>.tsx \
        app/src/ui/<Panel>.test.tsx
git commit -m "wave33-B: lazy-load <Panel>"
```

- [ ] **B.3** Document the shell-eligible rule. Add to
      `docs/SYSTEM_DESIGN.md`. Read the file first to find a
      natural placement (likely under an existing
      "Architecture" / "Module boundaries" section). Use this exact
      paragraph (adapt heading depth to match):

```markdown
### App shell vs. lazy chunks

Components that are visible the moment the app boots (header,
view-mode tabs, the empty-state of the findings list) live in the
eager `index-*.js` shell. Components that only render on user
interaction (clicking a disclosure, opening a panel, switching to a
non-default view) MUST be converted to `React.lazy` boundaries. The
shell budget cap (`app/scripts/check-bundle-budget.mjs`) is *not* a
number to nudge — it's a contract that says "if you need more,
lazy-load instead." Existing examples: `HybridFeedbackButton`
(Wave 29-C), `HybridPrecisionDisclosure` (Wave 30-A), and the panels
converted in Wave 33-B (see PR #<N>).
```

  Replace `#<N>` with the actual PR number once it's open. Commit:
```
git add docs/SYSTEM_DESIGN.md
git commit -m "wave33-B: document shell-eligible rule"
```

- [ ] **B.4** Verify reclaim:
```
cd app && rm -rf dist && npm run build && npm run check:budget
```
  Expected: green `[ok] app shell` line; size meaningfully below
  354_000 bytes. The cap stays at 354_000 — Wave 33-B does NOT bump
  or lower it. Reclaim is visible in the size column.

  Capture the measured before/after for the PR body:

```
metric           before    after     delta
app shell        354.0 KiB <new>     -<X> KiB
```

  If `<X>` < 10 KiB, document the bail-out: which candidates were
  considered, why reclaim is smaller, and whether the documented
  rule still warrants the wave (it does — the rule is the larger
  contribution).

- [ ] **B.5** Local gate (mandatory before push):
```
cd app && npm run typecheck && npm run lint && npm test
```
  All green. If anything red, fix before push.

- [ ] **B.6** Push, PR, label:
```
git push -u origin wave33-B-lazy-shell
```
  PR title: `wave33-B: lazy-load shell-bound UI; document
  shell-eligible rule`
  Body must include:
  - B.1 candidate list with weights.
  - The chosen ≤ 5 conversions and per-component before/after weight.
  - B.4 before/after shell-size table.
  - Bail-out rationale if reclaim < 10 KiB.
  - The exact `docs/SYSTEM_DESIGN.md` snippet added.

  Then:
```
gh pr edit <num> --add-label automerge
```

## §6 Part C — Tighten dark-mode regression allowlist

**Branch:** `wave33-C-darkmode-allowlist`
**Worktree:** `worktrees/wave33-C-darkmode-allowlist`
**Heartbeat:** `.claude/agent-status/wave33-C.log`

**Files (cap: ≤ 3 src + 1 test):**

- Modify: `app/src/test/dark-mode-regression.test.ts` (delete /
  narrow `ALLOW_LIST_PATHS`)
- Modify (only if grep flags non-token classes):
  - `app/src/ui/HybridFeedbackButton.tsx`
  - `app/src/ui/HybridPrecisionPanel.tsx`
  - `app/src/ui/FindingsPanel.tsx`

### Acceptance

- [ ] **C.1** Verify current state. From the worktree root:

```
grep -En '\b(bg|text|border|ring|outline|fill|stroke|from|to|via)-(amber|stone|zinc|slate|neutral|gray|red|orange|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-[0-9]+)?(/[0-9]+)?\b' \
  app/src/ui/HybridFeedbackButton.tsx \
  app/src/ui/HybridPrecisionPanel.tsx \
  app/src/ui/FindingsPanel.tsx
```

  Tabulate any matches per file. Document the result in the PR
  description.

  Then scan call sites for color-prop drift:
```
grep -rEn 'FindingsPanel|HybridFeedbackButton|HybridPrecisionPanel' \
  app/src --include='*.tsx' | grep -E 'className=.*"' | head -20
```

  If a parent passes a `className` prop containing a non-token color
  (e.g. `<FindingsPanel className="bg-amber-50" />`), fixing it
  requires touching the parent — that's drift. **Halt and report.**
  Do not silently expand scope.

- [ ] **C.2** Two outcomes:

  **Clean case (zero matches in C.1):**
  Edit `app/src/test/dark-mode-regression.test.ts`. Replace:

```ts
const ALLOW_LIST_PATHS: ReadonlyArray<string> = [
  'src/ui/HybridFeedbackButton.tsx',
  'src/ui/HybridPrecisionPanel.tsx',
  'src/ui/FindingsPanel.tsx',
];
```

  with:

```ts
const ALLOW_LIST_PATHS: ReadonlyArray<string> = [];
```

  Run:
```
cd app && npx vitest run src/test/dark-mode-regression.test.ts
```
  Expected: PASS.

  Commit:
```
git add app/src/test/dark-mode-regression.test.ts
git commit -m "wave33-C: remove dark-mode regression allow-list entries (verified clean)"
```

  **Dirty case (matches found in C.1):**
  For each match, apply the standard token mappings (Wave 32-B
  table — repeated here for offline-readability):

| Hard-coded | Replace with |
|-----------|--------------|
| `bg-white`, `bg-amber-50`, `bg-stone-50`, `bg-stone-100` | `bg-paper` (default) or `bg-paper-raised` (elevated cards) |
| `bg-stone-200`, `bg-zinc-100`, `bg-amber-100` | `bg-paper-sunken` |
| `text-black`, `text-zinc-900`, `text-stone-900` | `text-fg` |
| `text-zinc-700`, `text-stone-700` | `text-fg-body` |
| `text-zinc-500`, `text-stone-500`, `text-zinc-600` | `text-fg-muted` |
| `text-zinc-400`, `text-stone-400` | `text-fg-faint` |
| `border-zinc-200`, `border-stone-200`, `border-amber-200` | `border-rule` (default) or `border-rule-subtle` (low-emphasis) |
| `text-blue-*`, `bg-blue-*` (accent role) | `text-ink`, `bg-ink` |
| `bg-red-*`, `text-red-*` (severity-high role) | `text-severity-high`, `bg-severity-bg-error` |
| `bg-amber-*`, `text-amber-*` (severity-medium role) | `text-severity-medium`, `bg-severity-bg-warn` |

  If a match is intentionally a hardcoded color (e.g. an evidence
  overlay using `bg-yellow-300/30` as a deliberate annotation
  contrast like `--color-highlight: rgba(255, 235, 59, 0.35)`), keep
  that file in the allow-list with a one-line comment in
  `dark-mode-regression.test.ts` documenting why:

```ts
const ALLOW_LIST_PATHS: ReadonlyArray<string> = [
  // Intentional: hybrid-finding evidence overlay uses bg-yellow-300/30
  // as a deliberate annotation contrast, not a theme color.
  // See app/src/ui/FindingsPanel.tsx:<line>.
  'src/ui/FindingsPanel.tsx',
];
```

  Commit each fix as you go:
```
git add app/src/ui/<File>.tsx
git commit -m "wave33-C: swap palette classes to semantic tokens in <File>"
```

  Final commit narrows / empties the allow-list:
```
git add app/src/test/dark-mode-regression.test.ts
git commit -m "wave33-C: tighten dark-mode regression allow-list"
```

  Do NOT add new semantic tokens. If a match has no obvious mapping,
  STOP and report.

- [ ] **C.3** Fix-as-found rule. While editing any of the three
      files, any *other* hard-coded color you spot (e.g.
      `border: '1px solid #ddd'` in inline styles) gets the same
      token swap (use `var(--color-rule)`, `var(--color-fg-muted)`,
      etc.). Don't punt.

- [ ] **C.4** Local gate:
```
cd app && npm run typecheck && npm run lint && npm test
```
  All green. Specifically verify:
  - `dark-mode-regression.test.ts` passes.
  - Existing axe-against-light tests still pass (no regression).

- [ ] **C.5** Push, PR, label:
```
git push -u origin wave33-C-darkmode-allowlist
```
  PR title: `wave33-C: tighten dark-mode regression allow-list`
  Body must include:
  - C.1 grep output (per-file match counts).
  - Outcome: clean (0 entries) or dirty (which entries survive + why).
  - Any fix-as-found edits.

  Then:
```
gh pr edit <num> --add-label automerge
```

## §7 Dispatch matrix

| Part | Branch                          | Files cap (src/test/other)              | Depends on        | Heartbeat                              |
|------|---------------------------------|------------------------------------------|-------------------|-----------------------------------------|
| A    | `wave33-A-audit-prod-only`      | 0 src + 0 test + 1 workflow + 1 doc     | `origin/main` (`380b7b9`) | `.claude/agent-status/wave33-A.log` |
| B    | `wave33-B-lazy-shell`           | ≤ 5 src + mechanical test edits + 1 doc | `origin/main` (`380b7b9`) | `.claude/agent-status/wave33-B.log` |
| C    | `wave33-C-darkmode-allowlist`   | ≤ 3 src + 1 test                        | `origin/main` (`380b7b9`) | `.claude/agent-status/wave33-C.log` |
| E    | `wave33-E-coverage`             | 0 src + N tests + 1 vitest config max   | A + B + C merged  | `.claude/agent-status/wave33-E.log`     |

Per `~/.claude/CLAUDE.md`: each subagent heartbeats every ~5 min;
orchestrator polls every 10 min and treats ≥ 30 min idle as stalled.
Worktrees go under `<project>/worktrees/<branch>`.

## §8 PR / merge protocol

1. **Per-part local gate.** `npm run typecheck && npm run lint &&
   npm test` green before any push.
2. **CI gate.** `gh pr checks <pr>` must be green before flipping to
   ready.
3. **Label-route via ~~Mergify~~.** `gh pr edit <num> --add-label
   automerge` after pushing — the queue rebases each PR before
   merging, so no manual rebase chasing across the wave. Native
   `gh pr merge --auto --squash` continues to work as a parallel
   fallback.
4. **Merge order.** A, B, C in any order; E rebases off post-merge
   `main` after all three land.
5. **Post-wave sweep.** After E merges, run `npm run test:coverage`
   on `main`; record final number in E's PR body.

## §9 Part E — Coverage push (rebases last)

**Branch:** `wave33-E-coverage` — cut **after** A, B, C merge.
**Worktree:** `worktrees/wave33-E-coverage`
**Heartbeat:** `.claude/agent-status/wave33-E.log`

**Files (cap: 0 src; tests as needed; 1 coverage-config edit max):**

### Acceptance

- [ ] **E.1** From `main` (after A, B, C merge), run:
```
cd app && npm run test:coverage
```
  Capture post-merge branches/lines/functions/statements percentages.
  Identify the 5–10 lowest-covered branches in actually-meaningful
  code. Prioritize new code from Wave 33: B's lazy-boundary fallback
  paths, any conditional logic introduced by C's token swaps, and
  pre-existing low-coverage modules with reachable branches.

  Verify the coverage-config path: `grep -n "thresholds\|branches:"
  app/vite.config.ts | head`.

- [ ] **E.2** Add targeted tests. Each `describe` block name must
      communicate "what does this protect," not the metric served.
      Forbidden: noop-fixture filler tests; snapshot tests purely to
      bump line coverage.

  Rerun coverage after each test file lands.

- [ ] **E.3** Conditional floor bump in `app/vite.config.ts`:
  - if branches ≥ 91.2% → bump `branches` to **91**
  - else if branches ≥ 90.7% → bump to **90.5**
  - else → ship tests without floor bump

  Don't lower other thresholds.

- [ ] **E.4** Local gate:
```
cd app && npm run typecheck && npm run lint && npm run test:coverage
```
  All green at the (possibly bumped) floor.

- [ ] **E.5** Push, PR titled `wave33-E: coverage push`. PR body
      includes a before/after coverage table and the list of modules
      from E.1. Then:
```
gh pr edit <num> --add-label automerge
```

## §10 Success criteria

- [ ] `npm-audit` CI step runs green (returns 0 vulns at high+ in
      prod deps); `docs/SECURITY.md` documents the dev-vs-prod policy.
- [ ] `npm run check:budget` reports app-shell size meaningfully
      below 354 KiB; ≥ 10 KiB reclaim achieved (or documented
      bail-out below the goal); `docs/SYSTEM_DESIGN.md` documents
      the shell-eligible rule.
- [ ] Dark-mode regression test runs with allow-list ≤ original
      three entries (zero entries in clean case; surviving entries
      have one-line comment justifying intent).
- [ ] Branch coverage ≥ pre-wave baseline + meaningful gain;
      conditional floor bump applied per §9.E.3 (or no bump
      documented).
- [ ] All four PRs CI-green at merge.
- [ ] No new audit `kind`s, no CSP / IDB schema bumps, no new
      third-party deps.

# Wave 32 — Phase 19 productionization, dark-mode sweep, audit-id linkage, coverage

> **For agentic workers:** REQUIRED SUB-SKILL: use
> `superpowers:subagent-driven-development` (or the project's `/wave`
> skill, which dispatches in parallel against disjoint worktrees) to
> dispatch Parts A, B, C per the matrix in §7. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Design spec:** `docs/superpowers/specs/2026-04-27-wave32-design.md`
(read first if any §X.Y step is ambiguous).

**Goal.** Close the Phase 18 → 19 transition with a nightly real-model
GHA + audit-id linkage, pay down dark-mode polish debt that Wave 31's
toggle exposed, and continue the established coverage pattern. Three
parallel parts (A/B/C), one rebases-last (E).

**Architecture.** A is a CI-only workflow that schedules the existing
`RUN_REAL_MODEL=1`-gated `hybrid-golden.spec.ts` and auto-manages a
GitHub issue under the label `nightly-real-model-broken`. B is a
deterministic grep-driven sweep of non-token Tailwind palette classes,
backed by a permanent regression test plus a Storybook visual smoke
pass against `[data-theme="dark"]`. C adds a small
`findClassifyEntry` helper and surfaces the matching audit-entry id
in the existing hybrid-finding disclosure.

**Tech stack.** React 18 + TypeScript (`strict`,
`noUncheckedIndexedAccess`, `noImplicitOverride`), Vite, Vitest + RTL,
Tailwind v4, Storybook 8, Playwright, GitHub Actions. CSP-strict — no
new network egress, no new third-party deps, no IDB schema bumps.

**Base SHA.** All branches branch from `origin/main =
41d7abb25115a7357d3fb801bc887021d4ddd492` (Wave 31-C merge).

---

## §0 What changed since Wave 31 (context for fresh agents)

Wave 31 (PRs #127 plan + #131–#133 parts) shipped:

- **A** — Demotion-candidate subsection in `HybridPrecisionPanel`,
  gated on `≥10 fires AND <70% precision`; read-only, advisory.
- **B** — Tri-state theme system (`system`/`light`/`dark`),
  `useColorScheme` hook, `ThemeToggle` in `AppHeader`, dark token
  variants under `[data-theme="dark"]` block in `app/src/index.css`.
  Tailwind v4 wired with `@custom-variant dark (&:where(...))`.
- **C** — Coverage push: branches **89 → 90** floor.

The toggle in Wave 31-B exposed the latent debt that Wave 32-B fixes:
components that hard-code Tailwind palette classes
(`bg-amber-50`, `text-zinc-700`, etc.) instead of semantic tokens
(`bg-paper`, `text-fg-muted`).

The real-model spec (`tests/e2e/hybrid-golden.spec.ts`) is gated
behind **`RUN_REAL_MODEL=1`** (note: `RUN_REAL_MODEL`, not
`REAL_MODEL` — verified during brainstorm).

## §1 Scope-shaping decisions (READ BEFORE APPROVING)

1. **Part A is CI-only.** Zero app code, zero tests. New workflow file
   plus a one-time `gh label create` step documented in the PR body.
2. **Part A failure handling is auto-issue.** Single GitHub issue
   labelled `nightly-real-model-broken` is opened on first failure,
   commented on subsequent failures, closed with a "recovered"
   comment on next success.
3. **Part B is two-pass.** Pass 1: deterministic grep + mechanical
   token swaps. Pass 2: Storybook visual smoke against dark theme.
4. **Part B excludes the hybrid-finding disclosure surface.** Owned
   by Part C: `HybridFeedbackButton.tsx`, `HybridPrecisionPanel.tsx`,
   the hybrid-finding render lines inside `FindingsPanel.tsx`.
5. **Part B has a bail-out.** If grep returns >15 distinct files,
   split B into B1 (mechanical swaps) + B2 (Storybook sweep) and
   absorb B2 into a future wave.
6. **Part C is read-only over the audit chain.** No new audit kinds,
   no IDB writes.
7. **Part C surfaces the audit entry id as plain text.** No "jump to
   audit log", no inlined payload. Truncated to 8 chars in the `<dd>`;
   full id in `title=` for hover/copy.
8. **Part E rebases last.** Source cap **0**. Conditional floor bump:
   ≥91.2 → 91, ≥90.7 → 90.5, else no bump.
9. **No CSP / bundle-budget / IDB-schema changes** in Wave 32. No new
   third-party dependencies. No new audit `kind`s.

## §2 Out of scope

- "Jump to audit log" interaction or audit-log search by entry id.
- Inline-rendering the full `llm-classify` payload — already in the
  disclosure.
- Demoting rules off the hybrid allowlist (`packV1.ts hybridAnchors`).
  Still gated on real `hybrid-feedback` data volume.
- Hybrid feedback "review queue" UI.
- Worker-path classifier; `@xenova/transformers` upstream-bump watch.
- Nightly Lighthouse / nightly bundle-budget jobs.
- Slack / email notifications on Part A failure.
- Adding new semantic tokens beyond 1–2 in Part B's sweep.
- Pushing branch coverage past 91 via contrived tests on defensive code.

## §3 Execution dependency graph

```
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ Part A   │   │ Part B   │   │ Part C   │
   │ nightly  │   │ dark-mode│   │ click-to-│
   │ real-    │   │ regression│  │ explain  │
   │ model    │   │ sweep    │   │ audit id │
   │ GHA      │   │ + sb pass│   │ link     │
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

A, B, C branch from `origin/main` (`41d7abb`) and dispatch in parallel.
E rebases off `main` after A, B, C merge.

---

## §4 Part A — Nightly real-model GHA

**Branch:** `wave32-A-real-model-nightly`
**Worktree:** `worktrees/wave32-A-real-model-nightly`
**Heartbeat:** `.claude/agent-status/wave32-A.log`

**Files (cap: 0 src, 0 test):**

- Create: `.github/workflows/real-model-nightly.yml`
- One-time external action (GitHub repo state, not in git):
  `gh label create nightly-real-model-broken --color FF0000
   --description "Nightly real-model spec is broken"`. Document in PR.

### Acceptance

- [ ] **A.1** Pre-implementation verification.
  - Read `tests/e2e/hybrid-golden.spec.ts` header; confirm env var is
    `RUN_REAL_MODEL=1` and the local invocation pattern matches the
    workflow steps below.
  - Run `cd app && cat package.json | grep -A1 '"build:classifier-assets"'`
    to confirm the script exists. Inspect the script body:
    `cat app/scripts/build-classifier-assets.* 2>/dev/null` (or
    wherever it lives) and verify it does NOT require any secret not
    in `secrets.GITHUB_TOKEN`. If it does (e.g. private model
    registry), STOP and report — do not invent secrets.
  - Confirm the label `nightly-real-model-broken` does not already
    exist with a different colour/description:
    `gh label list --search nightly-real-model-broken`. If absent,
    create it once:
    ```
    gh label create nightly-real-model-broken \
      --color FF0000 \
      --description "Nightly real-model spec is broken"
    ```
    Document in the eventual PR description.

- [ ] **A.2** Create `.github/workflows/real-model-nightly.yml` with
      this exact content:

```yaml
name: real-model-nightly

on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:

permissions:
  contents: read
  issues: write

jobs:
  real-model:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: |
            package-lock.json
            app/package-lock.json

      - name: Install root dev deps (Playwright runner)
        run: npm ci

      - name: Install app deps
        working-directory: app
        run: npm ci

      - name: Install chromium for Playwright
        run: npx playwright install --with-deps chromium

      - name: Build classifier assets
        working-directory: app
        run: npm run build:classifier-assets

      - name: Build app
        working-directory: app
        run: npm run build

      - name: Run real-model spec
        env:
          RUN_REAL_MODEL: '1'
        run: npx playwright test --project=chromium tests/e2e/hybrid-golden.spec.ts

      - name: Open or update issue on failure
        if: failure()
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          set -euo pipefail
          label=nightly-real-model-broken
          run_url="${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
          existing=$(gh issue list --state open --label "$label" --json number --jq '.[0].number // empty')
          body="Run failed at $(date -u +%FT%TZ). Run: $run_url"
          if [ -z "$existing" ]; then
            gh issue create \
              --title "Nightly real-model spec broken" \
              --label "$label" \
              --body "$body"
          else
            gh issue comment "$existing" --body "$body"
          fi

      - name: Close issue on success
        if: success()
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          set -euo pipefail
          label=nightly-real-model-broken
          existing=$(gh issue list --state open --label "$label" --json number --jq '.[0].number // empty')
          if [ -n "$existing" ]; then
            gh issue comment "$existing" --body "Recovered at $(date -u +%FT%TZ). Run: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
            gh issue close "$existing"
          fi
```

  Commit:
  ```
  git add .github/workflows/real-model-nightly.yml
  git commit -m "wave32-A: nightly real-model GHA + auto-issue management"
  ```

- [ ] **A.3** Trigger a manual run via `workflow_dispatch` to verify
      the workflow lints and the happy path works:
  ```
  git push -u origin wave32-A-real-model-nightly
  gh workflow run real-model-nightly.yml --ref wave32-A-real-model-nightly
  gh run watch
  ```
  Expected: green run end-to-end. Note the run number; capture in PR
  description.

- [ ] **A.4** Verify the failure path on a throwaway commit. On the
      same branch:
  - Add a temporary always-failing line to the spec or pass an
    obviously-bad arg to playwright; commit (do NOT push to main).
  - Trigger `workflow_dispatch` again; expect failure.
  - Confirm an issue with title "Nightly real-model spec broken" and
    label `nightly-real-model-broken` was opened. Note the issue
    number.
  - Revert the temporary breakage; commit; trigger again; expect
    success.
  - Confirm a "Recovered at" comment was added and the issue was
    closed.
  - Force-push to drop the throwaway commits; ensure the branch only
    contains the workflow-add commit before opening the PR.

- [ ] **A.5** Open PR with title `wave32-A: nightly real-model GHA`.
      Body must include:
  - Run URL from A.3 (happy path proof).
  - Issue URL from A.4 (failure-path proof; OK if closed).
  - Label-create command from A.1 (one-time setup record).

  Then `gh pr merge --auto --squash` exactly once. Do not bypass
  hooks.

## §5 Part B — Dark-mode regression sweep + Storybook smoke

**Branch:** `wave32-B-dark-mode-sweep`
**Worktree:** `worktrees/wave32-B-dark-mode-sweep`
**Heartbeat:** `.claude/agent-status/wave32-B.log`

**Files (cap: ≤ 12 component edits + 1 test + 1 Storybook config edit;
0 new src files unless adding a token to `index.css`, which counts in
the 12-cap as an edit):**

- Modify: ≤ 12 component files in `app/src/ui/**` and/or
  `app/src/App/**` (token swaps).
- Modify (only if needed): `app/src/index.css` (1–2 new tokens
  maximum).
- Create: `app/src/test/dark-mode-regression.test.ts`
- Modify: `app/.storybook/preview.ts` (theme decorator).

**Excluded from this part (owned by Part C):**
- `app/src/ui/HybridFeedbackButton.tsx`, `app/src/ui/HybridFeedbackButton.test.tsx`,
  `app/src/ui/HybridFeedbackButton.stories.tsx`
- `app/src/ui/HybridPrecisionPanel.tsx`, `app/src/ui/HybridPrecisionPanel.test.tsx`
- The hybrid-finding render lines inside `app/src/ui/FindingsPanel.tsx`.
  Other parts of FindingsPanel (severity headers, search,
  virtualized list) are fair game for B. **If a single line bridges
  both** (e.g. a wrapper `<div className=...>` around both), the line
  stays unmodified by B; C absorbs it.

### Acceptance

- [ ] **B.1** Audit grep (Pass 1). From the worktree root run:

```bash
grep -rEn '\b(bg|text|border|ring|outline|fill|stroke|from|to|via)-(amber|stone|zinc|slate|neutral|gray|red|orange|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-[0-9]+)?(/[0-9]+)?\b' app/src --include='*.tsx' --include='*.ts'
```

  And:

```bash
grep -rEn "className=.*['\"\`].*#[0-9a-fA-F]{3,8}|style=\{\{[^}]*#[0-9a-fA-F]{3,8}|style=\{\{[^}]*rgb\(|style=\{\{[^}]*hsl\(" app/src --include='*.tsx' --include='*.ts'
```

  Tabulate distinct files. Save the file list to the eventual PR
  description. **If >15 distinct files, BAIL OUT** per §1.5: split
  this part into B1 (the smaller mechanical-swap subset, capped at
  10 files) and absorb the remainder into a B2 follow-up wave.
  Document the split decision in the PR description and STOP this
  task — do not push the larger sweep.

- [ ] **B.2** Mechanical token swaps. For each match in B.1's
      tabulation (≤ 12 files), apply the default mappings below by
      editing each file with `Edit`. Mappings:

| Hard-coded | Replace with |
|-----------|--------------|
| `bg-white`, `bg-amber-50`, `bg-stone-50`, `bg-stone-100` | `bg-paper` or `bg-paper-raised` (raised for elevated cards) |
| `bg-stone-200`, `bg-zinc-100`, `bg-amber-100` | `bg-paper-sunken` |
| `text-black`, `text-zinc-900`, `text-stone-900` | `text-fg` |
| `text-zinc-700`, `text-stone-700` | `text-fg-body` |
| `text-zinc-500`, `text-stone-500`, `text-zinc-600` | `text-fg-muted` |
| `text-zinc-400`, `text-stone-400` | `text-fg-faint` |
| `border-zinc-200`, `border-stone-200`, `border-amber-200` | `border-rule` (or `border-rule-subtle` if it's a low-emphasis divider) |
| `text-blue-*`, `bg-blue-*` (accent role) | `text-ink`, `bg-ink` |
| `bg-red-*`, `text-red-*` (severity-high) | `text-severity-high`, `bg-severity-bg-error` |
| `bg-amber-*`, `text-amber-*` (severity-medium role) | `text-severity-medium`, `bg-severity-bg-warn` |

  If a match has no obvious mapping, prefer the closest existing
  token; only add a new token to `app/src/index.css` if the same
  semantic role surfaces in 2+ places and no existing token covers
  it. New tokens go in BOTH the `@theme` block (light defaults) AND
  the `[data-theme="dark"]` override block.

  Commit each file (or small batch) as you go:
  ```
  git add app/src/ui/<File>.tsx
  git commit -m "wave32-B: swap palette classes to semantic tokens in <File>"
  ```

- [ ] **B.3** Re-run the B.1 grep. Expected: zero matches across the
      changed files. If any remain, fix them (still within the 12-cap)
      or add to the regression test's allow-list (B.4) with an inline
      comment documenting why.

- [ ] **B.4** Create `app/src/test/dark-mode-regression.test.ts`.
      First, decide which implementation to use by checking for any
      existing `execSync`-based test in the repo:
      `grep -rln "execSync" app/src --include='*.test.*'`.

  - **If an `execSync` test pattern already exists**, mirror it.
    Test contents:

```ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

const FORBIDDEN_PATTERN =
  '\\b(bg|text|border|ring|outline|fill|stroke|from|to|via)-(amber|stone|zinc|slate|neutral|gray|red|orange|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-[0-9]+)?(/[0-9]+)?\\b';

// Hybrid-finding disclosure surface — owned by Part C; fixed there.
// Keep this list short and document why each path is excluded.
const ALLOW_LIST_PATHS: ReadonlyArray<string> = [
  'src/ui/HybridFeedbackButton.tsx',
  'src/ui/HybridPrecisionPanel.tsx',
  // FindingsPanel.tsx is partially owned by C (hybrid-finding render
  // lines only). Excluded entirely from this regression to avoid
  // bouncing back-and-forth across waves; if non-hybrid lines drift
  // to non-token colours after this lands, a future wave re-tightens.
  'src/ui/FindingsPanel.tsx',
];

describe('dark-mode regression: no hard-coded palette colors in components', () => {
  it('finds zero forbidden Tailwind palette classes in app/src outside the allow list', () => {
    const exclude = ALLOW_LIST_PATHS.map((p) => `--exclude=${p.replace(/[^/]*\//, '')}`).join(' ');
    // grep --exclude takes a basename glob; we list relative paths above
    // for documentation but pass basenames at the boundary.
    const cmd = `grep -rEn ${exclude} '${FORBIDDEN_PATTERN}' src --include='*.tsx' --include='*.ts' || true`;
    const out = execSync(cmd, { cwd: 'app' }).toString().trim();
    expect(out, `Found hard-coded Tailwind palette classes:\n${out}`).toBe('');
  });
});
```

  - **If no `execSync` test pattern exists**, fall back to a pure-Node
    walker. Replace the body with:

```ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const FORBIDDEN = /\b(bg|text|border|ring|outline|fill|stroke|from|to|via)-(amber|stone|zinc|slate|neutral|gray|red|orange|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-\d+)?(\/\d+)?\b/;

const ALLOW_LIST_PATHS: ReadonlyArray<string> = [
  'src/ui/HybridFeedbackButton.tsx',
  'src/ui/HybridPrecisionPanel.tsx',
  'src/ui/FindingsPanel.tsx',
];

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

function isExcluded(rel: string): boolean {
  return ALLOW_LIST_PATHS.some((p) => rel.split(sep).join('/') === p);
}

describe('dark-mode regression: no hard-coded palette colors in components', () => {
  it('finds zero forbidden Tailwind palette classes in app/src outside the allow list', () => {
    const root = 'app/src';
    const offenders: Array<{ file: string; line: number; text: string }> = [];
    for (const path of walk(root)) {
      if (!/\.(tsx|ts)$/.test(path) || /\.test\.tsx?$/.test(path) || /\.stories\.tsx?$/.test(path)) continue;
      const rel = relative('app', path);
      if (isExcluded(rel)) continue;
      const lines = readFileSync(path, 'utf8').split('\n');
      lines.forEach((text, i) => {
        if (FORBIDDEN.test(text)) offenders.push({ file: rel, line: i + 1, text: text.trim() });
      });
    }
    const formatted = offenders.map((o) => `${o.file}:${o.line}  ${o.text}`).join('\n');
    expect(offenders, `Found hard-coded Tailwind palette classes:\n${formatted}`).toEqual([]);
  });
});
```

  Run: `cd app && npx vitest run src/test/dark-mode-regression.test.ts`.
  Expected: PASS (because B.2 cleared the offending classes).

  If it FAILS, inspect output: either fix more files (within the
  12-cap) or add an explicit allow-list path with a one-line comment
  documenting why. Do NOT silence failures by overly-broad allow-list
  entries.

  Commit:
  ```
  git add app/src/test/dark-mode-regression.test.ts
  git commit -m "wave32-B: regression test pinning palette-class absence"
  ```

- [ ] **B.5** Storybook theme decorator (Pass 2 setup). Read the
      existing `app/.storybook/preview.ts` first to see the current
      shape, then merge the theme toolbar in. Pattern:

```ts
// Add to existing Preview object.
globalTypes: {
  theme: {
    description: 'Theme override',
    defaultValue: 'light',
    toolbar: {
      title: 'Theme',
      icon: 'paintbrush',
      items: [
        { value: 'light', title: 'Light' },
        { value: 'dark', title: 'Dark' },
      ],
    },
  },
},
decorators: [
  // ...keep existing decorators
  (Story, ctx) => {
    const theme = (ctx.globals as { theme?: string }).theme ?? 'light';
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    return Story();
  },
],
```

  Do NOT overwrite existing decorators or globalTypes — merge.
  Commit:
  ```
  git add app/.storybook/preview.ts
  git commit -m "wave32-B: Storybook theme decorator (light/dark toolbar)"
  ```

- [ ] **B.6** Storybook visual smoke pass. Run `cd app && npm run
      storybook` and toggle the theme to dark. Eyeball each story:
  - Invisible text (token mismatch grep can't catch)
  - Focus-ring visibility on dark surfaces (try Tab through a story)
  - `:hover` / `:active` state contrast on `--state-hover` /
    `--state-active`
  - Hard-coded colours inside `style={{...}}` props that grep missed

  For any visual issue found, fix with a token swap in the offending
  component (still within the 12-cap; if you've already exceeded the
  cap, document the remaining issue in the PR body as a follow-up).

- [ ] **B.7** Local gate:
```
cd app && npm run typecheck && npm run lint && npm test
```
  All green. Specifically verify the new
  `dark-mode-regression.test.ts` passes and the existing
  axe-against-light test still passes.

- [ ] **B.8** Push, open PR titled `wave32-B: dark-mode regression
      sweep + Storybook smoke`. PR body must include:
  - The B.1 grep file list (before swap)
  - The post-swap grep output (should be empty, modulo allow-list)
  - File count vs. the 12-cap; if bail-out triggered, the B1/B2 split
    rationale
  - One Storybook screenshot or short note confirming the dark smoke
    pass landed clean
  - Confirmation that no excluded files were touched

  Then `gh pr merge --auto --squash` exactly once.

## §6 Part C — Click-to-explain audit-id linkage

**Branch:** `wave32-C-explain-audit-link`
**Worktree:** `worktrees/wave32-C-explain-audit-link`
**Heartbeat:** `.claude/agent-status/wave32-C.log`

**Files (cap: ≤ 2 src + 1 test, possibly + 1 hook if no audit-chain
access pattern is already in use; +1 unrelated dark-mode token swap
allowed only on files this part already edits):**

- Create: `app/src/audit/findClassifyEntry.ts`
- Create: `app/src/audit/findClassifyEntry.test.ts`
- Modify: the hybrid-finding disclosure component (path verified in
  C.1; most likely `app/src/ui/FindingsPanel.tsx` or a sub-component).
- Optionally create: a small hook (e.g. `useClassifyEntry.ts`) ONLY
  if the existing audit-chain access pattern from Wave 30-A
  (`HybridPrecisionPanel`) cannot be reused by the disclosure
  component.

### Acceptance

- [ ] **C.1** Pre-implementation verification.
  - Read `app/src/audit/auditLog.ts` (or wherever `AuditEntry` is
    defined). Confirm the `AuditEntry` shape, particularly:
    - whether each entry has a stable `id` field, and
    - what the canonical reference is (if there's a `hash` field, use
      that; if neither exists, fall back to deterministic synthesis
      `<modelId>-<ruleId>-<paragraphIndex>-<ts>` and document why in
      the implementation).
    - Where the `hybrid-feedback` and `llm-classify` payloads are
      shaped (`{ ruleId, paragraphIndex, modelId, similarity }` from
      Wave 23 / Wave 29-C).
  - Read `app/src/audit/hybridStats.ts` and `app/src/ui/HybridPrecisionPanel.tsx`
    to learn the audit-chain access pattern in use post-Wave-30-A.
    **Mirror that pattern**; do NOT introduce a new data-access path.
  - Read `app/src/ui/FindingsPanel.tsx` and identify the exact
    insertion point for the new `<dt>/<dd>` pair. Look for the existing
    hybrid-finding evidence section (where `modelId` and `similarity`
    render). Note the file path and approximate line range; record in
    PR description.
  - Document findings (id-field availability, audit-chain access
    pattern, insertion point) in the eventual PR description.

- [ ] **C.2** Write `app/src/audit/findClassifyEntry.test.ts` FIRST
      (TDD), watch it fail with module-not-found. Adapt the
      `AuditEntry` literal shape from C.1's verification.

```ts
import { describe, it, expect } from 'vitest';
import { findClassifyEntry } from './findClassifyEntry';
import type { AuditEntry } from './auditLog';

// Adapt this factory to match the actual AuditEntry shape verified in C.1.
function entry(
  kind: string,
  payload: Record<string, unknown>,
  id = 'x',
): AuditEntry {
  return { kind, payload, id /* + other required fields per C.1 */ } as AuditEntry;
}

describe('findClassifyEntry', () => {
  it('returns null on empty chain', () => {
    expect(findClassifyEntry([], 'rule.x', 3)).toBeNull();
  });

  it('returns null when no entry matches (ruleId + paragraphIndex)', () => {
    const chain = [entry('llm-classify', { ruleId: 'rule.y', paragraphIndex: 3 })];
    expect(findClassifyEntry(chain, 'rule.x', 3)).toBeNull();
    const wrongPara = [entry('llm-classify', { ruleId: 'rule.x', paragraphIndex: 4 })];
    expect(findClassifyEntry(wrongPara, 'rule.x', 3)).toBeNull();
  });

  it('returns the matching entry when one exists', () => {
    const match = entry('llm-classify', { ruleId: 'rule.x', paragraphIndex: 3 }, 'a1');
    const chain = [entry('other', {}), match];
    expect(findClassifyEntry(chain, 'rule.x', 3)).toBe(match);
  });

  it('returns the most recent when multiple match', () => {
    const old = entry('llm-classify', { ruleId: 'rule.x', paragraphIndex: 3 }, 'old');
    const recent = entry('llm-classify', { ruleId: 'rule.x', paragraphIndex: 3 }, 'recent');
    const chain = [old, entry('other', {}), recent];
    expect(findClassifyEntry(chain, 'rule.x', 3)?.id).toBe('recent');
  });

  it('ignores entries with non-llm-classify kinds (incl. hybrid-feedback)', () => {
    const chain = [
      entry('hybrid-feedback', { ruleId: 'rule.x', paragraphIndex: 3 }),
      entry('parse-lease', { ruleId: 'rule.x', paragraphIndex: 3 }),
    ];
    expect(findClassifyEntry(chain, 'rule.x', 3)).toBeNull();
  });
});
```

  Run: `cd app && npx vitest run src/audit/findClassifyEntry.test.ts`.
  Expected: 5 tests fail with module-not-found.

- [ ] **C.3** Implement `app/src/audit/findClassifyEntry.ts`:

```ts
import type { AuditEntry } from './auditLog';

/**
 * Find the most recent kind:'llm-classify' audit entry matching
 * (ruleId, paragraphIndex). Returns null if none exists.
 *
 * Iterates from the tail to find the most recent match. O(n) in
 * chain length; the caller is responsible for memoisation if the
 * chain is large.
 */
export function findClassifyEntry(
  chain: ReadonlyArray<AuditEntry>,
  ruleId: string,
  paragraphIndex: number,
): AuditEntry | null {
  for (let i = chain.length - 1; i >= 0; i--) {
    const entry = chain[i];
    if (!entry || entry.kind !== 'llm-classify') continue;
    const payload = entry.payload as { ruleId?: unknown; paragraphIndex?: unknown };
    if (payload.ruleId === ruleId && payload.paragraphIndex === paragraphIndex) {
      return entry;
    }
  }
  return null;
}
```

  Adapt the `payload` cast to match the actual shape verified in C.1
  if `AuditEntry.payload` is more strongly typed.

  Rerun C.2's vitest command. Expected: all 5 pass. Commit:
  ```
  git add app/src/audit/findClassifyEntry.ts app/src/audit/findClassifyEntry.test.ts
  git commit -m "wave32-C: findClassifyEntry helper"
  ```

- [ ] **C.4** Wire into the hybrid-finding disclosure. Following the
      audit-chain access pattern documented in C.1, wire
      `findClassifyEntry(chain, ruleId, paragraphIndex)` into the
      disclosure component identified in C.1. Insert below the
      existing evidence pairs (`modelId`, `similarity`):

```tsx
{classifyEntry && (
  <>
    <dt>audit entry</dt>
    <dd
      className="font-mono text-small text-fg-muted"
      title={classifyEntry.id}
    >
      {classifyEntry.id.slice(0, 8)}
    </dd>
  </>
)}
```

  Adapt `.id` to the canonical reference field from C.1. If a stable
  id doesn't exist, derive a deterministic synthesis:

```tsx
const refId =
  classifyEntry.id ??
  `${(classifyEntry.payload as { modelId?: string }).modelId ?? 'unknown'}` +
  `-${(classifyEntry.payload as { ruleId?: string }).ruleId}` +
  `-${(classifyEntry.payload as { paragraphIndex?: number }).paragraphIndex}` +
  `-${classifyEntry.ts ?? 0}`;
```

  ...and document the fallback choice in code comments + PR description.

  When `findClassifyEntry` returns `null` (fresh installs, pre-Wave-21
  chains, non-hybrid findings), render nothing. The disclosure
  already handles partial evidence gracefully.

- [ ] **C.5** Optional hook (only if needed). If the disclosure
      component cannot reach the audit chain via the pattern from
      C.1 (e.g. it sits below the level where the chain is loaded),
      add a small hook:

```ts
// app/src/ui/useClassifyEntry.ts
import { useMemo } from 'react';
import { findClassifyEntry } from '../audit/findClassifyEntry';
import type { AuditEntry } from '../audit/auditLog';

export function useClassifyEntry(
  chain: ReadonlyArray<AuditEntry>,
  ruleId: string,
  paragraphIndex: number,
) {
  return useMemo(
    () => findClassifyEntry(chain, ruleId, paragraphIndex),
    [chain, ruleId, paragraphIndex],
  );
}
```

  Skip this entirely if the chain is already prop-passed where you
  need it. `findClassifyEntry` is pure and fine to call inline in a
  React component as long as the chain reference is stable across
  renders.

- [ ] **C.6** Extend the existing FindingsPanel test (or whichever
      test file currently exercises the hybrid-finding disclosure
      from Wave 25/29) with one test asserting:
  - When the audit chain has a matching `kind:'llm-classify'` entry,
    the truncated id is rendered with a `title` containing the full
    id.
  - When no match exists, the new `<dt>` does NOT render (assert via
    `queryByText` returning null).

  This assertion lives in the existing test file rather than a new
  one, to stay within the 1-test-file cap and to share fixtures.

- [ ] **C.7** Dark-mode boundary fix-as-found. While editing the
      disclosure component (and any other touched files), if you see
      a hard-coded Tailwind palette class (`bg-amber-50`, `text-zinc-700`,
      etc.), fix it in the same PR with the appropriate semantic
      token from §5.B.2's mapping table. Do NOT punt to Part B —
      that's the explicit "fix it where you find it" rule.

- [ ] **C.8** Local gate:
```
cd app && npm run typecheck && npm run lint && npm test
```
  All green. The new `findClassifyEntry.test.ts` and the extended
  FindingsPanel test must pass.

- [ ] **C.9** Push, open PR titled `wave32-C: click-to-explain audit
      entry id`. PR body must include:
  - C.1 verification findings (id-field availability + access pattern)
  - The exact files touched (must match cap)
  - Any dark-mode-fix-as-found edits made under §6.C.7
  - A screenshot of the disclosure with the new id readout

  Then `gh pr merge --auto --squash` exactly once.

## §7 Dispatch matrix

| Part | Branch                              | Files cap (src/test/other)       | Depends on        | Heartbeat                                  |
|------|-------------------------------------|----------------------------------|-------------------|---------------------------------------------|
| A    | `wave32-A-real-model-nightly`       | 0 / 0 / 1 workflow               | `origin/main` (`41d7abb`) | `.claude/agent-status/wave32-A.log` |
| B    | `wave32-B-dark-mode-sweep`          | ≤ 12 / 1 / 1 SB config           | `origin/main` (`41d7abb`) | `.claude/agent-status/wave32-B.log` |
| C    | `wave32-C-explain-audit-link`       | ≤ 2 / 1 / —                      | `origin/main` (`41d7abb`) | `.claude/agent-status/wave32-C.log` |
| E    | `wave32-E-coverage`                 | 0 / N / 1 vitest config edit max | A + B + C merged  | `.claude/agent-status/wave32-E.log`         |

Per `~/.claude/CLAUDE.md` Subagent Dispatch Rules: each subagent
heartbeats every ~5 min; orchestrator polls every 10 min and treats
≥30 min idle as stalled. Per Worktree convention: worktrees go under
`<project>/worktrees/<branch>`.

## §8 PR / merge protocol

1. **Per-part local gate.** `npm run typecheck && npm run lint &&
   npm test` green before any push.
2. **CI gate.** `gh pr checks <pr>` must be green before
   `gh pr ready`. Wave 30-C closed the ~~Mergify~~ red-bypass; A/B/C can
   merge in parallel.
3. **Auto-merge attempt.** `gh pr merge --auto --squash` exactly
   once per PR. If rejected, print PR URL + blocking reason and stop.
4. **Merge order.** A, B, C in any order; E rebases off post-merge
   `main`.
5. **Post-wave sweep.** After E merges, run `npm run test:coverage`
   on `main`; record final number in E's PR body.

## §9 Part E — Coverage push (rebases last)

**Branch:** `wave32-E-coverage` — cut **after** A, B, C merge.
**Worktree:** `worktrees/wave32-E-coverage`
**Heartbeat:** `.claude/agent-status/wave32-E.log`

**Files (cap: 0 src; tests as needed; 1 coverage-config edit max):**

### Acceptance

- [ ] **E.1** From `main` (after A, B, C merge), run:
```
cd app && npm run test:coverage
```
  Capture post-merge branches/lines/functions/statements percentages.
  Identify the 5–10 lowest-covered branches in actually-meaningful
  code. Prioritize new code from Wave 32: `findClassifyEntry.ts`,
  `dark-mode-regression.test.ts` (verify the test itself has
  coverage), and any new tokens in `index.css` (note: CSS isn't in
  the coverage report; tokens add to bundle size, not branches).

  Verify the coverage-config path: `grep -n "thresholds\|branches:"
  app/vite.config.ts | head`.

- [ ] **E.2** Add targeted tests against those branches. Each test
      must have a "what does this protect" reason in its `describe`
      block name. Forbidden: noop-fixture filler tests, snapshot tests
      added purely for coverage.

  Rerun coverage after each test file lands.

- [ ] **E.3** Conditional floor bump in `app/vite.config.ts`:
  - if branches ≥ 91.2% → bump `branches` to **91**
  - else if branches ≥ 90.7% → bump to **90.5**
  - else → ship tests without floor bump

  Don't lower other thresholds. Mirror Wave 31-C's discipline.

- [ ] **E.4** Local gate:
```
cd app && npm run typecheck && npm run lint && npm run test:coverage
```
  All green at the (possibly bumped) floor.

- [ ] **E.5** Push, open PR titled `wave32-E: coverage push`. PR body
      includes a before/after coverage table and the list of modules
      from E.1. Then `gh pr merge --auto --squash` exactly once.

## §10 Success criteria

- [ ] Nightly real-model GHA runs daily at 06:00 UTC; auto-issue
      proven on a force-failure throwaway commit; auto-close proven
      on recovery.
- [ ] Audit grep of `app/src/**/*.{ts,tsx}` returns zero hard-coded
      Tailwind palette classes outside the documented allow-list.
- [ ] Storybook theme toolbar lets a maintainer toggle between
      `light` and `dark` per story; dark smoke pass landed clean.
- [ ] `findClassifyEntry` covers five behavior cases with passing
      tests; the disclosure renders the truncated id with `title=`
      full id; renders nothing when no match exists.
- [ ] Branch coverage ≥ pre-wave baseline + meaningful gain;
      conditional floor bump applied per §9.E.3.
- [ ] All four PRs CI-green at merge.
- [ ] No new audit `kind`s, no CSP / bundle / IDB schema bumps, no
      new third-party deps.

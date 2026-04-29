# Wave 45-A — Card → Badge severity extract Implementation Plan

**Goal.** Close the documented heritage exception in `app/src/ui/system/Card.tsx`: replace the 3px `border-l` severity stripe (an absolute-ban violation per `DESIGN.md`) with a `<Badge>` primitive that lifts `severity-bg-*` + icon + label into the design system. After this wave, no surface in the codebase signals severity by side-stripe or by color alone.

**Architecture.** New `Badge` primitive lives at `app/src/ui/system/Badge.tsx`. `Card` keeps its existing API but `accent` is removed; consumers that need per-row severity render a `<Badge severity={…}>` inside the card header, plus an optional tinted-row `<Card variant="severity">` background tint via the existing `--color-severity-bg-*` tokens.

**Tech Stack.** React 18 + TypeScript strict, Tailwind v4 with `@theme {}` tokens already in place, Vitest + RTL, Storybook 8 CSF.

**Base SHA.** `origin/main` at start of Wave 45-A. Verify `git fetch origin && git log origin/main --oneline -5` before branching.

**Prerequisites.** PRs #164 (design-system docs) and #165 (token polish) merged. Confirm with `gh pr view 164 --json state` and `gh pr view 165 --json state` showing `MERGED`.

---

## §1 Hard rules

1. **One PR.** Whole wave on one feature branch.
2. **No new dependencies.** Use existing tokens, existing icon strategy (inline SVG in JSX, the same pattern `SeverityOverridesPanel` uses for its row-status badges).
3. **`Card` API breakage is contained.** The only consumer of `accent=` today is `FindingsPanel.tsx:403` (verified). Migrate it inside the same PR; leave no transitional `accent` prop.
4. **`Card.test.tsx` rewrites are required.** Tests at `app/src/ui/system/Card.test.tsx:25` (`accent` rendering) and `:32` (no-accent) must be replaced with `variant` tests.
5. **Storybook coverage** for both `<Badge>` (one story per severity) and the new `<Card variant="severity">` variant. The all-stories axe sweep at `app/src/ui/__tests__/all-stories.a11y.test.tsx` runs on every story; both must pass without new violations.
6. **No `border-l` greater than 1px** anywhere in `app/src/ui/system/**` after the wave. Add a grep gate to the wave's verification step.
7. **Local gate green** (`typecheck && lint && test:coverage`) before push.

## §2 Out of scope

- The renter-IA split of `AppCurrentPane.tsx` (Wave 45-B). 45-A only delivers the primitive that 45-B consumes.
- `ComparePanel` rewrite (Wave 45-C).
- Severity-vs-negative discipline pass on app-error sites (Wave 45-E).
- Adding a `Badge` variant for status (positive / negative). Wave 45-A scope is severity only; status variants land in 45-E.
- Migrating the existing inline severity-bg usage in `SeverityOverridesPanel.tsx:48-52` to the new `<Badge>`. That panel is already on-spec; refactoring it carries risk without payoff. Note in BACKLOG as a follow-up.

## §3 Execution

Direct, single-track. Estimated 90-120 min including tests + Storybook stories.

## §4 Item A — `Badge` primitive

**Why.** `DESIGN.md` §5 ("Severity Badges & Row Highlights") prescribes the exact pattern: `severity-bg-*` background, matching `severity-border-*` border, `--color-fg` foreground, 16px inline SVG icon, one-word label. Today the only place this pattern exists is hand-rolled inline at `SeverityOverridesPanel.tsx:48-52, 121-126`. Lifting it into a primitive is a precondition for every consumer in 45-B and 45-C.

**Files:**
- Create: `app/src/ui/system/Badge.tsx`
- Create: `app/src/ui/system/Badge.test.tsx`
- Create: `app/src/ui/system/Badge.stories.tsx`

**API:**
```tsx
type Severity = 'high' | 'medium' | 'low' | 'info';
interface BadgeProps {
  severity: Severity;
  /** Optional override for the visible label. Defaults to capitalized severity. */
  label?: string;
  className?: string;
}
```

**Doctrine to enforce:**
- Background: `bg-[var(--color-severity-bg-error|warn|info)]` (low maps to info-bg, see DESIGN.md §2 — sage doesn't have a tinted-bg pair today; either add `--color-severity-bg-low` to `index.css` or document that low maps to info-bg). Decide in Step 1 below.
- Border: matching `--color-severity-border-*`.
- Foreground: `text-fg` (always Ink Black for AA on tinted bg).
- Icon: 16px inline SVG, `aria-hidden="true"`. Glyph by severity:
  - high — triangle exclamation
  - medium — circle exclamation
  - low — circle dot
  - info — circle "i"
- Label: 12.5px / 18px / weight 600 / +0.01em letterspace (system sans, matches `--text-small`).
- `role="status"` is **not** added by the badge itself. The badge is decoration of severity already known from the surrounding card / row; adding `role="status"` would make every badge an aria-live region.

**Steps:**
- [ ] Decide low-severity bg: extend `app/src/index.css` to add `--color-severity-bg-low` and `--color-severity-border-low` (sage @ 22% / 40%) **or** document in `DESIGN.md` §2 that low maps to info-bg. Default to **adding the low pair** — the four-severity palette is symmetrical in tokens, asymmetrical in surfaces is a design smell.
- [ ] Write `Badge.tsx` with the four icons inline. Reference the `SeverityOverridesPanel` color-mix pattern for parity.
- [ ] Write `Badge.test.tsx`: render each severity, assert background class, assert text label, assert icon `aria-hidden`, assert color contrast (use existing axe helper from `app/src/ui/__tests__/severity-table.a11y.test.tsx` as model).
- [ ] Write `Badge.stories.tsx`: one story per severity + a `Combined` story showing all four in a row.
- [ ] `npm run typecheck && npm run lint && npm test -- Badge`.
- [ ] Commit: `feat(system): add Badge primitive for severity surfaces`.

## §5 Item B — `Card` accent removal + `variant="severity"` tinted row

**Why.** `Card.tsx:15-19` (`ACCENT_BORDER`) is the project's last side-stripe. DESIGN.md Don't #1 names it. Going-forward severity is `<Badge>` (Item A) plus, where the *whole row* should read as severity-tinted, a `<Card variant="severity-{level}">` that paints `bg-severity-bg-*` + `border-severity-border-*` (1px full perimeter, not a stripe).

**Files:**
- Modify: `app/src/ui/system/Card.tsx` — remove `accent` prop + `ACCENT_BORDER` map. Add `variant?: 'default' | 'severity-high' | 'severity-medium' | 'severity-low' | 'severity-info'` prop. Default behavior unchanged for `variant === 'default'` (current cream-paper-raised + 1px rule + hairline shadow).
- Modify: `app/src/ui/system/Card.test.tsx` — drop the two `accent` cases (lines 25 + 32 in current main); add `variant="severity-high"` / `variant="severity-info"` cases that assert the tinted bg + matching border + no `border-l`.

**Steps:**
- [ ] Edit `Card.tsx`: drop `Accent` type + `ACCENT_BORDER` + `accent` prop. Add `variant` prop with the five values. The default branch keeps today's `bg-paper-raised shadow-paper rounded-sm border border-rule`. Severity branches override `bg` and `border` with the `severity-bg-*` / `severity-border-*` tokens.
- [ ] Update `Card.test.tsx`: rewrite the parameterized accent test (`each of high|medium|low|info`) into a variant test. Confirm `border-l-` does not appear in the resulting className.
- [ ] Add a `Card.stories.tsx` story group showing the four severity variants (or extend the existing one if it exists).
- [ ] `npm run typecheck && npm run lint && npm test -- Card`.
- [ ] Commit: `refactor(system): replace Card accent stripe with severity row variant`.

## §6 Item C — Migrate `FindingsPanel` consumer

**Why.** `FindingsPanel.tsx:403` is the only `<Card accent={…}>` consumer in the codebase. Migrating it is the wave's user-visible change: every finding gets a leading `<Badge>` with icon + text, and the row tints with `Card variant="severity-{level}"` so the renter sees the severity *without* relying on the section-header context.

**Files:**
- Modify: `app/src/ui/FindingsPanel.tsx` (line ~403, `VirtualFindingItem` and any sibling that renders `<Card accent={…}>`).
- Modify: `app/src/ui/FindingsPanel.test.tsx` — assert the new `<Badge>` is in the document for a high-severity finding; assert no `border-l-3` class on the row.

**Steps:**
- [ ] In `FindingsPanel.tsx`, replace `<Card accent={finding.severity}>` with `<Card variant={\`severity-\${finding.severity}\`}>` and prepend `<Badge severity={finding.severity} />` inside the card header, before the title.
- [ ] Verify the existing severity-section header pattern (e.g. "High (3)") still reads cleanly above the now-tinted rows; if the tint feels heavy stacked under the header, reduce header's own bg or simply trust the token math.
- [ ] Update `FindingsPanel.test.tsx`: replace any `border-l-3` / `border-l-severity` assertions with `getByText('High')` / `getAllByRole('img', { hidden: true })` checks against the new badge structure.
- [ ] Visual sanity: `npm run dev`, upload a sample lease, eyeball the findings list. Confirm severity reads at a glance for a renter; confirm dark mode still works (severity-bg-* re-derives via `color-mix()` against `paper-raised`, which is now `#fdfcf8` per #165 — verify the dark variant still hits AA contrast).
- [ ] `npm run typecheck && npm run lint && npm run test:coverage`.
- [ ] Commit: `refactor(findings): use Badge + tinted Card variant for finding rows`.

## §7 Item D — Documentation reconcile

**Why.** `DESIGN.md` §5 currently calls the side stripe "the system's one heritage exception"; after this wave it's not an exception, it's gone. Likewise `docs/CLAUDE.md`'s Design Context section flags Card.tsx for migration; that flag should come down.

**Files:**
- Modify: `DESIGN.md` (§5 Components → Cards subsection)
- Modify: `docs/CLAUDE.md` (Design Context section)

**Steps:**
- [ ] In `DESIGN.md` §5, drop the "Severity treatment (current, under refactor)" bullet. Promote "Severity treatment (going-forward)" to the only severity treatment. Add a single sentence noting the `<Badge>` primitive.
- [ ] In `DESIGN.md` §6 Don'ts, drop the "heritage exception" carve-out from Don't #1 — the rule is now flat: "no side-stripe borders, period."
- [ ] In `docs/CLAUDE.md` Design Context, drop the closing paragraph about `Card.tsx`'s heritage exception.
- [ ] In `DESIGN.json` narrative.donts, mirror the simplified Don't #1.
- [ ] Commit: `docs(design): close Card heritage exception after Badge migration`.

## §8 Item E — Verification gate

**Why.** Catch regressions: ensure no future PR re-adds a side-stripe and no consumer still passes `accent=` to Card.

**Files:**
- Modify: `app/eslint.config.js` (or `app/.eslintrc.*`, whichever the project uses) to add a `no-restricted-syntax` rule banning `border-l-[2-9]\d*\b` and `border-l-\d+px` (where the px value > 1) inside string literals in `**/*.tsx`. **Optional.** If the eslint rule is too noisy or hard to express, use a vitest "policy test" instead at `app/src/test/no-side-stripe.policy.test.ts` that greps the source tree.

**Steps:**
- [ ] Decide eslint rule vs policy test. Default: **policy test** — it's cleaner and runs in CI today without lint-config archaeology.
- [ ] Write `app/src/test/no-side-stripe.policy.test.ts`: read every `.tsx` file under `app/src/ui`, regex-match `border-l-(\d+|\[\d+px\])` where the captured number is `>1`, fail if any match. Allow-list: `border-l ` (1px Tailwind shorthand) and `border-l-rule` etc. (color suffix without width).
- [ ] Verify the test passes today. Commit.
- [ ] Commit: `test(policy): forbid side-stripe borders > 1px in ui/**`.

## §9 Wave-level verification

After all five items:

- [ ] `git grep -n "accent=" app/src/ui` — must return zero hits.
- [ ] `git grep -n "border-l-\[3px\]" app/src/ui` — must return zero hits.
- [ ] `git grep -nE "border-l-[2-9]" app/src/ui` — must return zero hits (confirms the policy test would pass).
- [ ] `npm run typecheck && npm run lint && npm run test:coverage` — clean, coverage thresholds met (96/90/93/96).
- [ ] `npm run lhci` — accessibility ≥ 0.95 (severity-bg color contrast must still pass AA in both light and dark).
- [ ] `npm run dev` — visual walk: upload sample lease, confirm renter can identify high-severity findings at a glance via the new badge + tinted row, confirm dark mode contrast.
- [ ] Re-run `/impeccable critique` (optional but the ground truth for this wave) — the P1 "Card side stripe" issue should be gone; expect overall heuristic score to lift from 24/40 toward 26-27/40.

## §10 PR + merge

- Branch: `wave45-badge-extract`
- PR title: `feat(system): Badge primitive + Card severity variant (close side-stripe heritage)`
- PR body: `## Summary` (this plan's goal + the four items + verification), `## Out of scope` (pointer to Waves 45-B/C/D/E), `## Test plan` (the §9 checklist).
- Single squash-merge after `gh pr checks` clears.
- Update BACKLOG `§4 Wave footprint` row counters; mark this plan as "shipped" in the wave's PR description.

## §11 Risks and rollback

- **Risk: tinted-row stacking with severity section headers.** If the row tint plus the header reads as too saturated in light mode, fall back to `Card variant="default"` + `Badge` only (skip the row tint). The Badge alone closes the severity-by-color-only failure; the row tint is the bonus delight.
- **Risk: dark-mode contrast regression on `severity-bg-low`** (new token). Validate with the same axe / contrast helper used for the WCAG 2.1 sweep in Wave 41. If sage @ 22% on `paper-raised #1f1a14` doesn't hit AA on `--color-fg #f5edd9`, raise to 30%.
- **Risk: storybook a11y sweep regresses.** The 93-test all-stories run at `app/src/ui/__tests__/all-stories.a11y.test.tsx` is the safety net; if any new story violates AA, fix the token, not the test.
- **Rollback.** Each item is a separate commit; revert in reverse order if a downstream wave (45-B/C) finds a regression.

# Wave 45-C — `ComparePanel` Rewrite Implementation Plan

**Goal.** Rewrite `app/src/ui/ComparePanel.tsx` (currently 103 lines of unstyled HTML rendering raw `<h2>/<h3>/<ul>/<li>` with bare severity strings in `<small>`) into a `Card`-wrapped, `Badge`-driven panel that matches the rest of the post-Wave 45-A design system. In the same touch, absorb the severity-vs-negative discipline pass for ComparePanel's own error sites (the pack-version mismatch alert).

**Architecture.** ComparePanel becomes a `<Card>`-rooted region that renders three `<Card>`-rooted sub-sections (Added / Removed / Changed), each row using `<Badge severity={severity}>` instead of a bare `({severity})` parenthetical. The pack-version mismatch alert at lines 39-54 stays a `role="alert"` div but pairs with a `<Badge severity="info" label="Different rule packs" />` so the signal is not raw `data-variant="warning"` color-only.

**Tech Stack.** React 18 + TypeScript strict, Tailwind v4 with `@theme {}` tokens, Vitest + RTL, Storybook 8 CSF.

**Base SHA.** `origin/main` after Wave 45-D merge (commit `d66fb81` or descendant). Verify `git fetch origin && git log origin/main --oneline -5` before branching.

**Prerequisites.** Wave 45-A merged (`<Badge>` primitive must exist at `app/src/ui/system/Badge.tsx`). Wave 45-D merged.

**Parallel-with.** Wave 45-BE (`wave45-be-renter-ia-and-error-discipline.md`). 45-C and 45-BE share zero `*.tsx` files — confirmed by `grep`. Either may merge first.

---

## §1 Hard rules

1. **One PR.** Whole wave on one feature branch `wave45-c-compare-rewrite`.
2. **No new dependencies.** Reuse `<Card>`, `<Badge>`, existing tokens. No new icon, no new variant.
3. **Single file owned in `src/ui/`.** This wave only modifies `app/src/ui/ComparePanel.tsx` and its test/story siblings. The sole consumer (`AppLibraryAndPacksPane.tsx:146`) is NOT modified — `ComparePanel`'s prop surface stays identical.
4. **Diff semantics unchanged.** `diffFindings` is not touched. Visual structure changes; computed result does not.
5. **`packVersionMismatch` dismiss behavior preserved.** The `useState`-driven dismiss (line 28) and the dismiss button at line 46 must continue to work; existing test coverage must continue to pass.
6. **Storybook coverage** for four states: zero-diff, added-only, removed+changed, packVersionMismatch active. The all-stories axe sweep must remain green.
7. **Real-browser a11y gate.** `npx playwright test tests/e2e/a11y.spec.ts` must pass before push.
8. **Local gate green** (`npm run typecheck && npm run lint && npm run test:coverage`) before push.
9. **Codex adversarial gate** runs before `gh pr ready`.

## §2 Out of scope

- Any change to `diffFindings` or its types.
- Any change to `AppLibraryAndPacksPane.tsx` (45-C does not move the panel or alter its caller-side layout).
- Adding sortable / collapsible sections (current product spec doesn't ask for them; follow-up backlog if needed).
- Renaming `from`/`to` semantics in the changed-row treatment (those names come from the `diffFindings` shape).
- Severity-vs-negative discipline on panels other than `ComparePanel` (those are 45-BE territory).

## §3 Files in scope

- Modify: `app/src/ui/ComparePanel.tsx` (full rewrite, target ≤140 lines)
- Modify: `app/src/ui/ComparePanel.test.tsx` (extend coverage; do NOT delete the existing dismiss test)
- Modify: `app/src/ui/ComparePanel.stories.tsx` (add three new stories alongside any existing one; if no story file exists, create it)

## §4 Execution

**Direct, single-track.** Estimated 90-120 minutes. Three logical items in sequence.

### Item C-1 — Wrap in `<Card>` and replace bare `<h2>/<h3>` with design-system typography

**Why.** Today the panel renders `<section>` + `<h2>` + `<h3>` with no `Card`, no padding, no token-driven typography. Every other panel in the app (FindingsPanel, ShareReviewPanel, AnnotationsPanel) wraps its body in `<Card>` and uses `text-heading uppercase text-fg-muted` for sub-headers. ComparePanel is the documented outlier per 45-A §2.

**Scope.**
- Replace the outer `<section>` with `<Card as="section" aria-label="compare" className="p-4 space-y-4">`.
- Header pattern: keep `<header>` but re-render the title as `<h2 className="text-heading uppercase text-fg-muted">Compare</h2>` and the subtitle paragraph as `<p className="text-body text-fg-body"><strong>{aName}</strong> → <strong>{bName}</strong></p>`.
- Each sub-section becomes its own nested `<Card variant="default" className="p-3 space-y-2">` with an `<h3 className="text-heading uppercase text-fg-muted">` header.
- The empty state (line 56, "No differences in findings between these leases.") becomes `<p className="text-body text-fg-muted">…</p>` rendered inside the outer `<Card>` when `totalDiffs === 0`.

**Tests.** Add a test asserting the outer `aria-label="compare"` landmark survives. Existing tests for added/removed/changed rendering must continue to pass.

**Commit.** `refactor(45-c): wrap ComparePanel in Card + design-system typography`.

### Item C-2 — Replace bare `({severity})` parentheticals with `<Badge severity>`

**Why.** Lines 64, 78, and 95 each render `<small>({f.severity})</small>` — raw severity string, no color, no icon, redundant parens. This is the exact pattern Wave 45-A's `<Badge>` primitive was built to replace. The Changed-row treatment additionally renders a `from → to` severity transition that today is `{c.from.severity} → {c.to.severity}` as plain text; this becomes `<Badge severity={from} /> → <Badge severity={to} />` (two badges, an arrow span between).

**Scope.**
- Added rows (line 62-65): replace `<small>({f.severity})</small>` with `<Badge severity={f.severity} />`. Each `<li>` becomes `<li className="flex items-center gap-2"><strong>{f.title}</strong><Badge severity={f.severity} /></li>`.
- Removed rows (line 75-78): same pattern as Added.
- Changed rows (line 88-97): `<li className="flex items-center gap-2 flex-wrap"><strong>{c.to.title}</strong><Badge severity={c.from.severity} /> <span aria-hidden="true">→</span> <Badge severity={c.to.severity} />{c.from.negated !== c.to.negated && <span className="text-small text-fg-muted">{`negated ${c.from.negated ? 'yes→no' : 'no→yes'}`}</span>}</li>`. Note: the visual arrow gets `aria-hidden="true"` — screen-reader users read the two badges' labels in sequence which conveys the same information without the arrow being announced.
- The "negated" sub-text remains a small muted span (it is not a severity signal; do not badge it).

**Tests.** Per category, assert the badge renders with the expected severity. Add one Changed-row test that asserts both `from` and `to` badges render and the arrow is `aria-hidden`.

**Commit.** `fix(45-c): replace severity parentheticals with Badge primitive`.

### Item C-3 — Pair pack-version mismatch alert with `<Badge severity="info">`

**Why.** Lines 39-54 render `<div role="alert" data-variant="warning">` with bare body text — color-only signal via `data-variant="warning"` (which today maps to nothing in the stylesheet, so the alert is effectively unstyled). Per the 45-E discipline rule absorbed into this wave: every alert pairs with a Badge. This one is informational (rule-pack mismatch is a heads-up, not an error), so `severity="info"`.

**Scope.**
- Inside the `packVersionMismatch && !mismatchDismissed` branch, render `<Badge severity="info" label="Different rule packs" />` immediately before the existing `<p>` body. Keep `role="alert"` on the wrapper div for screen-reader announcement.
- Drop `data-variant="warning"` (dead attribute; nothing styles it).
- Keep the dismiss `<button>` exactly as-is — that affordance is unchanged. Confirm the existing dismiss test still passes.

**Tests.** Extend the existing pack-mismatch test to assert the badge appears alongside the alert. Existing dismiss test must continue passing without modification.

**Commit.** `fix(45-c): pair pack-version mismatch alert with severity badge`.

### §5 Storybook coverage

Add or update stories to cover:
1. `zero-diff` — both leases identical.
2. `added-only` — three Added rows, no Removed, no Changed.
3. `removed-and-changed` — two Removed, two Changed (one with severity transition, one with negated flip).
4. `pack-version-mismatch-active` — `packVersionMismatch={{ a: '1.0.0', b: '2.0.0' }}`.

Each story renders cleanly through `app/src/ui/__tests__/all-stories.a11y.test.tsx`.

**Commit.** `test(45-c): add Storybook coverage for ComparePanel states`.

### §6 Verification

Before `gh pr ready`:

1. `wc -l app/src/ui/ComparePanel.tsx` ≤ 140.
2. `npm run typecheck && npm run lint && npm run test:coverage` — all green.
3. `npx playwright test tests/e2e/a11y.spec.ts` — all green.
4. `gh pr checks <pr>` — all green, no pending.
5. Codex adversarial gate clean or every must-fix logged.

### §7 Risk register

- **Layout regression in `AppLibraryAndPacksPane`** — ComparePanel's outer dimensions change (now padded `<Card>`). Visually verify in Storybook + the live `AppLibraryAndPacksPane` route before push. If the parent assumed zero-padding, fix the parent rather than skipping the `<Card>` wrap (the design-system rule wins).
- **`<Badge severity="info">` mislabel on the pack-mismatch alert** — Codex may flag this as overclaiming. Defense: rule-pack mismatch is informational (it does not invalidate findings; it warns the user that some diffs may be rule-driven not content-driven). If Codex insists, downgrade to a custom non-severity treatment in a follow-up; do not escalate to severity="medium" here without a copy review.
- **`data-variant="warning"` removal** — verify with grep that no test or stylesheet selects on it before deletion.

### §8 Out-of-band notes

- No telemetry change.
- No i18n key change (ComparePanel uses inline English; i18n migration is a separate backlog item, not blocking).
- No public types added or removed.

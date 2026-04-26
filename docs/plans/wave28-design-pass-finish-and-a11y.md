# Wave 28 — Design-pass finish, span highlights & a11y sweep

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` to dispatch Parts A–F per
> the matrix in §6. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish what Wave 27 started by (1) restructuring the
bottom pane into grouped, scannable sections; (2) shipping
span-level highlight bboxes (long-deferred BACKLOG item — closes
the "Phase 8" follow-up flagged in `docs/CLAUDE.md`); (3) polishing
component states (severity table, findings badge, hover/active,
empty states); and (4) running a WCAG 2.1 AA fix-as-found sweep.
All six parts are scoped with explicit file-touch boundaries so
they can run as parallel subagent tracks.

**Architecture:** Six parts split into **three execution waves by
dependency**. Wave-1 parts (A=parser span-bbox foundation,
B=design-system primitives) are foundationally independent and
dispatch in parallel. Wave-2 parts (C=layout split, D=polish,
E=viewer span-bbox integration) rebase off `main` once A+B merge
and dispatch in parallel against disjoint file sets. Wave-3 part
(F=WCAG sweep) runs serially after C+D so the audit targets the
final structure. Each part keeps its own branch, owns its own
files, and ships its own tests + Storybook updates.

**Tech Stack:** React 18 + TypeScript (`strict`,
`noUncheckedIndexedAccess`, `noImplicitOverride`), Vite, Vitest +
RTL + `@testing-library/user-event`, Tailwind v4 (Wave 27
substrate), Storybook 8, Playwright (7 e2e specs), Lighthouse CI
(a11y ≥ 95). CSP-strict — no new network egress, no new third-party
deps.

---

## §0 What changed since Wave 27 (context for fresh agents)

Wave 27 (PRs #109/110/111) shipped:

- **A** — Tailwind v4 substrate, design tokens (cream paper +
  warm-serif headings + terracotta/mustard/sage/slate severity
  palette), 5 primitives in `src/ui/system/`: `Button`, `Card`,
  `Badge`, `Section`, `Field`.
- **B** — primary analyzed view refactor: `AppHeader`,
  `AppCurrentPane`, `FindingsPanel`, `CounterOfferPanel`,
  `LeaseFactsPanel`, `TemplateMatchesPanel`, `AnnotationsPanel`,
  `AppFooterControls` all use the substrate.
- **C** — bottom pane (`AppLibraryAndPacksPane` + 12 panels) and
  alternate views (`AppRedlinePane`, `PortfolioPanel`,
  `PortfolioRollupsPanel`) use the substrate.

Wave 28 builds on top — no Wave 27 rollback risk, but Part C and
Part D both restructure / restyle Wave 27's bottom-pane output, so
they must rebase carefully.

## §1 Scope-shaping decisions (READ BEFORE APPROVING)

1. **Bottom-pane split = accordion, not tabs.** Tabs would require
   hash-routing + a new `view` mode and would lose scannability
   when triaging a single lease. Accordion preserves "scan
   everything" while collapsing optional sections. Default-open for
   "This lease" group; default-collapsed for "Library" and
   "Governance".
2. **Accordion state is in-memory only.** No `localStorage` round
   trip, no IDB. If the user reloads, defaults reset. Avoids a
   tenth IndexedDB module and an audit-event question.
3. **Span-bbox migration is non-breaking.** New optional
   `lines?: LineSpan[]` on `Paragraph` (each carries its own bbox
   + `start`/`end` char offsets within the paragraph). Legacy
   parsed leases without `lines` fall back to current
   paragraph-bbox highlight. **No IDB schema bump, no version
   migration code, no parser version flag.** Re-parsing a lease
   on next open populates `lines`.
4. **No new audit `kind`s.** All six parts are UI / parser /
   viewer-layer; no new persisted state mutations. Hybrid-finding
   provenance toggle from Wave 25 stays unchanged.
5. **WCAG sweep is fix-as-found, not exhaustive AA.** Lighthouse
   (already gated at a11y ≥ 95) + axe-core in jsdom catches ~80%
   of issues; Part F adds a manual focus-order + screen-reader
   walk for the new accordion + tab bar. Full external WCAG audit
   stays in the CLAUDE.md deferred list.
6. **`SectionGroup` and `EmptyState` are new design-system
   primitives** (Part B) — not one-off components. They live in
   `src/ui/system/` and ship with stories + tests so future panels
   inherit the look for free.
7. **No new dependencies.** axe-core is *already* a dev dep via
   `@axe-core/react` (used in `App.a11y.test.tsx`). Lighthouse CI
   is already wired (`npm run lhci`).
8. **Strict e2e safety contract carries over.** Zero churn on
   `role`, `aria-label`, `aria-expanded`, `data-finding-key`, or
   any `data-*` attribute the 7 Playwright specs touch. Part C
   wraps the existing panels in collapsibles — the panels
   themselves keep their accessibility tree intact.

## §2 Dependency graph

```
                   ┌─────────────────────┐
                   │  Wave-1 (parallel)  │
                   ├─────────────────────┤
        ┌──────────┤ A: span-bbox foun.  │
        │          │ B: DS primitives    ├─────────┐
        │          └─────────────────────┘         │
        ▼                                          ▼
┌───────────────────┐                  ┌────────────────────┐
│  E: viewer hi.    │                  │ Wave-2 (parallel)  │
│  (depends on A)   │                  ├────────────────────┤
└─────────┬─────────┘                  │ C: pane split      │
          │                            │ D: polish          │
          │                            │ (both depend on B) │
          │                            └─────────┬──────────┘
          │                                      │
          └────────────────┬─────────────────────┘
                           ▼
                ┌──────────────────────┐
                │  Wave-3 (serial)     │
                ├──────────────────────┤
                │ F: WCAG sweep        │
                │ (depends on C + D)   │
                └──────────────────────┘
```

## §3 Hard caps summary

| Part | Branch                              | New src | New tests | Modified src | Caps notes                                                                  |
|------|-------------------------------------|---------|-----------|--------------|------------------------------------------------------------------------------|
| A    | `wave28-A-span-bbox-foundation`     | ≤ 2     | ≤ 3       | ≤ 3          | Additive types only; **zero changes to viewer or UI**.                      |
| B    | `wave28-B-ds-primitives`            | ≤ 4     | ≤ 4       | ≤ 1          | Adds `SectionGroup`, `EmptyState`, focus-ring tokens. Stories required.     |
| C    | `wave28-C-pane-accordion`           | ≤ 2     | ≤ 2       | ≤ 2          | Wraps panels in `SectionGroup`; **no panel internals changed**. App.tsx +30 LoC max. |
| D    | `wave28-D-polish`                   | ≤ 1     | ≤ 4       | ≤ 6          | Severity table polish, FindingsPanel badge polish, empty states everywhere.  |
| E    | `wave28-E-span-bbox-viewer`         | ≤ 1     | ≤ 2       | ≤ 2          | Viewer overlay reads `paragraph.lines[]` when present.                       |
| F    | `wave28-F-wcag-sweep`               | 0       | ≤ 2       | ≤ 8          | `aria-*` attrs + role fixes only; one new axe test + one Lighthouse delta.   |

If a single part overflows its cap: ship what fits, roll the rest
to Wave 29 (standing pattern from Waves 21 / 26 / 27).

## §4 Pre-flight checks (run from repo root)

```bash
git fetch origin
git log origin/main --oneline -5
# Expect: 72940ea (wave27-C) at the top of main.

cd app
npm run typecheck && npm run lint && npm run test:coverage
# Expect: green; branch coverage at or above the docs/TESTING.md floor.

npm run check:budget && npm run check:csp
# Expect: precache delta within budget; no new external origins.

npx playwright test --reporter=line
# Expect: 6 passed + 1 skipped (hybrid-golden gated).

npm run storybook   # in another terminal — sanity-check on :6006
```

If any of the above is red, **STOP** and reconcile before
dispatching subagents. Caps assume a green base.

## §5 Part details

---

### Part A — Span-bbox parser foundation

**Branch:** `wave28-A-span-bbox-foundation`
**Worktree:** `worktrees/wave28-A`
**Owner:** subagent-A (Sonnet, fresh context)
**Cap:** ≤ 2 new src + ≤ 3 new tests + ≤ 3 modified src. Additive
types only. **Zero JSX changes, zero viewer changes.**

#### Files

- **Modify**: `app/src/parser/types.ts` — add `LineSpan` type +
  optional `lines?: LineSpan[]` on `Paragraph`.
- **Modify**: `app/src/parser/paragraphs.ts` — preserve per-line
  bboxes + char-offset ranges into the merged paragraph.
- **Modify**: `app/src/parser/parseLease.ts` — pass `lines` through
  in the structured-clone-safe shape.
- **Create**: `app/src/parser/lineSpans.ts` — pure helper
  `findLinesForSpan(lines, start, end): LineSpan[]` used by Part E.
- **Create**: `app/src/parser/lineSpans.test.ts` — exhaustive
  span-to-line mapping tests.
- **Modify (test)**: `app/src/parser/paragraphs.test.ts` — assert
  `lines[]` present + char offsets sum to paragraph length.

#### Type contract (locked here for Parts E and F)

```ts
// app/src/parser/types.ts
export interface LineSpan {
  /** char offset within the parent Paragraph.text where this line begins */
  start: number;
  /** char offset within the parent Paragraph.text where this line ends (exclusive) */
  end: number;
  /** PDF-page bbox in PDF user-space units (same coordinate system as Paragraph.bbox) */
  bbox: BoundingBox;
}

export interface Paragraph {
  page: number;
  text: string;
  bbox?: BoundingBox;
  /** Wave 28: per-line spans for span-level highlight. Optional — legacy
   *  paragraphs lack this and the viewer falls back to paragraph bbox. */
  lines?: LineSpan[];
}
```

#### TDD task list

- [ ] **A.1** Write failing test in `lineSpans.test.ts`:
  `findLinesForSpan` returns the single line containing a span
  fully within one line.
- [ ] **A.2** Write failing test: span crossing two lines returns
  both `LineSpan`s, in document order.
- [ ] **A.3** Write failing test: span fully outside any line
  returns `[]`.
- [ ] **A.4** Implement `findLinesForSpan` in `lineSpans.ts` —
  filter by `line.start < spanEnd && line.end > spanStart`.
- [ ] **A.5** Run `npm test -- lineSpans` → all 3 pass.
- [ ] **A.6** Add `LineSpan` + optional `lines?` to `types.ts`.
  Run `npm run typecheck` → green.
- [ ] **A.7** In `paragraphs.ts`, accumulate
  `lines: LineSpan[]` while merging lines into the paragraph.
  Track `runningOffset` from `text.length` before each
  `current.text += '\n' + line.text`.
- [ ] **A.8** Update existing `paragraphs.test.ts` — assert
  `paragraph.lines` defined on the synthesized fixtures and that
  `lines[lines.length-1].end === paragraph.text.length`.
- [ ] **A.9** Run `npm run typecheck && npm test` → green.
- [ ] **A.10** Confirm structured-clone safety: `LineSpan` is
  plain data (numbers + nested plain object); no need for a
  serializer. Run `App.panels.test.tsx` to confirm worker
  round-trip still passes.
- [ ] **A.11** Commit + push + open PR.

#### Verify

```bash
cd app
npm run typecheck && npm run lint
npm test -- parser
npm run test:coverage   # branch coverage must not regress
```

#### Out of scope (Part A)

- Viewer rendering of spans (Part E owns that).
- IDB migration of legacy persisted leases.
- Span-bbox-based finding deduplication.

---

### Part B — Design-system primitives (`SectionGroup`, `EmptyState`, focus-ring tokens)

**Branch:** `wave28-B-ds-primitives`
**Worktree:** `worktrees/wave28-B`
**Owner:** subagent-B (Sonnet, fresh context)
**Cap:** ≤ 4 new src + ≤ 4 new tests + ≤ 1 modified src.
Primitives ≥ 95% lines / ≥ 90% branches. Stories required.

#### Files

- **Create**: `app/src/ui/system/SectionGroup.tsx` — collapsible
  group container with header, count badge, expand/collapse
  affordance, and `defaultOpen` prop.
- **Create**: `app/src/ui/system/SectionGroup.test.tsx`
- **Create**: `app/src/ui/system/SectionGroup.stories.tsx`
- **Create**: `app/src/ui/system/EmptyState.tsx` — illustrated
  (icon-glyph) empty state with title + description + optional
  `action` slot.
- **Create**: `app/src/ui/system/EmptyState.test.tsx`
- **Create**: `app/src/ui/system/EmptyState.stories.tsx`
- **Modify**: `app/src/index.css` — add `--ring`, `--ring-offset`,
  `--state-hover`, `--state-active` tokens to the existing
  `@theme` block. Add `:focus-visible` ring utility class.

#### Component contracts (locked for Parts C, D, F)

```tsx
// SectionGroup.tsx
export interface SectionGroupProps {
  /** Heading shown in the group header. */
  title: string;
  /** Optional badge after the title (e.g., "8 leases", "3 pending"). */
  count?: number | string;
  /** Whether the group is open by default. State is in-memory only. */
  defaultOpen?: boolean;
  /** Visual density. "comfortable" (default) or "compact". */
  density?: 'comfortable' | 'compact';
  /** Stable id used for the disclosure region's aria controls. */
  id: string;
  children: React.ReactNode;
}

// EmptyState.tsx
export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Lucide-style glyph as inline SVG. We do NOT pull in lucide-react;
   *  pass the SVG element directly. */
  icon?: React.ReactNode;
  action?: React.ReactNode;
}
```

#### TDD task list

- [ ] **B.1** Write `SectionGroup.test.tsx` — renders title and
  children when `defaultOpen=true`; hides children when
  `defaultOpen=false`; clicking the disclosure toggles
  `aria-expanded`.
- [ ] **B.2** Write `SectionGroup` test for `count` rendering (both
  number and string variants).
- [ ] **B.3** Implement `SectionGroup.tsx` using a `<details>` /
  `<summary>` pair with a controlled override (so we can keep
  `aria-expanded` accurate). Use `Card` from Wave 27 for the shell.
- [ ] **B.4** Run `npm test -- SectionGroup` → green.
- [ ] **B.5** Write `EmptyState.test.tsx` — renders title;
  description optional; `action` rendered when provided.
- [ ] **B.6** Implement `EmptyState.tsx` — center-aligned, uses
  the muted-foreground token, icon sized 32 px.
- [ ] **B.7** Run `npm test -- EmptyState` → green.
- [ ] **B.8** Add `--ring`, `--ring-offset`, `--state-hover`,
  `--state-active` tokens to `index.css`. Add a `.focus-ring`
  utility:

  ```css
  @utility focus-ring {
    @apply outline-none ring-2 ring-[var(--ring)] ring-offset-2 ring-offset-[var(--ring-offset)];
  }
  ```
- [ ] **B.9** Add stories for both primitives. `SectionGroup`
  story shows: open + count, collapsed + no count, with
  `EmptyState` inside.
- [ ] **B.10** Run `npm run typecheck && npm run lint &&
  npm run test:coverage` → green; primitive coverage ≥ 95% lines.
- [ ] **B.11** Sanity-check in Storybook (`npm run storybook`).
- [ ] **B.12** Commit + push + open PR.

#### Out of scope (Part B)

- Wiring `SectionGroup` into `AppLibraryAndPacksPane` (Part C).
- Wiring `EmptyState` into individual panels (Part D).
- Dark-mode token variants (deferred per Wave 27 §1.5).

---

### Part C — Bottom-pane accordion layout

**Branch:** `wave28-C-pane-accordion`
**Worktree:** `worktrees/wave28-C`
**Owner:** subagent-C (Sonnet, fresh context)
**Depends on:** **B merged.** Pre-flight: `git log origin/main
..HEAD` must show B's commit in the base.
**Cap:** ≤ 2 new src + ≤ 2 new tests + ≤ 2 modified src.
**Zero panel-internal changes.** Wraps existing panels only.

#### Files

- **Create**: `app/src/ui/AppLibraryAndPacksPaneSections.ts` — pure
  configuration mapping each panel to one of three groups:
  `'this-lease' | 'library' | 'governance'`. Locks the grouping in
  one place so Part D can iterate without breaking Part C.
- **Modify**: `app/src/ui/AppLibraryAndPacksPane.tsx` — wrap the
  three groups in `SectionGroup`. Default-open: `this-lease`.
  Default-collapsed: `library`, `governance`. Pass each group's
  panel count via the `count` prop where meaningful.
- **Modify**: `app/src/ui/AppLibraryAndPacksPane.test.tsx` — add
  one assertion per group: `aria-expanded` reflects default state;
  clicking a header toggles it; child panels still mount when
  open.
- **Create**: `app/src/ui/AppLibraryAndPacksPane.accordion.test.tsx`
  — focused test covering the new grouping behavior. (Keeping it
  separate avoids clobbering the Wave 27 panel-render coverage.)

#### Group assignment (locked)

| Group        | Panels                                                                                                        |
|--------------|----------------------------------------------------------------------------------------------------------------|
| `this-lease` | `LeaseFactsPanel`, workflow / export controls inside `AppFooterControls`, `AnnotationsPanel` (if rendered here)|
| `library`    | `LibraryPanel` (My Leases), `TemplatesPanel`, `PackManagerPanel`, `BulkImportPanel`                            |
| `governance` | `JurisdictionPickerPanel`, `SeverityOverridesPanel`, `AuditLogPanel`, `SigningKeyPanel`                        |

#### TDD task list

- [ ] **C.1** Confirm B is in base: `git log --oneline | grep
  wave28-B-ds-primitives` → present.
- [ ] **C.2** Write failing test in `accordion.test.tsx`: the
  `library` group renders with `aria-expanded="false"` by default
  and its children are not in the DOM (or `hidden`).
- [ ] **C.3** Write failing test: clicking the `library` group
  header sets `aria-expanded="true"` and reveals
  `LibraryPanel` (asserted by `getByRole('heading', { name: /My
  Leases/ })`).
- [ ] **C.4** Implement: extract group config into the new
  `AppLibraryAndPacksPaneSections.ts`; in
  `AppLibraryAndPacksPane.tsx`, render three `<SectionGroup>`s
  (with stable `id` per group) wrapping the existing panel JSX.
- [ ] **C.5** Run `npm test -- AppLibraryAndPacksPane` → green.
- [ ] **C.6** Run `npx playwright test` → 6 passed + 1 skipped.
  **If any e2e fails**, that's a churn violation — revert and
  re-do without changing `data-*` attributes.
- [ ] **C.7** Update Storybook story for the pane (if present) to
  show the new grouping.
- [ ] **C.8** Run `npm run typecheck && npm run lint &&
  npm run test:coverage` → green.
- [ ] **C.9** Commit + push + open PR.

#### Out of scope (Part C)

- Persisting accordion state across reloads (deferred per §1.2).
- Restyling the panels themselves (Part D).
- Tab-bar deep-links to a specific group (Wave 29 candidate).

---

### Part D — Component polish (severity table, findings badge, empty states, hover/active)

**Branch:** `wave28-D-polish`
**Worktree:** `worktrees/wave28-D`
**Owner:** subagent-D (Sonnet, fresh context)
**Depends on:** **B merged.** Can run in parallel with C —
**ownership of files is disjoint** from C (D never touches
`AppLibraryAndPacksPane.tsx`, only the panel internals).
**Cap:** ≤ 1 new src + ≤ 4 new tests + ≤ 6 modified src.

#### Files (panel polish)

- **Modify**: `app/src/ui/SeverityOverridesPanel.tsx` — sticky
  table header (`<thead>` with `position: sticky; top: 0`), zebra
  rows via `:nth-child(even)`, severity-token-colored badges in
  the "Built-in" column, hover state.
- **Modify**: `app/src/ui/SeverityOverridesPanel.test.tsx` — one
  assertion: row count rendered; one a11y assertion: `<th
  scope="col">` present.
- **Modify**: `app/src/ui/FindingsPanel.tsx` — refine
  hybrid-finding badge (`finding-llm-badge`): use the new
  `--state-hover` token, add `aria-pressed` reflecting toggled
  state, ensure focus ring shows.
- **Modify**: `app/src/ui/FindingsPanel.deviation.test.tsx` (or
  add a sibling `.badge.test.tsx`) — assert `aria-pressed`
  toggles; assert focus ring class present after `tab`.
- **Modify**: `app/src/ui/LibraryPanel.tsx` — replace
  "No clause templates saved yet." plain-text empty state with
  `<EmptyState />`. Same for `JurisdictionPickerPanel` ("No
  jurisdictions selected — all rules run regardless of regional
  tags."). Same for `TemplatesPanel`.
- **Modify**: `app/src/ui/LibraryPanel.test.tsx` — assert
  `EmptyState` title/description present in the empty case.
- **Create**: `app/src/ui/__tests__/empty-states.test.tsx` —
  parameterized smoke test covering all three empty-state
  panels mount without errors.
- **Modify**: `app/src/ui/system/Button.tsx` — apply
  `--state-hover` and `--state-active` tokens to all variants.
  (Touching `Button.tsx` is in-cap and intentional — it cascades
  the polish to every clickable surface.)

#### TDD task list

- [ ] **D.1** Confirm B is in base (`SectionGroup` &
  `EmptyState` exist).
- [ ] **D.2** Write failing test: `LibraryPanel` empty case
  renders `EmptyState` title "No leases yet".
- [ ] **D.3** Implement `LibraryPanel` empty branch using
  `<EmptyState />`. Run test → green.
- [ ] **D.4** Repeat D.2/D.3 for `TemplatesPanel`,
  `JurisdictionPickerPanel`.
- [ ] **D.5** Write failing test: `SeverityOverridesPanel` table
  has `<th scope="col">` on every header cell.
- [ ] **D.6** Implement sticky / zebra / scope-col fix. Run →
  green.
- [ ] **D.7** Write failing test: hybrid finding badge sets
  `aria-pressed="true"` after click.
- [ ] **D.8** Implement badge polish in `FindingsPanel.tsx`. Run
  → green.
- [ ] **D.9** Modify `Button.tsx` to apply `--state-hover` /
  `--state-active`. Run existing Button tests → green
  (no behavioral change).
- [ ] **D.10** Run full suite: `npm run typecheck && npm run lint
  && npm run test:coverage`.
- [ ] **D.11** Run `npx playwright test` — must stay 6 + 1.
- [ ] **D.12** Update affected Storybook stories
  (`SeverityOverridesPanel`, `FindingsPanel`, `LibraryPanel`,
  `TemplatesPanel`, `JurisdictionPickerPanel`, `Button`).
- [ ] **D.13** Commit + push + open PR.

#### Out of scope (Part D)

- Restructuring the bottom pane (Part C).
- Span-bbox highlighting (Part E).
- Adding new audit kinds (locked per §1.4).

---

### Part E — Span-bbox viewer integration

**Branch:** `wave28-E-span-bbox-viewer`
**Worktree:** `worktrees/wave28-E`
**Owner:** subagent-E (Sonnet, fresh context)
**Depends on:** **A merged.** Pre-flight: `LineSpan` exported from
`app/src/parser/types.ts` and `findLinesForSpan` exported from
`app/src/parser/lineSpans.ts`.
**Cap:** ≤ 1 new src + ≤ 2 new tests + ≤ 2 modified src.

#### Files

- **Modify**: `app/src/ui/PdfViewer.tsx` (or whichever module
  owns the highlight overlay — confirm via `grep -l
  data-finding-key app/src/ui`) — when the active finding's
  paragraph has `lines: LineSpan[]`, project each `LineSpan.bbox`
  through the existing PDF→viewport transform and render one
  highlight rect per overlapping line; otherwise fall back to the
  paragraph bbox.
- **Create**: `app/src/ui/spanHighlight.ts` — pure helper
  `computeSpanRects(paragraph, finding, viewportTransform):
  Rect[]` that wraps `findLinesForSpan` and applies the
  transform. Pure to keep PdfViewer thin.
- **Create**: `app/src/ui/spanHighlight.test.ts` — unit tests
  for `computeSpanRects`: paragraph without `lines` returns
  whole-bbox rect; paragraph with `lines` and a
  one-line-spanning finding returns one rect; finding spanning
  three lines returns three rects.
- **Modify**: `app/src/ui/PdfViewer.test.tsx` — one integration
  assertion: rendering a paragraph with `lines` produces N
  `[data-span-highlight]` elements where N = number of
  overlapping lines.

#### Critical safety contract

The existing Playwright spec(s) hover an existing finding and
assert at least one highlight rect appears. **The fallback path
must keep that contract.** `PdfViewer.test.tsx` should also
include a regression test: paragraph without `lines` still
renders exactly one highlight rect (the paragraph bbox).

#### TDD task list

- [ ] **E.1** Confirm A is in base (`grep -r "LineSpan"
  app/src/parser/types.ts` → present).
- [ ] **E.2** Write failing test in `spanHighlight.test.ts`:
  paragraph without `lines` → `computeSpanRects` returns
  `[paragraphBbox]`.
- [ ] **E.3** Write failing test: paragraph with `lines` and a
  span fully inside one line → returns one rect matching that
  line's projected bbox.
- [ ] **E.4** Write failing test: paragraph with `lines` and a
  span across two lines → returns two rects.
- [ ] **E.5** Implement `spanHighlight.ts` using
  `findLinesForSpan` + the viewport transform helper exposed by
  pdf.js (`viewport.convertToViewportRectangle` or equivalent —
  confirm the existing call site in `PdfViewer.tsx`).
- [ ] **E.6** Wire into `PdfViewer.tsx` — replace the single
  rect render with a `.map(rect => …)`.
- [ ] **E.7** Add the `data-span-highlight` integration
  assertion in `PdfViewer.test.tsx`.
- [ ] **E.8** Run `npm test && npm run typecheck && npm run lint`
  → green.
- [ ] **E.9** Run `npx playwright test` — existing
  highlight-on-hover spec must stay green.
- [ ] **E.10** Sanity walk: `npm run dev`, upload the sample
  lease, hover a finding — confirm visually that the highlight
  is now line-tight, not paragraph-loose.
- [ ] **E.11** Commit + push + open PR.

#### Out of scope (Part E)

- Animating between paragraph and span highlights.
- Migrating already-persisted leases (re-parse on open is the
  migration path per §1.3).
- Span-level click handlers / context menus.

---

### Part F — WCAG 2.1 AA fix-as-found sweep

**Branch:** `wave28-F-wcag-sweep`
**Worktree:** `worktrees/wave28-F`
**Owner:** subagent-F (Sonnet, fresh context) — but this part
**runs serially after C and D merge**, not in parallel.
**Cap:** 0 new src + ≤ 2 new tests + ≤ 8 modified src.
`aria-*` / role / focus fixes only. **No JSX restructure.**

#### Pre-flight (mandatory before dispatching F)

```bash
git fetch origin && git log origin/main --oneline -10
# Expect: wave28-C and wave28-D commits both present in main.

cd app
npm run lhci   # capture baseline accessibility score
```

Save the Lighthouse report under `app/lighthouse-baseline.html`
(don't commit). Part F's PR description must show "before / after"
a11y scores.

#### Files

- **Modify (any of)**: `app/src/ui/AppHeader.tsx`,
  `app/src/ui/AppCurrentPane.tsx`,
  `app/src/ui/AppLibraryAndPacksPane.tsx`,
  `app/src/ui/system/SectionGroup.tsx`,
  `app/src/ui/system/Button.tsx`,
  `app/src/ui/FindingsPanel.tsx`,
  `app/src/ui/SeverityOverridesPanel.tsx`,
  `app/src/ui/AppRedlinePane.tsx`.
  Capped at ≤ 8 total. Touch only what the audit flags.
- **Create**: `app/src/ui/__tests__/accordion.a11y.test.tsx` —
  axe-core scan of the accordion in both expanded and collapsed
  states; expect zero violations.
- **Create**: `app/src/ui/__tests__/severity-table.a11y.test.tsx`
  — axe-core scan of `SeverityOverridesPanel`; expect zero
  violations.

#### Audit checklist

- [ ] **F.1** Tab through the entire app from the header. Focus
  order should follow visual order: header → tab bar → main pane
  → bottom pane (in group order). Note any breaks.
- [ ] **F.2** Verify `:focus-visible` ring (from Part B token)
  shows on every interactive element. Note any silent ones.
- [ ] **F.3** Run axe-core in jsdom against the accordion +
  severity table; capture violations.
- [ ] **F.4** Verify `aria-expanded` / `aria-controls` are
  correctly paired on every `SectionGroup` instance.
- [ ] **F.5** Verify the tab bar (`current` / `portfolio` /
  `redline`) uses `role="tablist"` + `role="tab"` +
  `aria-selected` correctly. (May already be wired from Wave
  27-B; if not, fix here.)
- [ ] **F.6** Color-contrast check: severity tokens
  (`error`/`warn`/`info`) against background must meet 4.5:1 for
  body text and 3:1 for UI controls. Use the Lighthouse report.
- [ ] **F.7** Tap-target check (mobile viewport): every
  clickable surface ≥ 44 × 44 CSS px. Note any violations.
- [ ] **F.8** Screen-reader walk (VoiceOver on macOS or NVDA on
  Windows): confirm the accordion announces "expanded" /
  "collapsed"; confirm the hybrid-finding badge announces its
  similarity %.
- [ ] **F.9** Apply fixes. Each fix is a separate commit so
  the PR is reviewable.
- [ ] **F.10** Re-run axe + Lighthouse. New a11y score must be
  **≥ 95** (the existing gate) and must not regress relative to
  baseline.
- [ ] **F.11** Run `npm run typecheck && npm run lint && npm
  run test:coverage && npx playwright test` → all green.
- [ ] **F.12** PR description must include before / after
  Lighthouse a11y scores + a 1-line summary per fix.

#### Out of scope (Part F)

- Full external WCAG 2.1 AA audit (still deferred per
  CLAUDE.md).
- New keyboard shortcuts.
- Reduced-motion token rollout (Wave 29 candidate).

---

## §6 Dispatch matrix (parallel subagent execution)

This wave is structured for **3 sequential dispatch rounds**, each
round running its parts in parallel. Rounds are gated on the
previous round's PRs being merged.

### Round 1 — Foundations (parallel; both required before Round 2)

| Track | Part | Branch                              | Worktree            | Owner       |
|-------|------|-------------------------------------|---------------------|-------------|
| 1     | A    | `wave28-A-span-bbox-foundation`     | `worktrees/wave28-A`| subagent-A  |
| 2     | B    | `wave28-B-ds-primitives`            | `worktrees/wave28-B`| subagent-B  |

**Dispatch command (orchestrator):**

```bash
# Verify base
git fetch origin
test "$(git rev-parse origin/main)" = "$(git rev-parse main)" \
  || { echo "main is not at origin/main — reconcile first"; exit 1; }
BASE_SHA=$(git rev-parse main)
echo "Round 1 base SHA: $BASE_SHA"

# Create worktrees (per global rule: inside project root)
git worktree add worktrees/wave28-A -b wave28-A-span-bbox-foundation main
git worktree add worktrees/wave28-B -b wave28-B-ds-primitives main
```

Subagent briefs (one per worktree) hand off the relevant Part §5
section, the file list, the cap, and the heartbeat contract
(`.claude/agent-status/<id>.log` every ~5 min).

**Round-1 gate:** both PRs merged + `git pull --ff-only` on `main`
shows both commits before proceeding.

### Round 2 — Layout, polish, viewer (parallel; all three independent in file-touch)

| Track | Part | Branch                              | Worktree            | Owner       |
|-------|------|-------------------------------------|---------------------|-------------|
| 1     | C    | `wave28-C-pane-accordion`           | `worktrees/wave28-C`| subagent-C  |
| 2     | D    | `wave28-D-polish`                   | `worktrees/wave28-D`| subagent-D  |
| 3     | E    | `wave28-E-span-bbox-viewer`         | `worktrees/wave28-E`| subagent-E  |

**File-touch overlap analysis (must be empty):**

| Pair  | Overlap                                    |
|-------|--------------------------------------------|
| C × D | None — C wraps; D edits panels.            |
| C × E | None — C in `AppLibraryAndPacksPane`; E in `PdfViewer`. |
| D × E | None — D in panels + Button; E in viewer.  |

**Dispatch command:**

```bash
git fetch origin && git pull --ff-only
git worktree add worktrees/wave28-C -b wave28-C-pane-accordion main
git worktree add worktrees/wave28-D -b wave28-D-polish main
git worktree add worktrees/wave28-E -b wave28-E-span-bbox-viewer main
```

**Round-2 gate:** C + D both merged before dispatching F. E can
merge any time after Round 1 — F does not depend on E.

### Round 3 — A11y sweep (serial; runs after C + D merge)

| Track | Part | Branch                              | Worktree            | Owner       |
|-------|------|-------------------------------------|---------------------|-------------|
| 1     | F    | `wave28-F-wcag-sweep`               | `worktrees/wave28-F`| subagent-F  |

```bash
git fetch origin && git pull --ff-only
git worktree add worktrees/wave28-F -b wave28-F-wcag-sweep main
```

### Subagent brief template (every dispatch must include)

```
You are subagent-<X> for Wave 28 Part <X>. Your worktree is
worktrees/wave28-<X>. Branch: <branch>.

Plan reference: docs/plans/wave28-design-pass-finish-and-a11y.md
§5 Part <X>. Read that section in full before touching code.

Heartbeat: append a timestamp + 1-line status to
.claude/agent-status/wave28-<X>.log every ~5 minutes (per
~/.claude/CLAUDE.md "Subagent Dispatch Rules" #3).

Hard caps: <copy from §3 row>.

File ownership: <copy from §5 Files block>. Do NOT touch any
other file.

Forbidden: git stash (per memory note), bypassing pre-commit
hooks, opening PRs while local tests are red, modifying any
file outside your ownership list.

When done: open PR with "wave28-<X>: <summary>" title; link to
the plan §5; attempt `gh pr merge --auto --squash` exactly
once; report PR URL + CI status.
```

### Failure-mode playbook

| Symptom                                | Action                                                              |
|----------------------------------------|---------------------------------------------------------------------|
| Subagent silent > 30 min               | Check heartbeat log; if stale, kill task, capture last status, re-dispatch fresh from Round-N base. |
| Subagent edits a file outside ownership| Reject the PR; instruct to revert and re-scope.                     |
| E2E spec breaks in C                   | Churn violation — must revert and redo without `data-*` changes.    |
| Cap overflow                           | Ship what fits in the cap; roll the rest to Wave 29.                |
| Round-N gate fails (PR didn't merge)   | Do **not** dispatch Round-N+1. Diagnose, fix, re-merge first.       |
| Codex adversarial-review escalates     | Run `codex-rescue` skill; do not auto-merge.                        |

## §7 Merge order (canonical)

1. **Plan PR** (this file) — squash-merge to `main`.
2. **Round 1**: A and B can merge in either order. Both must be in
   `main` before Round 2 dispatches.
3. **Round 2**: C, D, E can merge in any order. C and D must both
   be in `main` before Round 3 dispatches. E independent of F.
4. **Round 3**: F merges last.

After F merges:

- Update `docs/CLAUDE.md` to remove "Span-level highlight bbox
  computation" from the deferred-list (Part E ships it).
- Update `docs/TESTING.md` if branch coverage moved.
- Update `docs/BACKLOG.md` "In progress / Phase 8" row to
  ✅ shipped.

## §8 Out of scope (Wave 28 entire)

- Persisting accordion state across reloads (§1.2; Wave 29
  candidate).
- Tab-bar deep-links to a specific accordion group (Wave 29).
- Dark-mode token variants (still deferred per Wave 27 §1.5).
- Full external WCAG audit.
- Tauri desktop wrapper (still deferred).
- Pre-Wave-27 legacy CSS in `index.css` (handled in Wave 27).
- Phase 18 hybrid model improvements (separate workstream — Wave
  29 candidate).
- Cloud sync / accounts / telemetry.

## §9 Wave 29 preview (no commitments)

Likely candidates after Wave 28:

1. **Dark-mode tokens** (deferred from Wave 27).
2. **Phase 18 hybrid model coverage push** (`hybridAnalyze.ts`
   branch coverage + golden test re-enable).
3. **Tab-bar deep-links + accordion persistence** (the Wave 28
   §1.2 carve-out).
4. **Reduced-motion token rollout** (Wave 28 §F.F8 carve-out).
5. **`useMarketplaceCallbacks` hook consolidation** (still on the
   list from Wave 21 retrospective).

End of plan.

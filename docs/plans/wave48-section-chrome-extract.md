# Wave 48 — Section Chrome Extract: PanelHeader + Section Density

**Goal.** Land Slice 1 of the project-wide design-system extract inventory
(`docs/audits/extract-inventory-2026-04-29.md`): introduce a `PanelHeader`
primitive in `app/src/ui/system/` and extend the existing `Section`
primitive with a `density` prop that bakes the canonical
`px-4 py-4 space-y-{2|3|4}` recipe. Migrate ~30 panel files (25+ h2/h3
callsites + 18 Section padding callsites) to consume the new shape.
After this wave, every panel in the app reads its title and section
padding from the system, not from a hand-written class string — the
single most-copy-pasted Tailwind recipe in the repo collapses to two
primitives.

**Scope corresponds to:** inventory rows tagged Slice 1 — `PanelHeader`
component (25+ callsites) + `SectionShell` pattern (18 callsites,
absorbed into `Section` via density prop rather than a new primitive).

**Architecture.** Two changes in `app/src/ui/system/`:

1. **New: `app/src/ui/system/PanelHeader.tsx`** — a minimal primitive
   that renders the canonical `text-heading uppercase text-fg-muted`
   header. Props: `{ as?: 'h2'|'h3'; mb?: 0|1|3; children: ReactNode;
   className?: string }`. Default `as="h2"`, default `mb={3}`. The
   `className` slot composes; it does not override the canonical chrome
   tokens. Re-export from `app/src/ui/system/index.ts`.
2. **Extend: `app/src/ui/system/Section.tsx`** — add a `density` prop
   matching `SectionGroup`'s vocabulary: `'comfortable' | 'compact' |
   'flush'`. `comfortable` (default) sets `px-4 py-4 space-y-3`;
   `compact` sets `px-3 py-3 space-y-2`; `flush` sets `p-0 space-y-0`
   for callers that already control their own padding. The existing
   `label`/`aria-label` behavior stays unchanged (still not rendered).

Migrations are 1-2 line edits per panel: replace
`<h2 className="text-heading uppercase text-fg-muted mb-3">Title</h2>`
with `<PanelHeader>Title</PanelHeader>`, and replace
`<Section label="X" className="space-y-3 px-4 py-4">` with
`<Section label="X">` (default density absorbs the padding).

**Tech Stack.** React 18 + TypeScript strict, Tailwind v4, Vitest +
RTL, Storybook 8 CSF. No new dependencies.

**Base SHA.** `origin/main` after Wave 46 (program closeout) and Wave
47 (renter clarify-errors) merge. Verify
`git fetch origin && git log origin/main --oneline -10` includes both
`wave(46): program closeout` and `wave(47): renter clarify errors`
before branching. Wave 48 is independent of both content-wise but must
rebase cleanly.

**Prerequisites.** Waves 45 program (A/D/F/C/BE), 46, and 47 merged.
Wave 47 doesn't touch panel chrome; Wave 46 touches `SigningKeyPanel` +
`AppCurrentPane`'s ResultsHeader, which we'll need to thread through
the new `PanelHeader` carefully (those panels have h2/h3 callsites).

---

## §1 Hard rules

1. **One PR.** Whole wave on one feature branch `wave48-section-chrome-extract`.
2. **No new dependencies.** Reuse Tailwind v4 + existing tokens. No new tokens; the inventory confirmed token surface is clean.
3. **No visual regression.** Every migrated panel must render byte-identically to current main. CI gates: existing all-stories axe sweep (`src/ui/__tests__/all-stories.a11y.test.tsx`) + manual Storybook diff per migrated panel + the existing `no-side-stripe.policy.test.ts`.
4. **Heading semantics preserved.** Every `<h2>` callsite maps to `PanelHeader as="h2"` (default); every `<h3>` callsite maps to `PanelHeader as="h3"` explicitly. Run `axe-core` story-driven sweep — the heading-order check (already enforced post-Wave 41) must stay green.
5. **`PanelHeader` is chrome-only.** It MUST NOT accept severity / status / interactive props. Severity headers do not exist in this app. Section titles are calm; status lives in `<StatusMessage>` (deferred to Slice 3 / Wave 49+).
6. **`Section` density default = `comfortable`.** Existing callers that pass `className="space-y-3 px-4 py-4"` collapse to no className. Existing callers that pass an unrelated className (e.g. `className="bg-paper-sunken"`) keep their className; the density prop only affects the padding/stack tokens. Verify no className still contains `space-y-` or `px-` / `py-` literals after migration.
7. **Don't touch `SectionGroup`.** It already has the right vocabulary. The `density` prop on `Section` aligns with it; do not refactor `SectionGroup`.
8. **Wave 45-D / 45-BE / 46 / 47 strings immutable.** No header text changes. This is a structural rename only — the rendered string and aria-label semantics stay byte-identical.
9. **Local gate green** (`npm run typecheck && npm run lint && npm run test:coverage`) before push. Coverage on new `PanelHeader.tsx`: 100%.
10. **Codex adversarial gate.** Chrome refactors usually attract 0–1 minor findings (className-shape edge cases). Budget 1–2 passes.
11. **No `gh pr ready` while CI is red.** Per CLAUDE.md.

## §2 Out of scope

- **Slices 2 and 3 of the extract inventory.** Card density/surface variants (Slice 2) and StatusMessage + ConfirmDialog (Slice 3) are deferred to Wave 49 / 50. Slice 3's `ConfirmDialog` overlaps Wave 47's Dialog migration — re-scope after Wave 47 merges.
- **Folding `PanelHeader` into `Section` as a `title` slot.** The inventory recommends shipping `PanelHeader` as its own primitive first, then optionally letting `Section` accept it as a slot in a follow-up. This wave keeps them separate.
- **CustomRuleBuilder raw `<input>` migration to `Field`.** Cross-cutting observation in the inventory; that's a migration problem, not an extraction problem. Defer.
- **State-hover / state-active token promotion.** Marginal token-alias suggestion in the inventory; no functional gain. Defer.
- **EvidenceQuote / SeverityFilterChip / DiffSection extraction.** All sub-threshold per the inventory. Defer.
- **`<ComparePanel>` migration to PanelHeader's h3 callsites for Added/Removed/Changed.** That panel just landed in Wave 45-C with an explicit shape; touching it again would re-enter the Codex review loop and push three Added/Removed/Changed h3s into a primitive that hasn't been validated against ComparePanel's ARIA structure. Migrate in a follow-up wave only after PanelHeader is stable.

## §3 Files in scope

**Item A — New primitive:**
- New: `app/src/ui/system/PanelHeader.tsx`
- New: `app/src/ui/system/PanelHeader.test.tsx` (props + axe sweep)
- New: `app/src/ui/system/PanelHeader.stories.tsx` (h2 default, h3 variant, mb=0/1/3 variants)
- Modify: `app/src/ui/system/index.ts` (re-export)

**Item B — Section density extension:**
- Modify: `app/src/ui/system/Section.tsx` (add `density` prop)
- Modify: `app/src/ui/system/Section.test.tsx` (cover comfortable/compact/flush)
- Modify: `app/src/ui/system/Section.stories.tsx` (add three density stories)

**Item C — h2 callsite migrations (panel-level):**
- Modify: `TemplatesPanel.tsx:59`, `BulkImportPanel.tsx:61`, `SeverityOverridesPanel.tsx:72,93`, `AuditLogPanel.tsx:29`, `HybridPrecisionPanel.tsx:35,64`, `LibraryPanel.tsx:35,45`, `JurisdictionPickerPanel.tsx:50,61`, `AppLibraryAndPacksPane.tsx:196`, `RedlinePanel.tsx:83,114`, `SigningKeyPanel.tsx:50`, `PackManagerPanel.tsx:99`, `PortfolioPanel.tsx:103,113`
- Plus corresponding `*.test.tsx` siblings — most query by visible text, not by tag, so should stay green; verify per-file before batching.

**Item D — h3 callsite migrations (sub-section):**
- Modify: `LeaseFactsPanel.tsx:36,44`, `CounterOfferPanel.tsx:59,80`, `PortfolioRollupsPanel.tsx:28,36`, `AppCurrentPane.tsx:226`, `WorkflowPanel.tsx:37`, `TemplateMatchesPanel.tsx:26,33`, `AnnotationsPanel.tsx:39,66`
- Plus corresponding tests.

**Item E — Section padding-default migrations:**
- Modify the 18 callsites listed in inventory §"Pattern candidates → SectionShell" — each loses `space-y-{2|3|4} px-4 py-4` from its className (or migrates to `density="compact"` where the original used `space-y-2`).

**Item F — Documentation refresh:**
- Modify: `docs/audits/extract-inventory-2026-04-29.md` — add a "Slice 1 shipped — Wave 48" header note pointing at the merged PR; do not modify the candidate rows.
- Modify: `DESIGN.md` §5 Components — add a "Section Chrome" sub-section under Inputs/Fields with the `PanelHeader` + `Section density` recipes. Mention the canonical class string is now banned outside `system/`.
- Modify: `docs/CLAUDE.md` §"Adding a panel" — replace the implicit "h2 with these classes" guidance with "use `<PanelHeader>` from system/".
- Modify: `docs/BACKLOG.md` — add rows for the deferred items (Slices 2 and 3, ComparePanel h3 migration, EvidenceQuote re-evaluation post-Wave-47).

## §4 Item ordering

1. **A first.** Ship `PanelHeader` with full test + story + axe coverage. Independent.
2. **B parallel with A.** `Section` density extension — independent file.
3. **C, D, E in batches.** Migrate by directory cluster to keep diffs reviewable: pane shells (A* panels) first, then practitioner panels (Marketplace/PackManager/Portfolio/Redline), then renter panels (Library/Templates/Annotations/CounterOffer/etc.), then the small ones.
4. **F last.** Doc/backlog refresh after code is green.

## §5 Storybook

- `PanelHeader.stories.tsx`: `Default` (h2, mb=3), `H3Variant` (h3, mb=1), `MbZero`, `LongTitle` (truncation behavior), `WithSecondaryActionRowSibling` (composition example).
- `Section.stories.tsx`: add `Comfortable`, `Compact`, `Flush` stories alongside the existing label/aria stories.
- The all-stories axe sweep picks them up automatically.

## §6 Verification gates

1. **Inventory cross-check.** Every Slice 1 row in the extract inventory either migrates in this PR or is explicitly listed in §2 Out of scope.
2. **Class-string ban.** A repo-grep policy test (`app/src/test/panel-chrome-extract.policy.test.ts`) asserts that `text-heading uppercase text-fg-muted` does NOT appear in any `app/src/ui/*.tsx` outside `app/src/ui/system/`. Same test bans `space-y-3 px-4 py-4` (and the `space-y-2`/`space-y-4` variants) on `<Section>` elements outside `system/`.
3. **Visual parity.** Storybook for each migrated panel renders identically to pre-migration (manual diff acceptable; no automated visual regression in this repo, but eyeball confirm before merge).
4. **A11y gate.** `src/ui/__tests__/all-stories.a11y.test.tsx` green. Heading-order check unchanged. `npx playwright test tests/e2e/a11y.spec.ts` green.
5. **Coverage.** `PanelHeader.tsx` 100% branch; `Section.tsx` density branches covered.
6. **Local gate.** `npm run typecheck && npm run lint && npm run test:coverage` green; coverage floor unchanged.

## §7 Risks and mitigations

- **Default-density absorbs the wrong padding for one or two callers.** Mitigation: §6 #2 grep test fails loud if a `<Section>` still carries `px-/py-/space-y-` literals. Per-callsite review during migration.
- **`mb` prop interferes with caller's flow gap.** Some callers wrap the header in a flex column with its own `gap-3`. Mitigation: default `mb={3}` matches today's most common pattern; callers that want zero set `mb={0}`. Document in the story.
- **Heading-rank ambiguity in `Pane` wrappers that already promote.** Mitigation: every callsite explicitly passes `as="h2"|"h3"` per the inventory's existing mapping; do not infer from context.
- **ComparePanel is intentionally excluded** — re-flagging it would re-enter Codex's review loop. Mitigation: §2 lists it as out of scope; backlog row tracks the follow-up.
- **Wave 46 / Wave 47 rebase conflicts.** Both touch a few of the migrated files. Mitigation: rebase Wave 48 onto post-46-and-47 main; cherry-pick conflicts will be limited to the specific h2/Section lines those waves touched (e.g. SigningKeyPanel header survives Wave 46's Dialog edits, AppCurrentPane sub-component shape survives Wave 47).

## §8 Success definition

- Two primitives shipped: `PanelHeader` and `Section` density extension.
- Zero panels in `app/src/ui/*.tsx` carry the canonical `text-heading uppercase text-fg-muted` class string outside `system/`.
- Zero `<Section>` callers carry `space-y-{2|3|4} px-4 py-4` literals outside `system/`.
- All-stories axe sweep + Lighthouse + Playwright a11y all green.
- DESIGN.md §5 documents the new chrome recipe.
- One follow-up backlog row each for Slice 2, Slice 3, ComparePanel migration, EvidenceQuote re-eval.

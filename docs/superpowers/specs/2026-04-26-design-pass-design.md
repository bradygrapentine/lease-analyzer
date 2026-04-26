# Design pass — Wave 27

**Status:** Approved scope. Awaiting implementation plan (will live at
`docs/plans/wave27-design-pass.md` once written by the
`superpowers:writing-plans` skill).

**Goal:** introduce a design-system substrate (Tailwind v4 + a small
set of hand-built primitives + a token palette) and apply it to the
entire LeaseGuard app. The substrate is the structural fix; the
visual direction (editorial / legal-pad) is what the substrate is
tuned for. The wave is intentionally narrow — substrate + tokens +
visual refresh, no new product features, no new audit kinds, no new
deps beyond Tailwind and one self-hosted serif.

## Summary of decisions

| Decision | Choice | Why |
|---|---|---|
| Substrate | Tailwind v4 + 5 hand-built primitives | Tokens + utility classes without shadcn's generic look; smaller surface area than a component library; fewer e2e selector risks. |
| Scope | Full app polish (~20 components) | Visual coherence stops at no panel boundary. Cap enforced via 3-part wave structure. |
| Visual direction | A — Editorial / legal-pad | Distinctive against the shadcn-default look most local-first tools converge on; signals "this is about reading carefully." |
| Dark mode | Deferred to a follow-up wave | Editorial direction needs deliberate dark-mode tokens; ship light-only properly rather than naive sepia inversion. Drop the misleading `color-scheme: light dark` declaration as part of Part A. |
| Font | Self-hosted Source Serif 4 (regular + semibold), Latin subset, ~80 KB | Calibrated for screen reading at body sizes; OFL-licensed (NOTICE entry, mirrors `SECURITY.md` §5 Tesseract precedent); CSP `font-src 'self'` clean. |
| e2e safety | Zero churn on `role` / `aria-label` / `aria-expanded` / `data-finding-key` / `data-*` | The 7 Playwright specs select on these. Refactor is class + DOM-wrapping only. |

## Architecture

**Tailwind v4 with `@theme` directive in CSS.** Single source of truth for tokens (`src/index.css`). The `@tailwindcss/vite` plugin replaces the current PostCSS-free setup; no `tailwind.config.ts` file (v4 is CSS-first).

**Storybook 8 stays.** A new `Tokens` story documents the substrate. Each primitive ships with its own story.

**Substrate isolation.** Tokens + primitives live in `src/ui/system/`. Existing `src/ui/*.tsx` components import primitives from `./system/` and rewrite their JSX bodies to use Tailwind utilities. Component file structure does NOT change; only file contents.

**Legacy CSS scoping.** The existing 91-line `src/index.css` shrinks to ~15 lines (resets + the PDF viewer's required positioning). The PDF-viewer-specific cascade gets explicitly scoped under a `.pdf-viewer-legacy` class so it can't bleed into the new utilities.

## Five primitives

All in `src/ui/system/`. Each forwards `aria-*` and `data-*` props verbatim — non-negotiable for e2e safety.

| Primitive | Variants | Approximate consumers |
|---|---|---|
| `<Button>` | `default` / `ghost` / `subtle`; sizes `sm` / `md`; `pressed` boolean for filter pills | 80–100 sites: severity filters, "Edit", "Apply suggestion", "What this means", view-mode toggles |
| `<Card>` | `default` / `accent={severity}` (renders left-edge severity bar from direction A) | 30–40 sites: finding rows, SelectedFinding article, AnnotationsPanel notes, library rows, audit-log rows |
| `<Badge>` | `severity={'high'\|'medium'\|'low'\|'info'}` / `outline` / `mono` | 15–20 sites: severity counts in headings, hybrid-LLM badge, pack signature status, jurisdiction tags |
| `<Section>` | `aria-label` (required); optional `collapsible` (renders the existing button-with-aria-expanded pattern) | 18 sites — one per existing landmark region |
| `<Field>` | `as={'input'\|'textarea'\|'select'}`; `label` (required); `description` slot | 10–15 sites: search box, "new note" textarea, "override severity" select |

**Explicit non-primitives** (and why):

- No bare `<Input>` separate from `<Field>` — every input in this app belongs in a labeled form context. Bare unlabeled inputs are an a11y bug; we don't make one easy to write.
- No `<Modal>` / `<Dialog>` — the only dialog (onboarding tour) stays its own component.
- No `<Toast>` — existing `status` regions (aria-live polite) are sufficient.
- No `<Tooltip>` — existing `title=` attributes work.

## Tokens

All defined under `@theme` in `src/index.css` and exposed as Tailwind utilities (`bg-paper`, `text-fg-muted`, `border-rule`, etc.) AND as raw CSS custom properties for non-Tailwind code paths (the PDF viewer overlay).

**Color (16 tokens)** — extracted from direction A:

```
Surfaces        --color-paper:        #faf6ee  (page background, warm cream)
                --color-paper-raised: #ffffff  (cards)
                --color-paper-sunken: #f3eddc  (header strip, audit-log alt rows)
Text            --color-fg:           #2a2316  (headings — warm near-black)
                --color-fg-body:      #4a3f25  (body)
                --color-fg-muted:     #7a6f57  (labels, page numbers)
                --color-fg-faint:     #a59a7e  (placeholder)
Rules / lines   --color-rule:         #d6cdb6  (default border)
                --color-rule-subtle:  #e8e0cf  (low-emphasis divider)
Accent (single) --color-ink:          #1f3a4d  (interactive — links, focus ring, primary button)
Severity        --color-severity-high:    #b1442d  (terracotta — distinct from emergency red)
                --color-severity-medium:  #b8862c  (mustard)
                --color-severity-low:     #5a7a5a  (sage)
                --color-severity-info:    #6b7b8c  (slate)
Status          --color-positive: #4a7a4a, --color-negative: #9a3022
```

WCAG AA verified per pair (≥ 4.5:1 contrast on text). Severity is reinforced by the existing aria-labels — color is never the sole signal.

**Typography**:

- Headings + display: `'Source Serif 4', 'Iowan Old Style', Georgia, serif` (self-hosted, 2 weights).
- Body + UI chrome: `ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`.
- Snippets, audit payloads, mono labels: `'JetBrains Mono', ui-monospace, Menlo, monospace`.
- Scale (5 sizes): `text-display` (28/32 serif) · `text-heading` (15/22 sans uppercase 600 — small-caps section heads) · `text-body` (14/22 sans) · `text-small` (12.5/18 sans) · `text-mono` (12/18 mono).

**Spacing**: 8-stop scale on a 4 px base — `1, 2, 3, 4, 6, 8, 12, 16` mapped to `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64` px. Tailwind defaults; no custom additions.

**Radius**: three values — `rounded-none` (default; editorial wants sharp), `rounded-sm` (2 px — cards), `rounded` (4 px — inputs, badges). No more.

**Shadow**: one — `shadow-paper` (`0 1px 0 rgba(42,35,22,.05)`). Editorial doesn't want elevation theatrics.

## Wave structure (3 parts)

Strict merge order: A → B → C. B and C depend on A's primitives. Each part's verification gate runs all 6 active Playwright specs (the gated `hybrid-golden` stays gated), `vitest-axe`, and the coverage floor.

### Part A — Substrate, tokens, primitives

**Cap:** ≤ 8 new files + ≤ 4 modified files. **Zero changes to component JSX.** The app looks identical after Part A merges.

| Adds / Modifies | Path |
|---|---|
| Tailwind v4 + `@tailwindcss/vite` plugin | `app/package.json`, `app/vite.config.ts` |
| Token + reset CSS rewrite (drops `color-scheme: light dark`) | `app/src/index.css` |
| Self-hosted Source Serif 4 (400 + 600 weights) | `app/public/fonts/source-serif-4-{400,600}.woff2` + `@font-face` in `index.css` |
| NOTICE update for OFL font (Apache-2.0 §4(d) pattern) | `app/public/NOTICE` |
| 5 primitives | `app/src/ui/system/{Button,Card,Badge,Section,Field}.tsx` |
| Primitive tests | `app/src/ui/system/{Button,Card,Badge,Section,Field}.test.tsx` |
| Storybook tokens page | `app/src/ui/system/Tokens.stories.tsx` |
| Storybook stories per primitive | `app/src/ui/system/{Button,Card,Badge,Section,Field}.stories.tsx` |
| CSP `font-src 'self'` made explicit | `app/index.html` |

**Verify:** primitives at ≥ 95% lines / ≥ 90% branches; `vitest-axe` clean on every story; `npm run check:budget` confirms precache delta logged in commit body; `npm run check:csp` confirms `font-src 'self'`.

### Part B — Primary analyzed view

**Cap:** ≤ 8 src component files + matching test/story updates. **Zero churn** on `role` / `aria-label` / `aria-expanded` / `data-finding-key` / `data-*`.

Components: `AppHeader`, `FindingsPanel`, `AppCurrentPane` (the SelectedFinding article inside it), `AnnotationsPanel`, `CounterOfferPanel`, `TemplateMatchesPanel`, `LeaseFactsPanel`, the workflow aside.

**Verify:** all 6 active e2e specs green; vitest 1217+ tests still green; branch coverage ≥ 89; per-component visual review via Storybook headed.

### Part C — Bottom pane + alternate views

**Cap:** ≤ 12 src component files + matching test/story updates.

Components: `LibraryPanel`, the `TemplatesPanel` clause-templates form (inside `AppLibraryAndPacksPane`), `PackManagerPanel`, `DiffRulePackPanel`, `JurisdictionPickerPanel`, `SeverityOverridesPanel`, `BulkImportPanel`, `AuditLogPanel`, `SigningKeyPanel`, `AppFooterControls`, `PortfolioPane`, `RedlinePane`.

**Verify:** same gates as Part B, plus particular attention to the
`save-and-library` and `redline-flow` specs which exercise Part C
surfaces. Final commit notes a visual delta — one screenshot per
major surface, committed to
`docs/superpowers/specs/2026-04-26-design-pass-screenshots/` for the
historical record.

## Risk register

| Risk | Mitigation | Detected by |
|---|---|---|
| e2e selector breakage | Primitive contract: forward `aria-*` and `data-*` verbatim. Part B/C diff-checks every component for removed/changed semantic attrs. | Annotation-flow is the canary (depends on `data-finding-key`, `section[aria-label="annotations"]`, `form[aria-label="add note"]`, `textarea[aria-label="new note"]`). All 6 active specs run at end of every part. |
| Storybook 8 + Tailwind v4 compat | Part A pre-flight: install both, smoke-test the Tokens page. If incompatible, fall back to Tailwind v3.4 (same tokens via `tailwind.config.ts`). Decision logged in commit body. | Part A's Storybook smoke. |
| Bundle / precache budget | Net delta ~95 KB (Tailwind ~10 KB + Source Serif 4 ~80 KB + primitives ~5 KB). Current precache ~30 MiB after Phase 18; budget cap 30 MiB enforced via `check:budget`. | `npm run check:budget` after Part A. |
| CSP regression | Make `font-src 'self'` explicit in the meta CSP at Part A. | `npm run check:csp`. |
| CSS specificity during transition | Tailwind v4 layers (`@layer base/components/utilities`) keep precedence ordered. Legacy PDF-viewer cascade scoped under `.pdf-viewer-legacy`. | Per-part visual review via Storybook + headed Playwright. |
| Coverage floor | Primitives tested for every variant, axe clean, prop forwarding. Target ≥ 95% lines / ≥ 90% branches per primitive. | `npm run test:coverage` after every part; floor 89 stays. |
| `vitest-axe` regressions | Tokens chosen with WCAG AA contrast verified at design time. | Existing a11y sweep (`vitest run src/**/*.test.tsx`). |

## Out of scope (explicit acknowledgments)

- Dark mode — deferred (separate wave).
- Mobile breakpoint redesign — current responsive split-pane survives untouched.
- Iconography — the app uses zero icons today (text labels everywhere). Adding icons is its own design problem.
- Animations / transitions — one focus-ring transition is the only motion this wave introduces.
- Landing / marketing surfaces — none exist in this app.

## Implementation note

The chrome-devtools MCP server disconnected during the brainstorming
session. The original plan called for a screenshot loop via that MCP;
this design doesn't depend on it. Visual review during implementation
is via:

1. **Storybook** for primitive + per-component review (`npm run storybook`).
2. **`npx playwright test --headed`** for end-to-end visual checks at the close of each part.

If the MCP comes back, screenshot loops can supplement; they aren't required.

# Wave 53 — Design fidelity to the handoff

**Goal.** Bring production as close as possible to the Claude Design
handoff in `docs/design_handoff_leaseguard/`. Wave 51 landed the
Marginalia IA (reader + rail + footnote modal). Wave 52 polished
typography rhythm. This wave closes the remaining structural and
component-level gaps so a side-by-side compare of the production UI
and the handoff HTML reads as the same product.

**Constraint.** Several Wave 51/52 components already exist
(MarginaliaReader, FindingRail, FindingDetailModal, ReaderPdfToggle,
SeverityBadge). This wave does NOT rewrite them. It changes the
shell (header, layout, tabs), promotes Audit to a peer view, fills
in token gaps, and rebuilds the surfaces that never matched the
handoff (Portfolio cards, Redline diff).

**Base SHA.** `origin/main` after #202 (Current pane grid overflow
fix) merges. Verify before branching.

## §1 Hard rules

1. **One PR per part, sequenced.** Part A first (tokens / fonts);
   Part B second (shell + layout shift). Parts C-E parallel-mergeable
   after B. Part F is closeout.
2. **No regressions on aria inventory.** Existing test selectors
   (`aria-label="findings"`, `aria-label="audit log"`,
   `aria-label="portfolio"`, etc.) survive verbatim.
3. **No new packages.** Reuse existing primitives. Source Serif 4 is
   self-hosted; if the woff2 needs replacing it stays self-hosted.
4. **Local gate green** (`typecheck && lint && test`) before push,
   every part. Coverage floor stays at 96/90/93/96.
5. **Browser walk before push** with the dev server, especially for
   Parts B and D (shell shifts and IA changes are easy to miss in
   unit tests).
6. **No Codex gate.** Pure visual / IA work.
7. **Don't re-introduce side-stripes.** Handoff styles.css uses
   `border-left: 0` explicitly on `.sev-row-high` to make this
   point. Production's no-side-stripe policy test stays green.
8. **Tweaks panel out of scope.** The handoff's `tweaks-panel.jsx`
   is a Claude Design live-preview artifact. We adopt the *outputs*
   of tweaks (density tokens, theme variants) but ship no live tweak
   UI.

## §2 Out of scope

- **Multi-theme variants** (`linen` / `sage` / `slate`). The handoff
  ships them via `[data-theme=...]`. Production has dark mode only.
  Defer to a future wave; theme system is dependent on a settings UI
  redesign.
- **Tweaks live preview panel.** Per §1.8.
- **Serif family swap** (`literata` / `garamond` / `newsreader`).
  Single-serif is enough; ship the missing Source Serif 4 fix in
  Part A and stop there.
- **`.audit-row` `100px 90px 1fr 110px` exact grid** — production
  audit table is already 4-col; we restyle in Part D to look like
  the handoff but keep the existing `<table>` semantics for screen
  readers. (Handoff uses `<div class="audit-row">` — a regression on
  a11y.)

## §3 Plan body — Part A (Tokens + font fix)

**Files touched:**

- `app/src/index.css` — add `--ink-90` (`#233f54`), `--highlight`
  (default amber), `--para-pad` (12px), `--line-h` (1.65). Verify
  every other handoff token is already present (most are, post
  Wave 28 — spot check).
- `app/public/fonts/source-serif-4-{400,600}.woff2` — re-source from
  the upstream Source Serif 4 release. Current files fail with
  `OTS parsing error: invalid sfntVersion: 1008821359` (caught
  during Wave 52 live-mode walkthrough). Body type is silently
  falling back to Iowan Old Style / Georgia. Without this every
  typeset judgement Wave 51/52 made is rendered through a fallback.
- `app/scripts/check-fonts.mjs` (NEW) — small validator that asserts
  each woff2 starts with the wOF2 magic and parses; runs in
  `npm run verify` so this regression can't recur silently.

**Verify:**

- `npm run dev` + browser DevTools Network tab: woff2s download with
  no `OTS parsing error` console warning.
- `npm run check:fonts` exits 0.

## §4 Plan body — Part B (Shell + layout shift)

**Files touched:**

- `app/src/ui/AppHeader.tsx` — rebuild to handoff spec:
  - Fixed 52px height, `position: sticky; top: 0`,
    `bg-paper-raised` with `border-b border-rule`.
  - Wordmark = inline SVG book-and-arrow glyph + "LeaseGuard" serif
    16px 600 weight (replaces current text-only wordmark).
  - When analyzed: italic filename pill (truncated, ellipsis) + 1px
    vertical rule separator + segmented tab control + offline dot +
    "New lease" ghost button on the right.
  - Tab list = 4 tabs: **Current / Portfolio / Redline / Audit**.
    "Settings" demoted from a tab to a footer link / `kbd`-shortcut.
- `app/src/App.tsx` — `AppViewMode` adds `'audit'`, drops
  `'settings'` (Settings becomes a footer-link route).
- `app/src/ui/AppCurrentPane.tsx` — main goes fixed-viewport flex
  (`position: fixed; inset: 52px 0 0 0`). Three flex children:
  FindingRail | document column (Reader/PDF) | FindingsPanel.
  THIS LEASE / LIBRARY / GOVERNANCE accordions disappear from
  Current.
- `app/src/ui/AppSettingsPane.tsx` — absorbs the GOVERNANCE
  accordion contents (signing key, jurisdictions, severity overrides,
  diff rule pack, bulk import) and the LIBRARY accordion (My Leases,
  Clause Templates, Rule Packs). Sectioned, scrollable, no
  accordion shells (per handoff: governance lives in Settings, not
  on Current).
- `app/src/ui/AppFooter.tsx` (or extend existing) — adds a one-line
  footer with About / Privacy / Settings link routing.
- `app/src/ui/Section.tsx` / `SectionGroup.tsx` — usage drops on
  Current; both still used elsewhere.
- `tests/e2e/golden.spec.ts` — update tab-bar selectors if they
  asserted "Settings" tab presence.

**Verify:**

- `npm run test -- AppHeader App.panels` — green.
- Browser walk: cold load → upload sample → analyzed view shows the
  3-pane layout (rail | doc | findings) viewport-filling. Click
  Audit tab → audit log fills viewport. Click Settings link →
  Settings pane shows pack manager + governance + library.

## §5 Plan body — Part C (Severity icon family)

**Files touched:**

- `app/src/ui/system/Badge.tsx` (or new `SeverityIcon.tsx`) — port
  the handoff's per-severity SVGs:
  - **High:** triangle warn (`<path d="M8 2 L14.5 13.5 H1.5 Z" …>`)
  - **Medium:** diamond with center dot
  - **Low:** circle
  - **Info:** square
- `app/src/ui/system/Badge.tsx` — render the matching glyph
  alongside the label. Stroke uses `currentColor` so the badge tint
  drives icon color (already set up).
- Story / a11y test updates so the axe sweep still passes (icons are
  `aria-hidden`, label carries the meaning).

**Verify:**

- `npm run test -- Badge.test.tsx` — green.
- Storybook: every severity story shows distinct glyph + label.
- axe story sweep: no new violations.

## §6 Plan body — Part D (Audit view + Redline diff)

**Two independent surfaces, one PR — both touch viewport-filling
panes that didn't exist as top-level views before Part B.**

### Audit (top-level view)

- `app/src/ui/AppAuditPane.tsx` (NEW) — wraps the existing
  `AuditLogPanel` in a fixed-viewport container, adds the handoff's
  ribbon at the top (entries count, chain head fingerprint, last
  verification timestamp). Replaces the GOVERNANCE-accordion mount.
- `AuditLogPanel.tsx` — restyle each row to read like the handoff:
  serif italic for the verb's "object" (file name / rule id),
  mono for ts and seq. Keep the `<table>` semantics (per §2).

### Redline diff (real strike + add)

- `app/src/ui/RedlinePanel.tsx` — when an edit exists for a
  paragraph, render side-by-side: original text with `.diff-strike`
  on the changed substring, edited version with `.diff-add` on the
  replacement. Today the panel just line-throughs the whole
  paragraph and shows the new text below; the handoff does word-
  level diff. Use a small diff helper (e.g. `diff` npm package — or
  write a 30-line one against the handoff's substring approach so
  no new dep ships).
- `app/src/ui/AppRedlinePane.tsx` — add the apply-all / clear-all
  controls in the header strip the handoff specifies (Wave 51-F
  shipped the header but not these controls; the data wiring
  requires findings-with-suggested-edits state, which the redline
  store has).

**Verify:**

- `npm run test -- AppAuditPane RedlinePanel AppRedlinePane` — green.
- e2e: redline-flow.spec.ts still passes (aria inventory preserved).
- Browser walk: edit a paragraph → see strike on the changed phrase,
  add on the new phrase, side-by-side.

## §7 Plan body — Part E (Portfolio thumbnails)

**Files touched:**

- `app/src/ui/PortfolioPanel.tsx` — add a card-grid view alongside
  the existing matrix. Each card = address (or filename) as serif
  title, status sev-badge top-left, parsed-at mono caption top-right,
  rent / term / city in italic serif body, severity heatmap row at
  the bottom (one cell per finding, max-severity-colored), totals
  inline (`3 high`, `2 med`).
- A toggle ("Cards" / "Matrix") in the panel header lets practitioners
  fall back to the dense matrix when they need it.
- Wire to `findingsByLease` map already passed in.

**Verify:**

- `npm run test -- PortfolioPanel` — green.
- Browser walk: Portfolio tab shows cards by default; toggle to
  matrix reveals the current matrix view; click a card opens the
  lease in Current.

## §8 Plan body — Part F (Closeout)

- [x] All PRs merged: #204 (A), #205 (B-1), #206 (B-2), #207 (B-3a),
      #208 (B-3b), #209 (C), #210 (D), #211 (CI flake fix), #212 (E),
      #213 (D audit ribbon), #214 (D redline bulk).
- [x] Lighthouse a11y still ≥ 0.95 (last green run on each PR).
- [x] axe story sweep still 0 serious / critical (158 stories swept
      via `src/ui/__tests__/all-stories.a11y.test.tsx`, green).
- [x] DESIGN.md §5 grows entries for severity glyph family
      (`Badge.tsx :: SeverityIcon`), Redline Diff (`.diff-strike` /
      `.diff-add`), Viewport-Fill Current Layout
      (`main:has(.results)`), and the Audit Chain Ribbon. Navigation
      and Sections & Section Groups entries updated for the
      segmented-tab control and Settings-gated accordions.
- [x] BACKLOG: `source-serif-4-400.woff2` decode promoted to shipped
      (Wave 53-A). Native file-chooser leak, Wave 48 Slice 2 audit
      vocabulary, and CSP frame-ancestors stay open — not in this
      wave's scope.
- [x] Memory entry `feedback_handoff_fidelity_complete.md` saved;
      MEMORY.md index updated.

## §9 Risks

- **Layout shift in Part B** breaks every e2e spec that scrolls the
  page (analyze flow scrolls past `THIS LEASE` accordion). Audit the
  e2e suite before pushing Part B.
- **Source Serif 4 swap in Part A** changes line metrics. Wave 52
  paragraph leading (1.7) was tuned against Iowan Old Style /
  Georgia by accident. Re-tune `MarginaliaReader` body leading after
  the real font lands.
- **`audit` view promotion** breaks any selector that asserted
  `Settings` tab presence (golden.spec.ts likely). Check before
  pushing Part B.
- **Diff helper in Part D** could pull in a 5KB dep if we use the
  `diff` package. Prefer a 30-line LCS or a substring-based helper
  matching the handoff's `applyRedline()` shape.

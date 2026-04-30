---
name: LeaseGuard
description: Local-first lease analyzer; cream paper, ink rules, severity in the margins.
colors:
  paper: "#faf6ee"
  paper-raised: "#fdfcf8"
  paper-sunken: "#f3eddc"
  fg: "#2a2316"
  fg-body: "#4a3f25"
  fg-muted: "#7a6f57"
  fg-faint: "#a59a7e"
  rule: "#d6cdb6"
  rule-subtle: "#e8e0cf"
  ink: "#1f3a4d"
  severity-high: "#b1442d"
  severity-medium: "#b8862c"
  severity-low: "#5a7a5a"
  severity-info: "#6b7b8c"
  positive: "#4a7a4a"
  negative: "#9a3022"
  ring: "#b8862c"
typography:
  display:
    fontFamily: "Source Serif 4, Iowan Old Style, Georgia, serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "32px"
    letterSpacing: "normal"
  heading:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "22px"
    letterSpacing: "normal"
  body:
    fontFamily: "Source Serif 4, Iowan Old Style, Georgia, serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "22px"
    letterSpacing: "normal"
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: "18px"
    letterSpacing: "0.01em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "18px"
    letterSpacing: "normal"
rounded:
  sm: "2px"
  md: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-default:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.fg-body}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
  button-subtle:
    backgroundColor: "{colors.paper-sunken}"
    textColor: "{colors.fg-body}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
  button-default-sm:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "32px"
  card:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.fg-body}"
    rounded: "{rounded.sm}"
    padding: "16px"
  input:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.fg}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
    height: "32px"
---

# Design System: LeaseGuard

## 1. Overview

**Creative North Star: "The Marginalia Edition"**

The lease is the primary text. Findings, redlines, and counter-offers are
careful annotations in the margin, written by someone who has read the
document slowly and twice. The interface borrows from a lawyer's working
copy: cream paper, hairline rules, a single ink color, and severity that
shows up where a reader would actually mark it, never as decoration.

The system is restrained on purpose. Only one accent (Court Slate) carries
non-severity emphasis; all other color is functional and earned. Surfaces
are layered tonally (paper, paper-raised, paper-sunken) before they are
shadowed; ambient shadows exist but stay below the threshold of "designed."
Type is a serif body (Source Serif 4) for findings and document content,
paired with a system sans for chrome and labels. Density is dialled per
surface: renter views breathe, practitioner panels pack in.

What this rejects, in line with `PRODUCT.md`: the friendly-legal genre
(LegalZoom mascots, purple gradients), crypto / neon-on-black, the generic
SaaS dashboard (hero-metric tiles, rainbow chart palettes, identical card
grids), and DocuSign-corporate trust theatre. None of those vocabularies
appear here.

**Key Characteristics:**

- Paper-and-ink palette built around `oklch`-equivalent warm neutrals.
- Source Serif 4 body type at a 65–75ch measure, never the legal-tool 90ch wall.
- Single accent (Court Slate `#1f3a4d`) used sparingly; severity carries the rest.
- Tonal layering before shadow; shadows are ambient and quiet.
- Tap targets at 44px (WCAG 2.5.5 AAA) for primary actions, 32px for dense toolbars only.
- Severity is never color-only: every tinted surface pairs with icon + label.

## 2. Colors: The Marginalia Palette

A warm-cream paper palette anchored by a single deep ink accent, with four
functional severity hues borrowed from the natural-pigment side of the
spectrum (terracotta, mustard, sage, stone).

### Primary

- **Court Slate** (`#1f3a4d`): the system's one true accent. Default
  buttons, primary links, focus outlines, the pressed-state ring. Not used
  for severity, not used for decoration. In dark mode it lifts to a steel
  blue (`#7ba9c4`) so it stays legible on warm-dark paper.

### Secondary (Severity)

Severity colors carry meaning, never style. They appear on badges, row
backgrounds (via `severity-bg-*` tokens), and finding cards. Always paired
with an icon and a text label.

- **Terracotta Warning** (`#b1442d`): high-severity findings. Auto-renewal,
  jury waivers, broad indemnification.
- **Mustard Caution** (`#b8862c`): medium-severity findings. Also the
  focus-ring color, tuned to ride above the cream paper.
- **Sage Note** (`#5a7a5a`): low-severity findings. Acceptable but worth
  noting.
- **Stone Note** (`#6b7b8c`): informational, no severity asserted.

### Tertiary (Status)

- **Positive Green** (`#4a7a4a`): successful saves, signed-export
  confirmation.
- **Negative Red** (`#9a3022`): destructive confirmation, irrecoverable
  errors. Distinct from `severity-high` so "the document has a problem"
  reads differently from "the app has a problem."

### Neutral

- **Aged Cream** (`#faf6ee`): the canvas. Body background, default page.
- **Folded Page** (`#f3eddc`): sunken surface for inactive controls,
  toolbars, selected-state ghost buttons.
- **Paper-Raised** (`#fdfcf8`): cards, inputs, panels lifted off the page. A
  near-white with a faint warm tint — never pure `#fff`, in keeping with the
  No-Pure-Black Rule below.
- **Ink Black** (`#2a2316`): primary text and headings.
- **Walnut Body** (`#4a3f25`): body copy. Slightly warmer and lighter than
  Ink Black so paragraphs don't read as headlines.
- **Walnut Muted** (`#7a6f57`): labels, metadata, secondary copy.
- **Walnut Faint** (`#a59a7e`): captions, the lowest functional text tier.
- **Margin Rule** (`#d6cdb6`): hairline borders on cards, panels, inputs.
- **Rule Subtle** (`#e8e0cf`): internal dividers within cards.

### Named Rules

**The One Voice Rule.** Court Slate is the only non-severity accent. If
something needs emphasis and isn't a severity finding, it is Court Slate
or it is type weight; it is never a new color.

**The Severity-Earned Rule.** Severity colors appear on severity surfaces
only: finding cards, severity badges, severity-filter chips, audit-log
entries that reference severity. They never decorate generic UI. Pair
every severity surface with an icon and a text label so the signal
survives color-blindness and screen readers.

**The No-Pure-Black Rule.** `#000` and `#fff` are forbidden. Even
`paper-raised` carries a faint warm undertone in dark mode. Tinted
neutrals only.

## 3. Typography

**Display Font:** Source Serif 4 (with Iowan Old Style, Georgia, serif fallback)
**Body Font:** Source Serif 4 for findings and document content; system
sans (`ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto`) for
chrome, labels, buttons.
**Label/Mono Font:** JetBrains Mono (with `ui-monospace`, Menlo fallback)

**Character.** A modern transitional serif paired with the system sans is
the default editorial move; it earns its keep here because the document
itself is the subject. The serif gives findings the gravity of a written
opinion; the sans keeps chrome quick and unambiguous. Mono appears only
where character-level precision matters: hash digests, audit-log entries,
exact rule IDs.

### Hierarchy

- **Display** (Source Serif 4 600, 28px / 32px): page titles, modal
  headlines. One per surface.
- **Heading** (system sans 600, 15px / 22px): panel titles, section
  headers. Sparing use; the document's own headings carry most of the
  hierarchy.
- **Body** (Source Serif 4 400, 14px / 22px): finding text, document
  excerpts, plain-language readings. Capped at 65–75ch.
- **Label** (system sans 500, 12.5px / 18px, +0.01em): form labels, button
  text, metadata. The chrome layer.
- **Mono** (JetBrains Mono 400, 12px / 18px): hashes, IDs, JSON
  fragments, anything where character integrity matters.

### Named Rules

**The Serif-for-Substance Rule.** Body type is serif. Document content,
findings, and explanations get Source Serif 4. UI chrome (buttons, labels,
form fields, navigation) gets the system sans. Don't mix: a serif button
or a sans finding both feel wrong.

**The Measure Rule.** Body and findings cap at 65–75ch. Wide-screen
practitioner views may show two columns at 65ch each before they break to
90ch.

**The Plain-Reading Rule.** When the rule pack uses a term of art, render
the term in the body type; render its plain reading directly beneath in
the same size and a slightly lighter weight (Walnut Body). The renter
should never need a glossary to understand a finding.

## 4. Elevation

The system layers tonally first and shadows second. Three paper tones
(`paper-sunken` → `paper` → `paper-raised`) carry most of the depth on
their own. A single ambient shadow (`shadow-paper`) is a hairline
reinforcing the lift of raised surfaces; it is not a "card shadow" in the
modern SaaS sense.

In light mode the shadow is a 1px warm hairline (`0 1px 0 rgba(42, 35, 22,
0.05)`), almost imperceptible at rest, and that's intentional. In dark
mode it deepens to `0 1px 0 rgba(0, 0, 0, 0.45)` so the raised surface
reads against the warm-dark page.

### Shadow Vocabulary

- **shadow-paper** (`box-shadow: 0 1px 0 rgba(42, 35, 22, 0.05)`): default
  for cards and panels at rest. The hairline lift, not a halo.

### Named Rules

**The Tonal-Before-Shadow Rule.** Always reach for a paper tone first
(`paper-sunken`, `paper`, `paper-raised`) before reaching for a shadow.
Shadow appears only where tonal layering is insufficient (e.g. an
overlay floating above the document plane).

**The Hairline Rule.** No diffuse glows, no 24px ambient blurs, no
glassmorphism. If a surface needs to lift, it lifts by 1px and a tone
change.

## 5. Components

### Buttons

A three-variant system (`default`, `ghost`, `subtle`), two sizes
(`md` 44px / `sm` 32px), and an explicit pressed state used for
toggle-pill filters.

- **Shape:** very lightly rounded (`2px`). The system reads as
  paper-cut, not pill-shaped.
- **Default:** Court Slate background, Aged Cream text. The single
  primary action per surface.
- **Hover / Active:** background darkens by ~10% / ~20% via `bg-ink/90`
  and `bg-ink/80`. Color-only motion; no transform.
- **Focus:** Mustard Caution focus ring (2px, with paper-colored
  ring-offset) plus a Court Slate outline for double-coverage. Visible,
  warm, on-brand.
- **Ghost:** transparent background, Walnut Body text. Hover and active
  use the warm low-opacity mustard washes (`state-hover` /
  `state-active`).
- **Subtle:** Folded Page background with a Margin Rule border. Used
  where Ghost feels too quiet but Default would be loud.
- **Pressed (toggle):** an inset Court Slate ring (`ring-1 ring-inset
  ring-ink`) marks selection. Used by severity filters and view-mode
  tablists.
- **Sizes:** `md` is 44×44 minimum (WCAG 2.5.5 AAA); `sm` is 32×32 only
  for compact-cluster toolbars.

### Cards

- **Corner Style:** `2px` radius. Reads as paper, not pill.
- **Background:** Paper-Raised on Aged Cream pages. Cards never nest.
- **Border:** 1px Margin Rule, full perimeter.
- **Shadow:** `shadow-paper` (the hairline). No diffuse glow.
- **Internal Padding:** 16px default. Findings cards step up to 20–24px
  for breathing room.
- **Severity treatment:** the `Card` primitive accepts a
  `variant="severity-{high|medium|low|info}"` prop that paints the row
  with the matching `severity-bg-*` token (color-mix at 22% against
  `paper-raised`) and a 1px full-perimeter `severity-border-*` (40%
  alpha). Pair with a leading `<Badge variant="severity" severity=…>`
  inside the card so every severity row carries the canonical icon +
  label per the Severity-Earned doctrine. No side-stripe — the edge is
  a full perimeter, the signal is the tint plus the badge.

### Inputs / Fields

`Field` wraps `<input>`, `<textarea>`, and `<select>` with a label-above,
description-below pattern.

- **Style:** Paper-Raised background, 1px Margin Rule border, `2px`
  radius, padded `4px 8px`. Sized at 32px height for dense form areas;
  primary forms scale up to 40–44px where the surface allows.
- **Label:** small system-sans (12.5px / Walnut Muted) above the
  control. Always present, never inside the field as placeholder-only.
- **Description:** optional small system-sans (12.5px / Walnut Muted)
  between label and control.
- **Focus:** 2px Court Slate outline (no offset; the field itself is
  raised). The mustard focus ring is reserved for buttons, where the
  ring-offset technique reads cleanly.
- **Error:** 1px Negative Red border + 12.5px Negative Red helper text
  beneath the field. Never a tooltip.

### Severity Badges & Row Highlights

- **Primitive:** `<Badge variant="severity" severity={…}>Label</Badge>`
  in `app/src/ui/system/Badge.tsx`.
- **Style:** background = `severity-bg-{error|warn|low|info}`, border =
  matching `severity-border-*`, foreground = always Ink Black. The
  `color-mix()` derivation lets dark mode auto-rebalance against
  `paper-raised`.
- **Pairing:** every severity badge carries an icon (16px inline SVG)
  and a one-word label ("High", "Medium", "Low", "Info").
- **Glyph family (Wave 53-C).** Each severity uses a different SHAPE
  so the badge is legible without color: High → triangle warn,
  Medium → diamond + center dot, Low → circle outline, Info → square.
  Stroke is `currentColor`; icons stay `aria-hidden` since the visible
  label carries the meaning.
- **Anti-pattern:** plain Terracotta-on-Cream text without a background
  tint reads as decoration. Always use the badge / row-highlight token
  pair.

### Navigation

- **Style:** the app uses panel-tabs and an in-page side rail rather
  than a global navbar. The view-mode tabs (Current lease / Portfolio /
  Redline / Audit / Settings) live inside a segmented-tab control in
  the 52px `AppHeader` strip — `rounded-sm border bg-paper-sunken
  p-0.5` shell wrapping `role="tablist"` with one `role="tab"` button
  per view. Side-rail navigation is Subtle buttons stacked.
- **Active:** segmented tabs flip to `bg-paper-raised` + 1px rule + Ink
  text + 600 weight. Inactive tabs use a transparent border so the
  size doesn't shift on selection.
- **Aria:** `aria-selected` + `aria-controls` on each tab; `aria-pressed`
  is intentionally absent (axe `aria-allowed-attr` forbids it on
  `role="tab"`).
- **Mobile:** the rail collapses to a single-row tab strip; tap
  targets stay at 44px.

### Marginalia Reader

The default reading surface on the Current tab as of Wave 51. The
PdfViewer is reachable behind a one-click `ReaderPdfToggle`; both
share the selected-finding state.

- **`MarginaliaReader`:** serif body text (`LeaseDocument.paragraphs`)
  with inline `<mark>` highlights for finding excerpts and a margin
  column of finding cards. Hybrid (LLM-classified) findings render in
  the margin without an inline highlight — their `evidence.span` is a
  paragraph-prefix, not ground truth.
- **`FindingRail`:** 28px vertical heatmap to the left of the reader,
  one cell per paragraph, colored by max severity, click-to-jump.
- **`FindingDetailModal`:** scholarly-footnote two-pane modal (clause
  on the left, footnote on the right with title / plain English / why
  it matters / suggested edit / Apply / Counter-offer). Replaces the
  inline `SelectedFindingCard`. Reuses `Dialog` (focus trap, Esc,
  return-focus, `inert` siblings).
- **Glossary popover:** `GlossaryTerm` renders a focusable trigger
  with a `role="tooltip"` popover that opens on hover OR focus and
  closes on Esc. When nested inside an outer button (e.g.
  `FindingsPanel`'s `.finding-btn` snippet), the trigger downgrades
  to a non-focusable `<span>` to avoid `nested-interactive`.

### Redline Diff

Word-level inline diff for paragraphs that carry a `RedlineEdit`.
Replaces the prior "strike whole paragraph + show new text below"
treatment.

- **`.diff-strike`:** removed tokens. Tinted background = severity-high
  at 12% in oklab, line-through with 70%-alpha severity-high stroke,
  foreground stays `--color-fg-body`.
- **`.diff-add`:** added tokens. Tinted background = ink at 8% in
  oklab, underline with 70%-alpha ink stroke (1px, 3px offset),
  foreground = `--color-fg`.
- **Generation:** reuse `computeParagraphDiff(before, after)` in
  `app/src/redline/redline.ts` (LCS over whitespace-aware tokens).
  Render `unchanged` chunks as plain spans, `removed` as
  `.diff-strike`, `added` as `.diff-add`.
- **Aria:** the paragraph carries `aria-label="paragraph N redlined
  diff"` so screen readers announce the inline diff context.

### Viewport-Fill Current Layout

When the analyzed-Current pane is mounted, `<main>` drops its 72rem
centering and padding and becomes a flex column at 100dvh.

- **Selector:** `main:has(.results)` — the override only applies in
  the analyzed-Current state, so Settings / Audit / Portfolio / Redline
  keep their centered layout.
- **`.results`:** `flex: 1; display: flex; flex-direction: column;
  min-height: 0; padding: 1rem 1rem 0`. The 3-column rail | document |
  findings split absorbs remaining vertical space.
- **Findings aside:** drops sticky positioning + viewport-based
  max-height inside `.results`; `height: 100%` lets it scroll
  internally.

### Audit Chain Ribbon

The integrity signal lives at the TOP of the audit view, not in a
footer.

- **Ribbon row:** `N entries · chain head <hash> · <verify-status
  pill>`, all in mono on `bg-paper-sunken` inside a 1px rule. The
  chain head fingerprint is the short hash (`abcd1234…wxyz5678`).
  When a verification result exists, the status pill inlines into the
  ribbon (positive = ink-on-tint, broken = severity-high).
- **Footer:** reduced to a single explanatory line ("tamper-evident
  hash chain — entries verify against the previous entry's hash").
- **Row layout:** seq + timestamp = mono fg-muted (machine values),
  kind = plain fg-body (verb), payload subject (`fileName` / `ruleId`
  / `packId` / `leaseId` / `name`) = serif italic fg-body (the
  object). Falls through to the JSON-summary mono code block when no
  subject field is present.

### PDF Highlight Layer

- **Fill:** `rgba(255, 235, 59, 0.35)` (light mode) / `rgba(255, 235,
  59, 0.42)` (dark). The one place the system uses an off-palette
  color, justified by the highlight metaphor.
- **Border:** `rgba(255, 193, 7, 0.9)`, 1px. A single visual that says
  "this is the clause the finding points at."

### Sections & Section Groups

The accordion shell. `Section` is a labelled region with an optional
`collapsible` toggle; `SectionGroup` is the persistent disclosure
container used by the right rail and by the THIS LEASE / LIBRARY /
GOVERNANCE accordions inside the **Settings tab**. (Wave 53-B-3a
moved those accordions off the Current view; they no longer appear
below the analyzed-lease pane.)

- **Header style:** uppercase 12.5px system-sans (Walnut Muted), with
  an optional count badge after the title.
- **Disclosure affordance:** a chevron glyph on the right; the entire
  header row is the activator (`<button aria-expanded>`).
- **Persistence:** per-group open/closed state is stored in
  `localStorage` under `lg.accordion.<id>.open`; presence of the key
  always wins over the in-code `defaultOpen`.
- **Density:** `comfortable` (default) or `compact` for dense
  practitioner panels.
- **Empty rule:** when a section's body has no rows, the panel renders
  `null` rather than an empty-state sentinel — the rail collapses to
  what's actually present (per the distill pass on the right rail).

### EmptyState

Centered placeholder for panels that have a row vocabulary but no
rows yet (e.g., notes, counter-offers).

- **Style:** vertical stack, centered, `py-8 px-4`, Walnut Muted
  foreground.
- **Icon slot:** 32×32 inline SVG (no icon-font dependency); rendered
  in Walnut Faint and `aria-hidden`.
- **Title:** body-size system-sans, Ink Black.
- **Description:** small-size system-sans, Walnut Muted, capped at
  `max-w-prose` so the copy sits within reading measure.
- **Action slot:** optional, accepts a `<Button>`. Reserved for first-
  run states where a single primary action makes the panel useful.

### FileButton

The PDF-picker primitive — a styled `<label>` that fronts a hidden
`<input type="file">`.

- **Variants and sizes:** mirrors `Button` (`default` / `ghost` /
  `subtle`, `sm` / `md`).
- **Accessible name (WCAG 2.5.3):** the visible children are the
  accessible name. An explicit `aria-label` override is allowed but
  must contain the visible text so voice-control users can speak the
  words they see.
- **Focus:** identical mustard ring + Court Slate outline as `Button`.

### Dialog

Used sparingly; `OnboardingTour` is the only consumer today. The
primitive codifies the WAI-ARIA APG dialog contract so future dialogs
inherit it by construction.

- **Behavior:** focus trap on mount, programmatic initial focus,
  return focus on dismiss, Esc handler, `prefers-reduced-motion`
  honored, mustard focus ring on focusable descendants.
- **Backdrop dismiss:** **off by default.** LeaseGuard is a lawyerly
  app; dialogs are not consumer-soft "tap-anywhere-to-close"
  surfaces. Opt in only for genuinely cancellable flows.
- **Required wiring:** `titleId` (for `aria-labelledby`) is
  mandatory; `descriptionId` is optional but encouraged. The dialog
  root is `tabIndex={-1}` so it can receive focus programmatically.
- **Doctrine:** modals are not the first thought (see Don'ts).
  Inline disclosure, panel state, and `Section` collapse precede a
  dialog every time.

## 6. Do's and Don'ts

### Do:

- **Do** use Court Slate (`#1f3a4d`) as the only non-severity accent.
- **Do** layer tonally (`paper-sunken` → `paper` → `paper-raised`) before
  reaching for a shadow.
- **Do** pair every severity surface with an icon and a text label.
- **Do** cap body and findings text at 65–75ch.
- **Do** use Source Serif 4 for findings and document content; system
  sans for buttons, labels, and chrome.
- **Do** keep primary tap targets at 44×44 (WCAG 2.5.5 AAA); reserve
  32×32 for dense toolbars only.
- **Do** use the `severity-bg-*` token pairs for severity row highlights
  and badges; their `color-mix()` definition auto-rebalances in dark
  mode.
- **Do** honor `prefers-reduced-motion`; reserve motion for state
  transitions where it aids comprehension.

### Don't:

- **Don't** use side-stripe borders. `border-left` / `border-right`
  greater than 1px as a colored accent is forbidden. Severity
  surfaces use background tint + icon + label via the `<Card
  variant="severity-…">` + `<Badge variant="severity">` pair. A
  policy test (`no-side-stripe.policy.test.ts`) blocks regressions.
- **Don't** use `#000` or `#fff` literally. Tinted neutrals only.
- **Don't** use gradient text or `background-clip: text` for
  decoration. Emphasis is weight or size.
- **Don't** add diffuse ambient shadows, glow halos, or glassmorphism
  blurs. The hairline `shadow-paper` is the entire elevation
  vocabulary.
- **Don't** ship the friendly-legal genre: no mascots, no "we make
  legal easy!" cheer, no rounded purple gradients, no LegalZoom
  vocabulary.
- **Don't** ship the SaaS-dashboard reflex: no hero-metric tiles, no
  rainbow chart palettes, no identical card grids of features.
- **Don't** ship crypto/neon-on-black: no glowing accents, no
  animated gradients, no fintech-coded aggression.
- **Don't** ship DocuSign-corporate: no stock photos of handshakes,
  no navy-and-yellow trust theatre.
- **Don't** introduce a serif button or a sans finding-body. Serif
  for substance, sans for chrome.
- **Don't** use severity color outside severity surfaces. Mustard is
  not a "pop"; Terracotta is not a "warm accent."
- **Don't** signal severity by color alone. Always icon + label.
- **Don't** write modals as a first thought. Inline disclosure and
  panel state precede dialogs.
- **Don't** wrap everything in a card. Long-form content, document
  text, and finding bodies often read better as bare text on the
  paper surface with rule lines separating sections.

# LeaseGuard Design-System Extract Inventory — 2026-04-29

## Summary

- Files audited: 44 panels in `app/src/ui/*.tsx` + 6 shell files in `app/src/App/*.tsx` + 9 system primitives + `DESIGN.md` / `DESIGN.json`.
- Extraction candidates: **9** (Components: 4 / Tokens: 0 net-new (1 alias) / Patterns: 5).
- Highest-confidence candidates (used ≥5 times): `PanelHeader` heading (25+), `Section` pad-and-stack default (18), `mini-card list-row` (5), `font-mono text-mono` mono-text combo (16+), `text-small text-fg-muted` helper-text combo (49 — but most are correctly placed; only the `<p>` form is extractable).
- Marginal candidates (≥3 but with shape drift): `severity/trust pill` triplet (5 callsites, two different alpha conventions vs canonical Badge), `evidence blockquote` (2 — below threshold; flagged in cross-cutting), `inline-input override` reproducing `Field` styles (4 callsites that bypass `Field`).

## Candidates

### Component candidates

**PanelHeader** (proposed) — 25+ usages of `<h2 className="text-heading uppercase text-fg-muted">…` plus a `mb-1`/`mb-3` companion variant on h3 lease-panel sub-headers.
- Locations: `TemplatesPanel.tsx:59`, `BulkImportPanel.tsx:61`, `SeverityOverridesPanel.tsx:72,93`, `AuditLogPanel.tsx:29`, `HybridPrecisionPanel.tsx:35,64`, `LibraryPanel.tsx:35,45`, `JurisdictionPickerPanel.tsx:50,61`, `AppLibraryAndPacksPane.tsx:196`, `RedlinePanel.tsx:83,114`, `SigningKeyPanel.tsx:50`, `PackManagerPanel.tsx:99`, `PortfolioPanel.tsx:103,113`, plus h3 variants in `LeaseFactsPanel.tsx:36,44`, `CounterOfferPanel.tsx:59,80`, `PortfolioRollupsPanel.tsx:28,36`, `AppCurrentPane.tsx:226`, `WorkflowPanel.tsx:37`, `TemplateMatchesPanel.tsx:26,33`, `AnnotationsPanel.tsx:39,66`. 25+ direct callsites.
- Same-intent justification: every usage is a panel/section title styled as the chrome label-tier (`text-heading uppercase text-fg-muted`), some with `mb-{1|3}` to set the rhythm to the body. The only divergence is heading level (h2 for top-level panel, h3 for sub-section under a Pane), which is a prop, not different intent. Existing `Section` primitive deliberately does not render the title — so the title duplication is structural.
- Proposed props:
  ```ts
  { as?: 'h2'|'h3'; children: ReactNode; mb?: 0|1|3; className?: string }
  ```
- Risk: `Section` already takes a `label` (used as `aria-label` only, not rendered). Risk that two callers want a different heading-rank than the surrounding landmark dictates — but every current callsite uses h2 directly under the Pane h1, h3 under a Pane that already promotes to h2. Ship `PanelHeader as="h2"|"h3"` and let `Section` accept it as a slot in a follow-up.

**SeverityTrustPill** (proposed) — 5 usages of the `bg-X/10 text-X border-X/30` triplet against severity/positive/negative tokens.
- Locations: `PortfolioPanel.tsx:180-183` (severity matrix), `PackManagerPanel.tsx:64-67` (signature trust badges), `AuditLogPanel.tsx:59` (verification ok/fail), `RedlinePanel.tsx:164` (`severity-medium`), `SigningKeyPanel.tsx:120` (positive-only inline).
- Same-intent justification: all five render a small bordered chip whose tint encodes a status enum (severity / trust / verification). They reuse a `bg-{token}/10 + text-{token} + border-{token}/30` recipe — but Wave 45-A landed `Badge variant="severity"` with `severity-bg-*` / `severity-border-*` color-mix tokens that auto-rebalance for dark mode. The five callsites bypass that primitive and re-derive opacity by hand, drifting from canonical (`/10` vs `severity-bg-*` ≈ 22% mix).
- Proposed props (extends Badge):
  ```ts
  // add to existing Badge.tsx
  variant: 'severity' | 'trust' | 'verification' | 'mono'
  severity?: 'high'|'medium'|'low'|'info'
  trust?: 'verified'|'community'|'invalid'|'unknown'
  verification?: 'ok'|'fail'
  ```
  or a separate `<TrustBadge>` for non-severity statuses to keep `Badge severity` semantically pure.
- Risk: AuditLogPanel and PackManagerPanel use `positive` / `severity-high` (tertiary status) where `Badge variant="severity"` would assert finding-severity meaning the rule-pack-trust callsite shouldn't claim. Keep severity vs trust as different primitives; do NOT collapse into one variant. Two callsites also color text with the token — Badge's "always Ink Black" rule (DESIGN §5 Severity Badges) may need an opt-out for trust.

**ConfirmDialog** (proposed) — 6 usages of `window.confirm` / `window.prompt` for destructive or sensitive flows.
- Locations: `appHelpers.ts:210` (delete-all confirm), `appHelpers.ts:235` (delete-all-leases confirm), `appHelpers.ts:179`, `appHelpers.ts:204` (passphrase prompts), `useAppCallbacks.ts:118` (signing-key passphrase), `LibraryPanel.tsx:80` (rename prompt), `SigningKeyPanel.tsx:78,102` (passphrase prompts).
- Same-intent justification: every callsite is an inline confirmation or single-input prompt that today uses the browser's blocking dialog. A `Dialog` primitive already exists (Wave 45-F). Standardizing a `ConfirmDialog` on top would (a) match the Marginalia type voice, (b) allow plain-language affirm/cancel labels per Wave 45-D, (c) make the "destructive vs data-entry" intent visible per the project memory note on crypto copy. Six callsites; still using browser native.
- Proposed props:
  ```ts
  { open: boolean; title: string; description?: ReactNode;
    affirmLabel: string; cancelLabel?: string;
    variant?: 'destructive'|'default';
    input?: { label: string; type: 'text'|'password' };
    onAffirm: (value?: string) => void; onCancel: () => void }
  ```
- Risk: passphrase prompts are crypto-adjacent — converting to React state means the cleartext lingers in memory longer than `window.prompt`. Plan a memory-zeroing pattern before migration. Migration also requires every call-site to switch from sync to async — that's a wide diff. Ship the primitive first; migrate one panel at a time.

**StatusMessage** (proposed) — 17+ usages of `<p role="status">…</p>` / `<p role="alert">…</p>` carrying a one-liner success/error/info state.
- Locations: `PackManagerPanel.tsx:164,169`, `MarketplacePanel.tsx:94,103,112,157,160`, `OpenReviewPanel.tsx:105,107`, `WorkflowPanel.tsx:59`, `CounterSignPanel.tsx:74`, `DeltaPanel.tsx:86`, `OpenDeltaPanel.tsx:78`, `AppCurrentPane.tsx:178`, `ShareReviewPanel.tsx:76,93`, `AuditLogPanel.tsx:56`, `BulkImportPanel.tsx:149`.
- Same-intent justification: all render a one-line role=status or role=alert message. Today three different className patterns coexist (`text-small text-positive`, `text-small text-severity-high`, `error` legacy class, plain `<p>`). A `<StatusMessage tone="success|error|info" live="polite|assertive">` would centralise the (a) role mapping, (b) color token, (c) the `{message}: {error.message}` plain-language convention plan from Wave 45-D.
- Proposed props:
  ```ts
  { tone: 'success'|'error'|'info'|'warning';
    live?: 'polite'|'assertive'|'off';
    children: ReactNode; className?: string }
  ```
- Risk: two of the 17 wrap their text inside other live regions; double live regions over-announce. Prop must allow `live="off"` so callers nested in `<div role="status">` don't double-up. Also: ComparePanel `<div role="alert">` wraps a paragraph + dismiss button — that's a richer pattern (Banner) and should NOT be folded in.

### Token candidates

**(none net-new).** The audited code uses canonical tokens almost exclusively — the only literals found were `style={{ height: '32rem' }}` in `SideLetterPanel.tsx:100` (one-off iframe sizing) and `style={{ display: 'none' }}` in `system/FileButton.tsx:94` (legitimate). No `#hex`, no `oklch(`, no `rgba(`. The PDF highlight literal documented in DESIGN.md §5 lives in `PdfViewer.tsx` (intentional off-palette per spec). All severity/positive/negative usages thread through the named tokens.

**Token alias suggestion (marginal):** `--state-hover` / `--state-active` are referenced ~6× via `bg-[var(--state-hover)]`. They're real CSS custom properties but not first-class entries in `DESIGN.json`. Consider promoting them to named tokens (`state.hover`, `state.active`) for parity with the `severity-bg-*` family. Not blocking; cosmetic for the design-token export.

### Pattern candidates

**SectionShell** — 18 usages of `Section label="…" className="space-y-{2|3|4} px-4 py-4"`.
- Locations: `BulkImportPanel.tsx:60`, `SeverityOverridesPanel.tsx:71,92`, `HybridPrecisionPanel.tsx:34,63`, `LibraryPanel.tsx:34,44`, `TemplatesPanel.tsx:58`, `AppLibraryAndPacksPane.tsx:195`, `PortfolioPanel.tsx:102,112`, `AuditLogPanel.tsx:28`, `SigningKeyPanel.tsx:49`, `JurisdictionPickerPanel.tsx:49,60`, `RedlinePanel.tsx:82,112`, `PackManagerPanel.tsx:98`.
- Composition shape: `<Section label aria> + <PanelHeader> + body stack`, padded `px-4 py-4`, vertical rhythm `space-y-{2|3|4}`.
- Existing primitive(s) it would compose: `Section` (wrapper) + new `PanelHeader` candidate above. Option: bake the padding + default stack into `Section` via a `density` prop matching `SectionGroup`'s `comfortable|compact`.

**MiniCardListRow** — 5 usages of `rounded-sm border border-rule bg-paper-raised shadow-paper px-3 py-2`.
- Locations: `TemplatesPanel.tsx:68` (template list-row), `LibraryPanel.tsx:50` (lease list-row), `RedlinePanel.tsx:126` (redline paragraph row), `PackManagerPanel.tsx:101,109` (built-in + installed pack rows). Plus `bg-paper-sunken` variant at `CounterOfferPanel.tsx:87`, `AnnotationsPanel.tsx:72` (3 sunken usages).
- Composition shape: a `Card`-equivalent at smaller padding (`px-3 py-2` vs `Card`'s 16px) for list rows. Effectively a `<Card density="compact">`.
- Existing primitive(s): `Card` — extend with a `density` prop (`comfortable | compact`) and a `surface` prop (`raised | sunken`) so the 8 callsites collapse into one.

**MonoCode** — 16 usages of `font-mono text-mono` ± `text-fg-muted`.
- Locations: `PortfolioRollupsPanel.tsx:56`, `SeverityOverridesPanel.tsx:117`, `AuditLogPanel.tsx:106`, `HybridPrecisionPanel.tsx:83,138`, `AppLibraryAndPacksPane.tsx:198`, `TemplateMatchesPanel.tsx:47,53`, `PackManagerPanel.tsx:171`, `SigningKeyPanel.tsx:65,117`, `BulkImportPanel.tsx:64,139`, `AppCurrentPane.tsx:228`, `PortfolioPanel.tsx:133`, `FindingsPanel.tsx:449,507,516`, `system/Badge.tsx:103` (already a variant!).
- Composition shape: hash digests, rule-IDs, JSON fragments, file extensions. `Badge variant="mono"` already exists — but most callsites are `<code>` / `<span>` not badges, so a `<MonoText>` (or pure utility class) would close the gap. Lowest-risk: add a `.mono-text` utility recipe to the global stylesheet; all 16 callsites collapse to that one class. Highest-utility: ship `<MonoText as="code"|"span">` so semantics stay correct.

**EvidenceQuote** — 2 usages of `border-l border-rule pl-3 font-mono text-mono text-fg-muted italic` (`AppCurrentPane.tsx:228`, `TemplateMatchesPanel.tsx:53`). **Below the ≥3 threshold — flagged below in cross-cutting; do not extract yet.**

**SeverityFilterChip** — 1 usage at `JurisdictionPickerPanel.tsx:72` (`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-small`). Toggle-pill checkbox pattern. Flagged for visibility but only one callsite; do not extract.

## Cross-cutting observations

- **Form-row pattern (label-above-field-with-helper):** The `Field` primitive already exists. CustomRuleBuilderPanel has 14 raw `<input>` / `<select>` / `<textarea>` callsites that bypass it. This is a *migration* problem, not an *extraction* problem — the primitive is already sufficient.
- **EvidenceQuote (blockquote of clause text):** only 2 usages — below threshold. Re-evaluate after Wave 47 if the open-review panel adds a third.
- **OCR / streaming progress banner:** `AppCurrentPane.tsx:155` (ScannedPdfNotice / ResultsHeader sub-components extracted in Wave 45-BE) + `BulkImportPanel.tsx:91` (Wave 45-F live region). Same intent (progressive aria-live + tone), different shape. Not the same enough to extract — keep separate.
- **`ComparePanel` h2/h3 + plain `<ul>`:** the panel uses no design-system primitives at all (predates Wave 27-C). The Added/Removed/Changed sub-sections each have their own `<h3>{label} ({count})</h3>` — three different intents (added=positive, removed=negative, changed=warning) but rendered identically. A `<DiffSection variant=…>` is tempting; passes ≥3 with same-intent technically, but risks freezing a too-narrow API. Recommend re-flagging after PackDiffPanel adopts the same shape (it already does via SectionGroup).
- **Severity sub-card (sunken variant):** `CounterOfferPanel.tsx:87` + `AnnotationsPanel.tsx:72` use `bg-paper-sunken border border-rule rounded-sm p-3` (3rd usage at `AppCurrentPane.tsx:156` is the OCR banner — different intent). Two valid + one drift; below threshold for now.
- **`window.prompt` for passphrase (3 callsites):** all crypto-adjacent. ConfirmDialog migration must zero memory; track separately from rename-prompt usage (1 callsite, non-sensitive).
- **`text-small text-fg-muted` (49 hits):** valid utility-class composition; only the standalone `<p>` form is candidate (StatusMessage). Do NOT extract a `<MutedText>` — that's premature abstraction.

## Recommended slicing

### Slice 1 — PanelHeader + SectionShell (highest ROI)
- Candidates covered: `PanelHeader` component + `Section` density/padding default (or new `SectionShell` composing both).
- Migration footprint: 18 panels touch `Section`; 25+ touch `PanelHeader`. Net ~30 panel-file rewrites of 1-2 lines each. No tests change.
- Risk of breaking Wave 45 / Wave 46-pending / Wave 47-planned: **low**. Wave 45 shipped Section-internal patterns; PanelHeader is purely a chrome rename. Wave 46 closeout (the un-merged plan in working tree) and Wave 47 (per project notes) target signing/UX copy — neither touches panel scaffolding.
- Rationale: every panel in the app reads from these two patterns. One PR collapses 25 + 18 hand-written class strings into two primitives, eliminates the most frequent style-drift target, and leaves a single edit-point for future density tweaks. Idiomatic and reversible.

### Slice 2 — Card density/surface variants (collapse MiniCardListRow)
- Candidates covered: extend `Card` with `density: comfortable|compact` and `surface: raised|sunken`. Migrates 5 raised + 3 sunken list-row callsites.
- Migration footprint: 8 panel files (Templates, Library, Redline, PackManager ×2, CounterOffer, Annotations, AppCurrentPane).
- Risk: **low-medium**. Card already has `variant="severity-…"` from Wave 45-A; adding two orthogonal props requires care that severity + density don't collide. Test matrix grows from 5 (severity) to 5 × 2 × 2 = 20. CounterOfferPanel renders inside Wave 47-planned counter-offer UX — coordinate with that plan.
- Rationale: `Card` is the right home; the duplication is the most copy-pasted Tailwind string in the repo. Bundling MiniCardListRow into `Card density="compact"` keeps the primitive count flat.

### Slice 3 — StatusMessage + ConfirmDialog (safety + a11y discipline)
- Candidates covered: new `<StatusMessage tone live>` (17 callsites) and `<ConfirmDialog>` building on existing `Dialog` (6 callsites; ship primitive only, migrate one panel).
- Migration footprint: ~17 small `<p role=…>` rewrites + 1 first ConfirmDialog adoption (suggest LibraryPanel rename — non-crypto, lowest risk). Crypto-passphrase migrations deferred to a follow-up wave with a memory-zero pattern.
- Risk: **medium**. Live-region semantics are easy to over-announce; `StatusMessage` API must let callers opt out of the role when nested. ConfirmDialog touches the destructive-confirm gate that PR #173 just hardened — propose, don't ship blind. Crypto callsites must wait until passphrase memory handling is specified.
- Rationale: closes the last meaningfully drift-prone surface (status messaging is currently 4 different className recipes) and replaces the last `window.confirm` / `window.prompt` blockers, aligning with both the Marginalia copy voice (Wave 45-D) and the error-discipline badge work just shipped in Wave 45-BE.

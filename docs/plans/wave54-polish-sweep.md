# Wave 54 — Polish sweep (post-handoff residue)

Three small, independent UI fixes carried over from earlier polish/critique passes. Each ships as its own PR off `main`.

## §1 Hard rules

- Each slice is < ~50 LOC of code change. If a slice grows, stop and re-scope.
- No new components. Reuse `FileButton`, `Button`, existing tokens.
- No copy decisions invented; if a slice needs new prose, propose it in the PR body and wait for confirmation before merging.
- Verify each slice with: `npm run typecheck`, `npm run lint`, `npx vitest run`. Push only when green.
- Ship via `gh pr merge --auto --squash` per the project merge protocol.

## §2 Out of scope

- Findings filter chips collapse — flagged "validate with a practitioner before changing" in BACKLOG. UX call, not a polish bug. Leave deferred.
- Wave 48 Slice 2/3 vocabulary + Card density refactors — separate scope, not residue.
- PDF page raster theme-awareness — known unknown, needs pdf.js color-invert work.

## §3 Plan body — Part A (Destructive treatment for Clear-all)

**Files touched:**

- `app/src/ui/AppSettingsPane.tsx` — apply `text-[var(--color-negative)]` (or equivalent token class) to the label inside the existing `<Button variant="ghost">` for the clear-all action. Keep the Subtle button shell — DESIGN.md reserves Negative Red for the LABEL of irrecoverable actions, not the button surface.

**Verify:**

- `npm run test -- AppSettingsPane` — green.
- Visual: Settings → Data management → "Clear all saved data" label reads in Negative Red; button shell unchanged; hover/focus rings unchanged.

## §4 Plan body — Part B (UploadView native-input leak)

**Files touched:**

- `app/src/ui/UploadView.tsx` — the inline `<input type="file" aria-label="upload lease">` leaks the platform's native "Choose File / No file chosen" text into the dropzone in dark mode. Replace with a `<FileButton>` (already styled, already hides the input via `display: none`). Preserve:
  - The dropzone's `onDragOver` / `onDrop` semantics on the surrounding `<div>`.
  - `aria-label="upload lease"` on the actual `<input>` (FileButton accepts `aria-label`).
  - The "Try sample" sibling button.
  - Existing tests that target the input via `screen.findByLabelText(/upload lease/i)` — FileButton's hidden input keeps the same label, so test selectors should hold.
- `app/src/ui/UploadView.test.tsx` — verify no test regressions; if a test relied on the visible native control, switch to clicking the FileButton.

**Verify:**

- `npm run test -- UploadView App.test App.panels.test` — green. These three suites cover every flow that touches the upload control.
- Visual (dark-mode walk): dropzone shows ONLY the styled FileButton + "Try sample" pair — no native "Choose File / No file chosen" text.

## §5 Plan body — Part C (Empty home state — quiet privacy block)

**Files touched:**

- `app/src/ui/UploadView.tsx` — when no lease is loaded, the lower 60% of the viewport is blank ("reads as broken, not calm"). Add a single quiet privacy block below the dropzone:
  - Short headline ("Local-first" or similar — propose copy in PR body)
  - 1-2 sentences pointing at: (1) PDF parses entirely in the browser, (2) all storage is local IndexedDB, (3) strict CSP blocks third-party origins.
  - Style: serif body text, `text-fg-muted`, `max-w-[60ch]`, generous top margin.
- No new component. Inline JSX inside UploadView.

**Copy decision required:** propose 2-3 candidate variants in the PR body; do not merge until confirmed.

**Verify:**

- `npm run test -- UploadView` — green.
- Visual: idle state reads as a calm landing, not an empty room. No new horizontal scroll, no overflow.

## §6 Closeout

- [ ] All three slices merged.
- [ ] BACKLOG flips for: clear-all destructive treatment, native-file-chooser leak, empty home state — each with its Wave 54 PR ref.
- [ ] No DESIGN.md change required (no new vocabulary; reuses Negative Red token, FileButton primitive, existing serif body type).

## §7 Risks

- Part B's FileButton swap may shift the dropzone layout — the native input has implicit width that FileButton doesn't. Walk the analyzed-Current path manually after.
- Part C copy: poorly-tuned tone tips this from "calm" to "marketing." Keep it short, concrete, lawyerly. No exclamation marks.

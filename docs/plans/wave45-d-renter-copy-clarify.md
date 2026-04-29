# Wave 45-D — Renter copy clarify Implementation Plan

**Goal.** Close the "renter sees jargon" gap surfaced by `/impeccable critique` (Persona Red Flags → Anita) and `/impeccable audit` (P1 Anita persona, P3 FindingsPanel `~` badge). After this wave: every place a renter currently sees an unexplained term of art (`~` LLM badge, hash digests, "signed export", terse app errors) carries a one-sentence plain reading next to it. Practitioner density preserved; renter view stops feeling alarming.

**Architecture.** Pure copy + small JSX additions. No new tokens, no new components, no new dependencies. Three concrete sites + an error-copy pass. Each item independently committable + revertable.

**Tech Stack.** React 18 + strict TS, existing Tailwind v4 tokens, vitest + RTL. Tone per PRODUCT.md: "clear, calm, informative" — plain language with brief technical follow-up where the technical detail aids understanding (e.g. "Each entry signs the one before it. If a single entry is altered, the chain breaks.").

**Base SHA.** `origin/main` at start of session. Verify with `git fetch origin && git log origin/main --oneline -5` before branching.

**Prerequisites.** Waves 45-A and 45-F merged (already in main). 45-D is independent of 45-B / 45-C / 45-E; can ship in any order.

---

## §1 Hard rules

1. **One PR.** Five items on one feature branch.
2. **No new dependencies, no new tokens.** Copy + small JSX additions only.
3. **Existing tests pass without modification.** New copy must coexist with `getByRole({ name: ... })` and `getByText(...)` queries already in place. Where a test asserts an exact terse string ("Error: bad schema"), update the test to match the new plainer copy in the same commit.
4. **Tone discipline.** Plain language with brief technical clarification — voice of NYT-explainer, not Stripe-docs-pure-precision. Confirmed during shape: *"Each entry signs the one before it. If a single entry is altered, the chain breaks and verification fails."* over *"Think of the audit log like a chain..."*.
5. **No em dashes** in user-facing strings (per impeccable shared design law). Use periods, commas, semicolons, parens.
6. **Local gate green** before push. Per the Wave 45-A lesson: also run the e2e a11y spec locally (`npx playwright test tests/e2e/a11y.spec.ts --project=chromium`) before push since copy changes can shift contrast under axe.

## §2 Out of scope

- IA / panel restructuring — Wave 45-B (renter-IA distill of `AppCurrentPane`).
- `ComparePanel` rewrite — Wave 45-C.
- Severity-vs-negative discipline pass and `Field` error-state API — Wave 45-E.
- Glossary content rewrites (large, separate effort).
- i18n. The current copy is English-only by project convention; existing strings may flow through `useI18n`'s `t()`, in which case 45-D updates the I18n message catalog. Strings not yet in `t()` stay inline (consistent with the rest of the codebase).

## §3 Execution

Direct, single-track. Estimated 60-90 min: 4 small JSX edits, 3 test updates, plan/spec reads.

## §4 Item A — FindingsPanel `~` LLM badge

**Why.** `/impeccable critique` Anita persona red flag: *"the `~` LLM badge will read as alarming or incomprehensible."* `/impeccable audit` P3: *"FindingsPanel.tsx:444 uses a literal `~` glyph as the LLM-badge label. Cute but unlabeled — fails Plain-Reading for a renter."* The button is a click-to-explain disclosure trigger and must remain interactive and keyboard-accessible; only the visible affordance changes.

**Files:**
- Modify: `app/src/ui/FindingsPanel.tsx` (around line 442-456, the `<button className="finding-llm-badge">` block).
- Modify: `app/src/ui/FindingsPanel.test.tsx` if any assertion targets the literal `~`.

**Steps:**
- [ ] Replace the visible `~` glyph with a small text label *"On-device pattern match"* in `text-small font-sans text-fg-muted`. The button retains `aria-expanded`, `aria-pressed`, and the existing `aria-label="Identified by on-device classifier (similarity X%)"`.
- [ ] Add a 12px inline-SVG info icon (`(?)`) next to the text label so the button still reads as "click for more" at a glance. Icon is `aria-hidden="true"`; the text carries the meaning.
- [ ] No CSS changes beyond the icon styling. Existing button classes (border, padding, hover state, focus ring) preserve.
- [ ] If `FindingsPanel.test.tsx` asserts the `~` glyph anywhere, update to assert the new text. Search `~` in the test first.
- [ ] `npm run typecheck && npm run lint && npm test -- FindingsPanel`.
- [ ] Commit: `clarify(findings): replace ~ glyph with "On-device pattern match" label`.

## §5 Item B — AuditLogPanel plain-language preamble

**Why.** `/impeccable critique` Anita persona red flag: *"audit entry: a3f1c20b mono digest will read as incomprehensible."* The audit log is the renter's only window into the local-first / signed-handoff guarantee, so its first paragraph should land with a non-lawyer reader.

**Files:**
- Modify: `app/src/ui/AuditLogPanel.tsx` (the existing intro paragraph around line 31 stays; add a follow-on plain reading).

**Steps:**
- [ ] After the existing line *"Append-only, hash-chained record of analyses, exports, and library …"*, append a short paragraph in `text-small text-fg-muted`:
      > *"Each entry signs the one before it. If a single entry is altered, the chain breaks and verification fails. The full digest is shown in mono so you can copy it; the short form (first 8 characters) is enough for spot-checks."*
- [ ] Confirm any existing axe `<region>` or `aria-labelledby` wiring still applies; the new `<p>` is a sibling, not a wrapper.
- [ ] Update `AuditLogPanel.test.tsx` only if it asserts a single-paragraph intro; otherwise no change.
- [ ] `npm run typecheck && npm run lint && npm test -- AuditLogPanel`.
- [ ] Commit: `clarify(audit-log): add plain-language preamble for hash-chained log`.

## §6 Item C — Signed-export disclosure

**Why.** `AppCurrentPane.tsx:119-141` exposes "Export JSON / Export HTML / Export signed JSON" as a top toolbar. *"Export signed JSON"* is the renter-facing surface of an Ed25519-signed payload, but the affordance offers no plain reading. *"What is signed export?"* is the implicit question the audit named.

**Files:**
- Modify: `app/src/ui/AppCurrentPane.tsx` — co-locate a `<details>` next to the signed-export button.
- Modify: `app/src/ui/SigningKeyPanel.tsx` — same `<details>` pattern next to the key-management surface (consistency).

**Steps:**
- [ ] Add a `<details>` after the `<Button>` group at `AppCurrentPane.tsx:141` (only rendered when `hasSigningKey`):
      ```tsx
      <details className="text-small text-fg-muted">
        <summary className="cursor-pointer select-none">What is signed export?</summary>
        <p className="mt-1 max-w-prose">
          A signed export pairs your findings with a signature derived from a key only you control.
          Anyone you share the file with can verify it came from you and has not been altered.
          The key never leaves your browser.
        </p>
      </details>
      ```
- [ ] Mirror the same `<details>` in `SigningKeyPanel.tsx` with the parallel question *"Why does signing matter?"* (same body — keep the explainer DRY by exporting a small `SignedExportExplainer` component if either consumer touches it twice; otherwise inline both).
- [ ] No tests need updating unless one asserts "no `<details>` under the export toolbar" — search for `details` in `AppCurrentPane.test.tsx` first.
- [ ] `npm run typecheck && npm run lint && npm test -- AppCurrentPane SigningKeyPanel`.
- [ ] Commit: `clarify(export): "What is signed export?" disclosure on Current pane and SigningKeyPanel`.

## §7 Item D — Error-copy pass on three app-error sites

**Why.** Audit P2: *"`text-severity-high` for app errors at 14px on cream — borderline AA"* PLUS the strings themselves are terse fragments. The visual color fix lives in Wave 45-E; this wave fixes the copy. Both passes can ship independently.

**Sites:**
- `AppCurrentPane.tsx:167` — current: *"OCR failed: {message}"*. Plain: *"OCR didn't finish reading this PDF. The error was: {message}. The clauses on the page may not appear in findings. You can try a different language pack from the picker above, or use the original PDF text where it's selectable."*
- `AuditLogPanel.tsx:52` — current: *"chain-broken"* status. Plain: *"Audit chain broken. An entry was altered or removed; the next verified-export bundle won't include the affected range. (Wave 45-E will swap the color from severity-high to negative.)"*
- `PackManagerPanel.tsx:173` — current: *"Error: {error}"*. Plain: *"Couldn't import the rule pack. {error}. Common causes: the file isn't a `.lgpack.json`, or the signature didn't verify."*

**Files:**
- Modify: each of the three sites above.
- Modify: corresponding test files where assertions target the old terse strings (likely 1-3 sites; search for the matching substrings first).

**Steps:**
- [ ] Update each error string in place. Keep the existing semantic structure (`role="alert"`, `role="status"`, etc.) intact.
- [ ] Update tests that match the old terse copy (regex-match where possible to make future copy tweaks low-friction: `expect(...).toHaveTextContent(/couldn't import the rule pack/i)` rather than the exact string).
- [ ] `npm run typecheck && npm run lint && npm test`.
- [ ] Commit: `clarify(errors): plainer language on OCR failure, chain-broken, pack import error`.

## §8 Item E — Wave-level verification

After all four content items:

- [ ] `git grep -n '"~"' app/src/ui/FindingsPanel.tsx` — must return zero hits (the `~` glyph is gone from the rendered button).
- [ ] `git grep -n "What is signed export" app/src/ui` — must return at least one hit.
- [ ] `git grep -n "Error: " app/src/ui/PackManagerPanel.tsx app/src/ui/AppCurrentPane.tsx` — should return zero hits in the rendered strings (the new copy doesn't lead with "Error:").
- [ ] `npm run typecheck && npm run lint && npm run test:coverage` — clean. Coverage thresholds met.
- [ ] `npx playwright test tests/e2e/a11y.spec.ts --project=chromium` — pass. Per the Wave 45-A lesson, copy changes can shift contrast (longer strings, new icons) under real-browser axe.
- [ ] Manual eyeball: `npm run dev`, upload a sample lease, hover a hybrid finding (the `On-device pattern match` button reads), open the audit log (preamble lands), open the export toolbar with a signing key present (`<details>` opens cleanly), trigger an OCR failure (plainer error string).

## §9 PR + merge

- Branch: `wave45-d-renter-copy-clarify`
- PR title: `clarify(renter): plain-language explainers for ~, hash digests, signed export, app errors (Wave 45-D)`
- PR body: this plan's goal + the four item commits + verification checklist.
- **Rebase before push:** `git fetch origin && git rebase origin/main && git push --force-with-lease`. Per the standing rebase-before-push memory.
- **Poll CI:** `gh pr checks <num>` until terminal. Don't walk away from auto-merge.
- Single squash-merge after `gh pr checks` clears.

## §10 Risks and rollback

- **Risk: copy creep.** The wave is "clarify," not "rewrite every word." If a Codex pass surfaces additional clarity issues, queue them as Wave 45-D-follow-ups in BACKLOG and ship the planned scope. Don't expand inline.
- **Risk: layout shift.** New `<details>` collapses to one summary row; expanded body adds 2-3 lines. Confirm the export toolbar still wraps cleanly at 360px viewport during the manual eyeball step.
- **Risk: test flake from regex tightening.** When changing test assertions to regex, prefer `/text/i` over `text` so future minor copy tweaks don't break the test. Sticky-exact strings are the wrong reflex for copy-bearing tests.
- **Rollback.** Each item is its own commit; revert in reverse order if a downstream wave (45-B / 45-E) finds a regression.

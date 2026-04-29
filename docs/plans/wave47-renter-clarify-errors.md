# Wave 47 — Renter-Facing Errors and Confirmations Clarify Pass

**Goal.** Land Slice 1 of the project-wide copy clarify inventory
(`docs/audits/clarify-inventory-2026-04-29.md`): rewrite the renter-facing
error and confirmation copy that sits on the destructive, signing, and
review-archive paths. Replace the misnamed `friendlyError` passthrough
with a real error-to-plain-string mapper, route four `window.prompt` /
`window.confirm` callsites through the Wave 45-F `Dialog` primitive, and
rewrite the `OpenReviewPanel.REASON_MESSAGES` table. After this wave,
the highest-impact renter blockers — cryptic browser errors with no
recovery hint, native browser dialogs in the destructive path, and
"wrong-passphrase" copy that conflates passphrases with cryptographic
keys — are gone.

**Scope corresponds to:** inventory rows tagged Slice 1 — 5 High / 9
Medium across `App/useAppCallbacks.ts`, `App/appHelpers.ts`,
`OpenReviewPanel.tsx`, `ShareReviewPanel.tsx`, `CounterSignPanel.tsx`,
`MarketplacePanel.tsx`, `DeltaPanel.tsx`, `i18n/messages.ts`,
`SigningKeyPanel.tsx` (passphrase prompts only — Wave 45-D disclosure
preserved), `AppCurrentPane.tsx` (OCR error structure only — Wave 45-D
disclosure preserved).

**Architecture.** No new primitives. Item A introduces
`app/src/App/clarifyError.ts` — a small classifier that maps known error
classes (`PdfPasswordError`, `PdfStructureError`, IDB quota, signing
wrong-passphrase, clipboard-denied, fetch failures) to plain-language
renter-facing strings; existing `friendlyError` callers migrate to
`clarifyError(err, { context })`. Item B replaces four
`window.prompt` / `window.confirm` callsites with the existing
`Dialog` primitive from `src/ui/system/Dialog.tsx` plus the existing
`Field` primitive for passphrase entry — no new components. Items C
and D are pure copy rewrites in `OpenReviewPanel.REASON_MESSAGES`,
`MarketplacePanel`, `DeltaPanel`, `CounterSignPanel`, `ShareReviewPanel`,
`AppCurrentPane` (OCR error reflow), and `i18n/messages.ts`.

**Tech Stack.** React 18 + TypeScript strict, Tailwind v4, Vitest +
RTL + `user-event`, Storybook 8 CSF. No new dependencies.

**Base SHA.** `origin/main` after Wave 46 (program closeout) merges.
Verify `git fetch origin && git log origin/main --oneline -10` includes
`wave(46): program closeout` before branching.

**Prerequisites.** Wave 46 program-closeout merged (Dialog `inert` shipped
in 46-D — needed because Item B mounts new Dialogs and the focus-
containment test is the gate that catches regressions). Wave 45-F also
required — `Dialog` and `FileButton` primitives are the foundation for
Item B.

---

## §1 Hard rules

1. **One PR.** Whole wave on one feature branch `wave47-renter-clarify-errors`.
2. **No new dependencies.** Reuse `Dialog`, `Field`, `Button` system primitives. No new toast / global notification system.
3. **Wave 45-D strings are immutable.** Do not modify: FindingsPanel similarity badge + aria-label, AuditLogPanel preamble, `AppCurrentPane`/`SigningKeyPanel` "What is signed export?" disclosure body, PackManagerPanel import-error string, OnboardingTour step 4 body. CI greps for the canonical strings — see §6.
4. **`clarifyError` is purely additive.** Don't break callers that pass a non-Error. Add a fallback branch that returns `"Something went wrong. Please try again."` with the raw `String(err)` exposed only via `details` (not in the visible string). The existing `friendlyError` export stays as a one-line re-export to `clarifyError` for the duration of the wave; remove the old helper file in a follow-up only after grep confirms zero callers.
5. **Dialog migration must preserve test behavior.** The four prompt/confirm sites have tests that mock `window.prompt` / `window.confirm`. Each test must be rewritten to drive the `Dialog` via RTL + `user-event` (open dialog → fill field → click confirm), not via `vi.spyOn(window, 'prompt')`. The `App.tsx` testing pattern in `docs/CLAUDE.md` calls these mocks out — update the §"Testing patterns" guidance in this PR to match.
6. **Passphrase fields use `type="password"`, `autocomplete="new-password"` (create) / `"current-password"` (unlock), and a visible min-length helper text.** No floor enforcement in this wave beyond the existing `MIN_PASSPHRASE_LEN` server-side check — the helper text is the only behavioral change. (Promoting min-length to client-side `pattern` is a Wave 48 candidate.)
7. **Destructive confirms name the target.** `clearAll` Dialog body must include the lease count ("Delete N saved leases?"). VersionHistoryPanel destructive-confirm gap from inventory row "VersionHistoryPanel.tsx:105-110" is **out of scope** here — file a backlog row, defer.
8. **Real-browser a11y gate.** `npx playwright test tests/e2e/a11y.spec.ts` must pass — Item B introduces new Dialog mount points and the trap + `inert` (Wave 46-D) interaction is the failure mode this catches.
9. **Local gate green** (`npm run typecheck && npm run lint && npm run test:coverage`) before push. Coverage on the new `clarifyError` mapper module: 100% (it's tiny — every branch covered).
10. **Codex adversarial gate** before `gh pr ready`. Renter-facing error copy in signing/passphrase paths magnetizes findings (per `feedback_crypto_copy_must_match_code_exactly` memory). Plan ≥3 passes; every plain-language claim must map to a code-verifiable property.

## §2 Out of scope

- **Slices 2 and 3 of the inventory.** Audit-log kind→label adapter, OnboardingTour severity vocabulary fix, and the 15-string empty-state polish pass are deferred to Wave 48 / 49.
- **CustomRuleBuilder regex-error rewrite** (inventory High in Slice 3). Practitioner-only surface, can ride Slice 3.
- **VersionHistoryPanel destructive-confirm gap.** File a BACKLOG row; do not bundle.
- **`useAppCallbacks.ts:60` HTTP-status leak in sample fetch.** Inventory High but tied to a fetch-failure branch only renters on the marketing path hit; covered by Item A's `clarifyError` mapper as a side effect — no separate item.
- **Toast / global notification system.** Confirmations and errors stay scoped to their owning panel/Dialog. No app-wide event bus.
- **Promoting `MIN_PASSPHRASE_LEN` to client-side validation.** Add helper text only. Hard validation is Wave 48.
- **i18n locale coverage beyond the source `messages.ts`.** Locale files in `app/src/i18n/locales/` get the new keys; translation backfill is a separate ticket.

## §3 Files in scope

**Item A — `clarifyError` mapper:**
- New: `app/src/App/clarifyError.ts`
- New: `app/src/App/clarifyError.test.ts` (100% branch coverage)
- Modify: `app/src/App/appHelpers.ts` (delete `friendlyError` body, re-export `clarifyError` for one wave)
- Modify call sites that previously used `friendlyError`: grep `app/src/` for `friendlyError` and migrate each — likely `useAppCallbacks.ts`, `MarketplacePanel.tsx`, `DeltaPanel.tsx`, `PackManagerPanel.tsx`, `CounterSignPanel.tsx`, signing helpers.

**Item B — Dialog migration of prompt/confirm:**
- Modify: `app/src/App/appHelpers.ts:235` (`clearAll` `window.confirm` → Dialog confirm with count + lease names)
- Modify: `app/src/App/appHelpers.ts:179, 204` (archive export + import passphrase prompts → Dialog with Field + min-length helper)
- Modify: `app/src/ui/SigningKeyPanel.tsx:78, 102` (create + rotate passphrase prompts → Dialog with Field + recovery-loss warning)
- Modify the corresponding tests in `appHelpers.test.ts` and `SigningKeyPanel.test.tsx` to drive Dialog via RTL, removing `vi.spyOn(window, 'prompt'|'confirm')` patterns
- Update: `docs/CLAUDE.md` §"Testing patterns" — replace the prompt/confirm mock guidance with the Dialog-driven pattern

**Item C — `OpenReviewPanel.REASON_MESSAGES` rewrite:**
- Modify: `app/src/ui/OpenReviewPanel.tsx:15-18` (three message strings)
- Modify: `app/src/ui/OpenReviewPanel.tsx:85-89` (split em-dash sentence; "mount as a non-editable session" → "open in read-only review mode"; "gated off" → plain language)
- Modify: `app/src/ui/OpenReviewPanel.test.tsx`
- Modify: `app/src/ui/OpenReviewPanel.stories.tsx` (re-snap stories with new copy if any visual gold)

**Item D — Per-panel error and helper-text rewrites:**
- Modify: `app/src/ui/CounterSignPanel.tsx:41` (default fallback "Sign failed" → recovery-hint string)
- Modify: `app/src/ui/CounterSignPanel.tsx:50` ("Sign & export patch" → "Sign and send your decisions")
- Modify: `app/src/ui/ShareReviewPanel.tsx:37` (passphrase length error → field helper text "16+ characters" rendered before submit)
- Modify: `app/src/ui/ShareReviewPanel.tsx:62-65, 71` ("Generates an expiring, key-protected `.lgreview` file." + "Requires a signed pack to share." rewrites)
- Modify: `app/src/ui/DeltaPanel.tsx:33` (raw `err.message` → `clarifyError(err, { context: 'delta-export' })`)
- Modify: `app/src/ui/MarketplacePanel.tsx:54, 79` (manifest + install error fallbacks via `clarifyError`)
- Modify: `app/src/ui/AppCurrentPane.tsx:178-183` (OCR error reflow — recovery first, raw reason in `<small>`; preserve Wave 45-D disclosure structure above)
- Modify: `app/src/i18n/messages.ts:35, 41` (split `findings.empty` into pre/post-analyze keys; route `status.error` via `clarifyError` consumers)
- Modify: corresponding `*.test.tsx` siblings for each panel above

**Item E — Documentation refresh:**
- Modify: `docs/audits/clarify-inventory-2026-04-29.md` — add a "Slice 1 shipped — Wave 47" header note pointing at the merged PR; do **not** modify rows (the inventory is the historical baseline).
- Modify: `docs/CLAUDE.md` — testing-patterns guidance for Dialog-driven replacements (see §1.5).
- Modify: `docs/BACKLOG.md` — add rows for the deferred items (VersionHistoryPanel confirm, MIN_PASSPHRASE_LEN promotion, Slice 2, Slice 3).

## §4 Item ordering

1. **A first.** `clarifyError` lands with full test coverage and one consumer migrated. This unblocks D since most D-items are one-line `clarifyError(err)` replacements.
2. **D in parallel with A's tail.** Pure copy edits across panels — independent files, no merge conflicts.
3. **C parallel with D.** `OpenReviewPanel` is a self-contained surface.
4. **B last.** Dialog migration is the largest behavioral change and the riskiest test-rewrite. Land after A/C/D are green so a Dialog-trap regression isn't entangled with copy edits.
5. **E last.** Doc/backlog refresh after code is green; updates the inventory header pointing at the merged PR.

## §5 Storybook

- `OpenReviewPanel.stories.tsx`: add a `WrongPassphrase` story that renders the new REASON_MESSAGES copy.
- `SigningKeyPanel.stories.tsx`: add a `CreateKeyDialogOpen` story showing the Dialog with the new passphrase Field + recovery-loss warning.
- `ShareReviewPanel.stories.tsx`: add a `PassphraseTooShort` story showing the helper text before submit.
- `MarketplacePanel.stories.tsx`: add an `InstallFailed` story exercising the new fallback.

(One new story per panel, mirroring Wave 45-A's pattern. The all-stories
axe sweep in `src/ui/__tests__/all-stories.a11y.test.tsx` will pick them
up automatically.)

## §6 Verification gates

1. **Inventory cross-check.** Every Slice 1 row in
   `docs/audits/clarify-inventory-2026-04-29.md` either (a) has a code
   change in this PR, (b) is explicitly listed in §2 Out of scope with
   a backlog row, or (c) has a documented decision in the PR body.
2. **Wave 45-D string protection.** A repo-grep gate (added to the verify
   workflow or as a Vitest policy test under
   `app/src/test/clarify-immutable.policy.test.ts`) asserts the canonical
   Wave 45-D strings still appear verbatim. Tested strings: AuditLogPanel
   preamble first sentence, AppCurrentPane signed-export disclosure
   summary, FindingsPanel similarity-badge aria-label.
3. **No native browser dialogs on renter paths.** Repo-grep policy test
   asserts `window.prompt(` and `window.confirm(` no longer appear in
   `app/src/App/appHelpers.ts` or `app/src/ui/SigningKeyPanel.tsx`. (Other
   files may retain them transiently — Wave 48 can finish the sweep.)
4. **`clarifyError` coverage.** Module hits 100% branch coverage in
   `clarifyError.test.ts`.
5. **Real-browser a11y gate.** `npx playwright test tests/e2e/a11y.spec.ts`
   green — covers the four new Dialog mount points against axe + the
   focus-trap × `inert` interaction landed in Wave 46-D.
6. **Codex adversarial gate.** ≥3 passes; every plain-language error
   claim maps to a code-verifiable property (e.g. "That passphrase
   didn't unlock the file" must only fire on the `wrong-passphrase`
   reason path, never on a structural decode failure).
7. **Local gate.** `npm run typecheck && npm run lint && npm run test:coverage`
   green; coverage floor unchanged.

## §7 Risks and mitigations

- **Test-rewrite churn from Dialog migration.** Mitigation: do Item B last; keep each rewrite to one file at a time; commit per file.
- **Codex magnet on passphrase / signing copy.** Mitigation: per-string code-property mapping table in the PR body before the first Codex run; budget for 3 passes.
- **Wave 45-D regression risk.** Mitigation: §6 gate #2 grep test runs in CI on every commit.
- **Locale-file drift.** Mitigation: confine i18n changes to keys; existing locale files get the new keys with English fallbacks; backfill is a separate ticket.
- **Subtle behavioral change in `clearAll` confirm.** The current `window.confirm` blocks the JS thread; a Dialog yields control. Mitigation: existing `clearAll` callers don't depend on synchronous return — verify before merging.

## §8 Success definition

Renter on the destructive / signing / review-archive paths sees, in this
order:
- A styled in-app Dialog (not a native browser prompt) for every
  passphrase entry and every destructive confirm.
- Plain-language error messages with a recovery hint on every failure
  surface listed in Slice 1.
- A passphrase field with visible "16+ characters" helper text **before**
  they submit a too-short passphrase.

Practitioner sees the same — practitioner views inherit the renter
copy under the design north-star ("if the renter understands the screen,
the practitioner can always go faster").

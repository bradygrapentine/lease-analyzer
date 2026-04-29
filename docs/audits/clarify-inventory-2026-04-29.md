# LeaseGuard Copy Clarity Inventory — 2026-04-29

Read-only audit of UI copy across `app/src/ui/*.tsx` and `app/src/App/*.tsx`,
anchored to PRODUCT.md ("clear, calm, informative; plainspoken where the law
is plainspoken; never cheerful, never alarming, never coy") and DESIGN.md
("plain language outranks legal language", "severity is never color-only").

Wave 45-D (commit cb506e9, merged 2026-04-24) is treated as a hard floor —
strings it touched (FindingsPanel `~`/similarity badge, AuditLogPanel
preamble, AppCurrentPane + SigningKeyPanel signed-export `<details>`,
PackManagerPanel error, OnboardingTour audit-log step) are flagged only
where a separate axis (e.g. CTA generic-ness, missing-context) recurs.

## Summary

- **Files audited:** 44 panel/shell .tsx files + `i18n/messages.ts` + `App/useAppCallbacks.ts` + `App/usePackManager.ts` + `App/appHelpers.ts`.
- **Strings flagged:** 47 (High: 9 / Medium: 23 / Low: 15).
- **Surfaces with the highest concentration of issues:**
  1. `OpenReviewPanel.tsx` — passphrase + archive flow, every error string is technical and most CTAs are non-specific.
  2. `CustomRuleBuilderPanel.tsx` — practitioner-only, but raw errors ("Regex compile error: …") and unlabeled save with no validation mirror.
  3. `DeltaPanel.tsx` / `ShareReviewPanel.tsx` / `CounterSignPanel.tsx` — passphrase / signing flow share a vocabulary problem (passphrase length is silent until submit; failure surfaces are generic).
  4. `OnboardingTour.tsx` — copy is on-voice but step 2 still says "Critical / Warning / Info" while the rest of the app says "High / Medium / Low / Info" (severity vocabulary drift).
  5. `App/useAppCallbacks.ts` + `appHelpers.ts` — `window.prompt` / `window.confirm` are used for passphrases and destructive confirmation; copy is one line and renter-hostile.
- **Already-strong surfaces (post Wave 45-D):**
  - `FindingsPanel` similarity badge + `aria-label` (Wave 45-D).
  - `AuditLogPanel` preamble explaining what the chain does and doesn't prove (Wave 45-D).
  - `AppCurrentPane` + `SigningKeyPanel` "What is signed export?" disclosure (Wave 45-D).
  - `BulkImportPanel` live-region progress + closing summary (Wave 45-F is recent and clear).
  - `AppHeader` privacy disclosure list — concrete, calm, audited.

## Findings by surface

### App shell — header / footer / pane (`app/src/App/`)

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| H | confirm | App/appHelpers.ts:235 | `window.confirm('Delete all saved leases from this device? This cannot be undone.')` | Native `confirm()` is unstyled, off-voice, and doesn't name the count. Renter-hostile destructive flow. | Replace with Dialog primitive; name count + lease names |
| H | error | App/useAppCallbacks.ts:60 | `Could not load sample (${res.status})` | HTTP status is renter-jargon; no recovery path | "Couldn't load the sample lease. Refresh and try again." |
| H | confirm | App/appHelpers.ts:179,204 | `window.prompt('Passphrase for the encrypted archive:')` | Native prompt; no min-length / strength hint; no explanation what passphrase protects | Replace with Dialog + Field + min-length helper text |
| M | error | App/useAppCallbacks.ts:129 | `Signing failed: ${friendlyError(err)}` | Bubble of raw Error.message; "Signing failed" is verb-first but offers no next step | Distinguish wrong-passphrase from other failures; suggest "try the passphrase again" vs. "your key may be missing" |
| M | error | App/appHelpers.ts:24-28 | `friendlyError` returns `err.message` verbatim | "Friendly" wrapper is a passthrough; raw browser/IDB messages reach renters | Map known error classes to plain-language strings |

### `AppHeader.tsx`

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| L | help | AppHeader.tsx:56 | "LeaseGuard is not legal advice. Findings are heuristic pattern matches." | "Heuristic" is jargon for renters; everything else in this list is plain | "…are computer-generated suggestions, not lawyer review." |

### `AppCurrentPane.tsx`

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| M | error | AppCurrentPane.tsx:178-183 | "OCR didn't finish reading this PDF. The error was: {message}…" | Embeds raw error mid-sentence; long passive sentence | Lead with what to do; quote the technical reason at the end as small print |
| L | help | AppCurrentPane.tsx:159-161 | "This PDF looks scanned (avg N chars/page). Text extraction may be incomplete." | "chars/page" is a debug detail | Drop the parenthetical for renters; keep behind a `details` for practitioners |

### `FindingsPanel.tsx`

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| H | empty | FindingsPanel.tsx:143 | "No findings yet. Upload a lease to analyze." | OK but the same panel mounts when filters hide everything; renter sees this instead of "0 of 12 match your filters" | Branch: `findings.length === 0` vs. `visible.length === 0 && findings.length > 0` |
| M | label | FindingsPanel.tsx:438-444 | "deviates from verified pack" | Renter doesn't know what a "pack" is; "verified" is overloaded with the signing flow | "Differs from the standard rule we shipped" or expose only to practitioner mode |
| M | label | FindingsPanel.tsx:435 | "(possibly not applicable)" | Vague — possibly per what? | "This clause appears to be negated (e.g. 'shall not')" |
| L | label | FindingsPanel.tsx:511 | "Above the 70% similarity floor" | Mixes concept (floor) with number; renter has no anchor | "70% is the cutoff for showing this match" |

### `AnnotationsPanel.tsx`

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| M | empty | AnnotationsPanel.tsx:40 | "Click a finding to attach a note." | Implies there is a finding open already; when nothing is selected this is dead-end advice for a renter scanning the panel | "Open a finding above to add notes about it." |
| L | empty | AnnotationsPanel.tsx:68 | "No notes yet for this paragraph." | OK; could be warmer | Keep |

### `CounterOfferPanel.tsx`

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| M | label | CounterOfferPanel.tsx:60 | "Select a finding to see or add counter-offers." | "Counter-offer" is practitioner jargon — renter needs the term grounded once | Add one-line plain reading: "alternative wording you'd ask the landlord to use" |
| L | label | CounterOfferPanel.tsx:81 | `For rule: {finding.title}` | Practitioner-flavored "rule"; renter sees the title twice elsewhere | "About: {title}" |

### `AuditLogPanel.tsx`

(Preamble is Wave 45-D; leave it.)

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| M | header | AuditLogPanel.tsx:91 | column header "Kind" | Internal type-system word ("Kind") leaks to user UI; "Action" is the user-facing concept | Rename column header to "Action" |
| M | content | AuditLogPanel.tsx:104 | `{e.kind}` rendered raw (e.g. `analyze`, `delete-lease`, `hybrid-feedback`) | Slug strings shown to renter | Map kinds to plain labels ("Analyzed lease", "Deleted lease", "Marked finding not relevant") |
| L | content | AuditLogPanel.tsx:107 | `summarizePayload` JSON-truncated | Renter can't read JSON | Keep behind a "show raw" toggle; render kind-specific summaries by default |

### `BulkImportPanel.tsx`

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| L | label | BulkImportPanel.tsx:164 | "Skipped (duplicate)" | Clear; could name what was duplicated | "Skipped — same content as a saved lease" |
| L | progress | BulkImportPanel.tsx:104 | "Processing… imported N · skipped N · errors N" | OK; the leading "Processing…" is technically accurate but tonally bureaucratic | "Working through your files — N imported · N skipped · N errors" |

### `OcrLanguagePickerPanel.tsx` / OCR strings (also see AppCurrentPane)

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| L | label | AppCurrentPane.tsx:174 | `Running OCR: {stage} ({pct}%)` | "OCR" is jargon for renters | "Reading scanned text: {stage} ({pct}%)" |

### `PackManagerPanel.tsx`

(Wave 45-D touched the import-error string; preserve.)

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| M | label | PackManagerPanel.tsx:56,127 | Badge: "Community" / "Verified" / "Invalid signature" / "Unknown" | "Community" is opaque to renters — implies people, not absence-of-signature | Re-label "Community" → "Unsigned" with tooltip explaining what verification adds |
| L | empty | PackManagerPanel.tsx:147 | `<em>No additional packs installed.</em>` | OK; italic + plain. Could name the next action | "No additional packs installed. Browse included packs to add one." |

### `SigningKeyPanel.tsx`

(Disclosure body is Wave 45-D; preserve.)

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| H | confirm | SigningKeyPanel.tsx:78,102 | `window.prompt('Set a passphrase for the new signing key:')` | Native prompt; no length floor, no warning that lost passphrase = lost key | Replace with Dialog + Field + recovery-loss warning |
| L | empty | SigningKeyPanel.tsx:70 | "No signing key." | Terse; renter doesn't know what creating one buys | "No signing key yet. Create one to sign exports — see 'Why does signing matter?' above." |

### `OpenReviewPanel.tsx`

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| H | error | OpenReviewPanel.tsx:15 | `'wrong-passphrase': 'Wrong or incorrect key — check what you typed.'` | "Wrong or incorrect" is redundant; "key" conflates passphrase with cryptographic key | "That passphrase didn't unlock the file. Try again." |
| M | error | OpenReviewPanel.tsx:17 | "Missing rule pack — install the matching signed pack." | Doesn't say which pack | "This review needs the rule pack '{packId}', which isn't installed yet." |
| M | error | OpenReviewPanel.tsx:18 | "This file is not a LeaseGuard review archive." | Negative-framed; doesn't suggest fix | "We couldn't read this file as a LeaseGuard review. It may be the wrong file or damaged." |
| L | help | OpenReviewPanel.tsx:85-89 | "…The lease will mount as a non-editable session — your audit log records this session separately and writes back to the original lease are gated off." | Two clauses joined with em-dash; "mount", "gated off" are dev-speak | Two short sentences; replace "mount as a non-editable session" with "open in read-only review mode" |

### `ShareReviewPanel.tsx`

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| M | error | ShareReviewPanel.tsx:37 | `Passphrase must be at least ${MIN_PASSPHRASE_LEN} characters.` | Surfaces only after submit; helper text on the field would prevent the error | Add helper text under field: "16+ characters" |
| M | error | ShareReviewPanel.tsx:71 | "Requires a signed pack to share." | Renter doesn't know what a signed pack is or how to get one | "You need a signed rule pack to share — open Rule packs to install one." |
| L | label | ShareReviewPanel.tsx:62-65 | "Generates an expiring, key-protected `.lgreview` file." | "Key-protected" + ".lgreview" are jargon | "Creates a passphrase-protected file that expires on the date below. Recipient opens it locally — nothing leaves your device." |

### `CounterSignPanel.tsx`

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| H | error | CounterSignPanel.tsx:41 | `'Sign failed'` (default fallback) | Bare phrase; no recovery | "We couldn't sign the patch. Check the passphrase and try again." |
| M | label | CounterSignPanel.tsx:50 | "Sign & export patch" | "Patch" is dev jargon; the user just made decisions on edits | "Sign and send your decisions" |
| L | label | CounterSignPanel.tsx:52 | `<span aria-label="archive fingerprint">{slice(0,12)}…</span>` | Bare hex without context | Prefix "Reviewing archive:" or similar |

### `DeltaPanel.tsx`

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| M | help | DeltaPanel.tsx:56 | "Pick two saved versions to produce a signed `.lgdelta` patch the recipient can verify and apply on their local copy." | "Patch", "apply on their local copy" — practitioner OK but exposes file extension | Plain reading first, "(file ends in .lgdelta)" parenthetical |
| M | error | DeltaPanel.tsx:33 | `setError(err instanceof Error ? err.message : String(err))` | Raw Error.message reaches user | Branch on known failures; fall back to "Something went wrong creating the delta. Check the passphrase and try again." |

### `CustomRuleBuilderPanel.tsx` (practitioner-only, but still flag)

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| H | error | CustomRuleBuilderPanel.tsx:321 | "Regex compile error: {raw}" | Raw browser error; no example | Surface the raw error in `<small>` and lead with "The pattern isn't a valid regular expression." |
| M | label | CustomRuleBuilderPanel.tsx:114 | `<h2>Custom rule builder</h2>` (no introductory copy) | Practitioner can guess but new users land cold | One-paragraph intro: "Define a clause-matching rule. The preview at the bottom fires it against the loaded lease." |
| M | label | CustomRuleBuilderPanel.tsx:272-274 | "Preview unavailable." / "Fires at N location(s)." / "Does not fire on the loaded document." | "Fires" is dev jargon; "unavailable" without reason | "Matches N place(s)." / "No matches in this lease." / "Preview hidden until the rule is valid." |
| L | empty | CustomRuleBuilderPanel.tsx:128 | `A rule with id "{form.id}" already exists.` | Quotes around id but no fix path | "The id '{form.id}' is already used. Pick another id." |

### `MarketplacePanel.tsx`

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| M | error | MarketplacePanel.tsx:54 | `'failed to load manifest'` (lowercase fallback) | Sentence-case mismatch; "manifest" is dev jargon | "Couldn't load the curated pack list." |
| M | error | MarketplacePanel.tsx:79 | `'install failed'` (fallback) + `Install failed: {message}` | Generic, lowercase fallback, no recovery | "Couldn't install '{name}'. {message}" |
| L | label | MarketplacePanel.tsx:153 | "View diff vs current" | "Diff" is dev jargon | "See what changes" |

### `LibraryPanel.tsx` / `JurisdictionPickerPanel.tsx` / `TemplatesPanel.tsx` / `HybridPrecisionPanel.tsx`

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| L | empty | LibraryPanel.tsx:37 | "No saved leases yet." | OK; could name action | "No saved leases yet. Upload a PDF above to start." |
| L | empty | JurisdictionPickerPanel.tsx:64 | "No jurisdictions selected — all rules run regardless of regional tags." | "Regional tags" is jargon | "No state/city selected. Every rule runs." |
| L | empty | TemplatesPanel.tsx:62 | "No clause templates saved yet." | OK | Keep |
| L | empty | HybridPrecisionPanel.tsx:39 | "No hybrid feedback yet" | "Hybrid" is internal jargon (Phase 18 ML pipeline name) | "No 'not relevant' feedback recorded yet." |

### `ClauseSimilarityPanel.tsx`

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| L | empty | ClauseSimilarityPanel.tsx:28 | "No clause clusters yet — analyze two or more leases to see overlap." | "Clusters" is data-science jargon | "Save two or more leases to see clauses that repeat across them." |

### `OnboardingTour.tsx`

(Wave 45-D updated step 4. Preserve.)

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| H | content | OnboardingTour.tsx:32-35 | "Each finding is tagged Critical / Warning / Info…" | Severity vocabulary drift — the rest of the app uses High / Medium / Low / Info per FindingsPanel.tsx:37-42 and DESIGN.md `severity-*` tokens | "High / Medium / Low / Info" |
| L | label | OnboardingTour.tsx:111 | aria-label="skip onboarding tour" + visible "Skip" | OK but Skip is ambiguous mid-flow vs. dismiss | Keep (Wave 45-F just added Dialog primitive; tour copy itself is fine) |

### `RedlinePanel.tsx`

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| M | empty | RedlinePanel.tsx:84 | "Upload a lease to start editing." | The redline view is reachable from a lease — but if the lease was cleared the message offers no next step | "No lease loaded. Upload one or open a saved lease from the library." |
| L | label | RedlinePanel.tsx:115 | "Export redlined HTML" | "Redlined" is legalese — but here it's accurate to the feature | Keep; it's a practitioner-mode panel |

### `SideLetterPanel.tsx`

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| L | label | SideLetterPanel.tsx:43-44 | `{N} proposed change(s)` | OK | Keep |
| L | label | SideLetterPanel.tsx:38 | `<h2>Side letter</h2>` | "Side letter" is a term of art (a separate signed agreement); renters won't know | One-line plain reading under the h2: "A short signed letter requesting these changes alongside the lease." |

### `VersionHistoryPanel.tsx`

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| M | confirm | VersionHistoryPanel.tsx:105-110 | `aria-label="delete version {label}"` + button "Delete" — no confirmation | Destructive action without confirm or naming target visibly | Add Dialog confirm naming the version + edit count |
| L | empty | VersionHistoryPanel.tsx:74 | "No versions saved yet." | OK | Keep |

### `StandardSuitePanel.tsx`

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| L | empty | StandardSuitePanel.tsx:15 | "No standards yet. Promote a clause from a lease to start your suite." | "Suite" is the internal product word | "No standard clauses yet. From any finding, click 'Promote to standard' to add one." |

### `ComparePanel.tsx`

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| L | help | ComparePanel.tsx:42-44 | "These leases were analyzed under different rule-pack versions (A: vX, B: vY). Differences may reflect rule changes rather than content changes." | Solid practitioner copy | Keep |
| L | empty | ComparePanel.tsx:56 | "No differences in findings between these leases." | OK; could be warmer | Keep |

### i18n (`app/src/i18n/messages.ts`)

| Sev | Genre | Location | Current | Diagnosis | Suggested direction |
|---|---|---|---|---|---|
| M | error | messages.ts:35 | `status.error: 'Could not analyze this file: {message}'` | Generic; no triage between "wrong file type" / "password protected" / "OCR needed" | Map known PdfErrors to specific keys (already partially handled in code) |
| L | empty | messages.ts:41 | `findings.empty: 'No findings yet.'` | Same string used for 0-findings and pre-analyze; ambiguous | Add `findings.empty.preAnalyze` and `findings.empty.zeroAfterAnalysis` |

## Cross-cutting patterns

- **Native `window.prompt` / `window.confirm` for passphrase + destructive flows.** AppHelpers `clearAll`, archive export/import, and SigningKeyPanel create/rotate all use them. Off-voice, unstyled, no helper text, no min-length feedback. With Wave 45-F's Dialog/FileButton primitives shipped, every one of these has a primitive available now.
- **`error.message` passthroughs.** `friendlyError()` is a misnomer — it returns `err.message` verbatim. PackManager, Marketplace, Delta, CounterSign, Signing all surface raw browser/IDB strings. Inconsistent capitalization too ("install failed" lowercase vs. "Import failed:" capitalized).
- **Internal slug strings rendered to users.** AuditLogPanel kind column shows `analyze` / `delete-lease` / `hybrid-feedback`. PackManager shows raw `id`. CustomRuleBuilder echoes regex pattern errors. These leak the data model.
- **Severity vocabulary drift.** OnboardingTour says "Critical / Warning / Info"; the actual FindingsPanel uses "High / Medium / Low / Info" (DESIGN.md severity tokens are `severity-high/medium/low/info`). Renter sees two vocabularies in one session.
- **Empty states without next-action.** AnnotationsPanel, LibraryPanel, JurisdictionPickerPanel, StandardSuitePanel, HybridPrecisionPanel, TemplatesPanel — most empty states declare absence without naming the action that fills them.
- **"Pack" / "diff" / "patch" / "manifest" / "kind" / "fires" / "regex" / "OCR" / "fingerprint"** appear unwrapped on renter-reachable surfaces. PRODUCT.md §"Plain language outranks legal language" applies equally to dev-speak.
- **Aria-label / visible-label divergence.** FindingsPanel.tsx:466 has the rich Wave 45-D aria-label "Identified by on-device similarity match (similarity X%). Click to see details." while the visible label is "On-device similarity match" — fine. But across the app several aria-labels are lowercase slugs ("counter-offers", "audit log", "rule packs") that match section headings rendered in `text-heading uppercase`; consistent but worth normalizing in a sweep.

## Recommended slicing

### Slice 1 — Renter-facing error and confirmation copy (High-value, contained)
- **Surfaces:** `App/useAppCallbacks.ts`, `App/appHelpers.ts`, `OpenReviewPanel.tsx`, `ShareReviewPanel.tsx`, `CounterSignPanel.tsx`, `MarketplacePanel.tsx`, `DeltaPanel.tsx`, `i18n/messages.ts`.
- **High/Medium counts:** 5 H / 9 M.
- **Risk of churning Wave 45-D work:** Low — none of these strings overlap with cb506e9.
- **Rationale:** Replace `friendlyError` passthrough with a small error→plain-string mapper, route the four `window.prompt` / `window.confirm` callsites through the Wave 45-F Dialog primitive, and rewrite the `OpenReviewPanel.REASON_MESSAGES` table. This is a single PR's worth of work and removes the highest-impact renter blockers (cryptic errors with no recovery hint, native browser dialogs in the destructive path). One migration helper carries most of the leverage.

### Slice 2 — Audit-log + onboarding vocabulary normalization
- **Surfaces:** `AuditLogPanel.tsx` (column header + kind→plain-label map), `OnboardingTour.tsx` (severity vocabulary fix), `FindingsPanel.tsx` ("deviates from verified pack" + "negated" labels), `PackManagerPanel.tsx` ("Community" → "Unsigned" badge label).
- **High/Medium counts:** 1 H / 6 M.
- **Risk of churning Wave 45-D work:** Medium — touches `AuditLogPanel.tsx` and `OnboardingTour.tsx`, both of which Wave 45-D edited. The preamble paragraph and the audit-log step body must stay verbatim; only the column header, the kind→label adapter, and step 2's severity vocabulary change.
- **Rationale:** The single highest-confusion item for a renter scanning the audit log is seeing `delete-lease` instead of "Deleted lease". This is also where the severity vocabulary drift in OnboardingTour bites. One narrow PR with a kind-to-label adapter + a 3-word fix in OnboardingTour step 2 + the badge rename. Test impact is contained because tests query by aria-label, not visible text.

### Slice 3 — Empty states, helper text, plain-reading wraps for jargon
- **Surfaces:** `AnnotationsPanel.tsx`, `CounterOfferPanel.tsx`, `LibraryPanel.tsx`, `JurisdictionPickerPanel.tsx`, `StandardSuitePanel.tsx`, `HybridPrecisionPanel.tsx`, `ClauseSimilarityPanel.tsx`, `RedlinePanel.tsx`, `ShareReviewPanel.tsx` (helper text), `SideLetterPanel.tsx`, `CustomRuleBuilderPanel.tsx` intro + preview labels.
- **High/Medium counts:** 1 H / 6 M / 8 L.
- **Risk of churning Wave 45-D work:** Low — none of these surfaces overlap with cb506e9.
- **Rationale:** Lowest individual impact per string but the largest total surface; reads as a "polish pass" rather than a critical fix. Save for after Slices 1 and 2. The CustomRuleBuilder regex-error rewrite is the only High in this slice and could be promoted into Slice 1 if practitioner UX is in scope.

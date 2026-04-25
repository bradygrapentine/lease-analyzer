# Wave 9 — Collaboration escape hatches (Phase 15)

**Goal:** turn LeaseGuard's local-first primitives (signed reports,
replay bundles, hash-chained audit log, multi-key signing) into a way
to hand a lease to a co-tenant, lawyer, or counterparty without
breaking the local-first contract. Wave 9 ships Phase 15's four
pillars: signed review links, counter-sign-and-return, delta packets,
and a privacy review doc + CLI surface.

## Pre-flight

1. Wave 8 fully merged; ROADMAP shows Phase 17 Done.
2. `cd app && npm run typecheck && npm run lint && npm test` is green.
3. `docs/SYSTEM_DESIGN.md` privacy contract still reads "no network egress
   after load" — Wave 9 must not regress that. All sharing happens via
   user-initiated file export; archives are opened by the recipient
   pasting/uploading, never fetched.

## Parts (parallel-safe; B has a soft dependency on A)

### Part A — Signed review links

**Branch:** `wave9-review-links`

**Files:**
- `app/src/storage/reviewArchive.ts` (new) — wraps a replay bundle in an
  AES-GCM encrypted envelope (passphrase via PBKDF2 → key); envelope
  carries `{packFingerprint, expiresAt, ciphertext, iv, salt, version}`
- `app/src/storage/reviewArchive.test.ts` (new) — round-trip, expiry
  rejection, wrong-passphrase rejection, malformed-envelope rejection
- `app/src/ui/ShareReviewPanel.tsx` (new) — pick a saved lease, set
  expiry, generate passphrase (or accept user-provided), download
  `.lgreview` file
- `app/src/ui/ShareReviewPanel.test.tsx` (new) — ≥4 cases (happy path,
  passphrase strength, expiry validation, signed-pack required)
- `app/src/ui/ShareReviewPanel.stories.tsx` (new)
- `app/src/ui/OpenReviewPanel.tsx` (new) — drop/upload `.lgreview`,
  prompt for passphrase, verify expiry + that the recipient has the
  matching signed pack installed (use Wave 8-A's marketplace + Wave 8-B's
  baseline checks); mount the lease in **read-only review mode**
- `app/src/ui/OpenReviewPanel.test.tsx` (new) — ≥4 cases (open ok,
  wrong passphrase, expired, missing pack)
- `app/src/App/useReviewMode.ts` (new) — context hook that surfaces a
  `reviewMode: { active: true, archiveId, expiresAt } | { active: false }`
  flag for downstream panels (Part B reads this)

**Tests / verify:**
- Round-trip: encrypt → decrypt → byte-identical bundle.
- Tampered ciphertext (single bit flip) → AES-GCM auth failure.
- Expired archive (now > expiresAt) → opener refuses with clear error.
- Read-only enforcement: in review mode, `safeAudit` writes are gated
  off (or routed to a separate "review-session" audit store —
  implementer's call, document in the panel).
- No network egress: `reviewArchive.ts` and both panels contain zero
  `fetch` / `XMLHttpRequest` calls.

**Out of scope:** server-side share-link hosting, real-time co-editing,
multi-recipient archives.

### Part B — Counter-sign-and-return

**Branch:** `wave9-counter-sign`

**Files:**
- `app/src/redline/redlinePatch.ts` (new) — given a review-mode session
  + per-edit accept/reject decisions + recipient's signing key, emit
  signed `redline.patch.json`: `{archiveFingerprint, decisions[],
  signature, signedByKeyId, signedByPublicKey}`
- `app/src/redline/redlinePatch.test.ts` (new) — emit + verify; reject
  decisions referencing non-existent edits; signature covers the
  canonical decisions list
- `app/src/redline/applyPatch.ts` (new) — author imports patch, verifies
  signature against the embedded public key, checks `archiveFingerprint`
  matches the archive they originally generated, applies accepted edits
  to `RedlineEdit` store, writes one audit entry
  (`kind: 'patch-applied'`)
- `app/src/redline/applyPatch.test.ts` (new) — successful apply,
  rejected on bad signature, rejected on archive-fingerprint mismatch,
  audit entry written exactly once
- `app/src/ui/RedlinePanel.tsx` — when `reviewMode.active`, render an
  Accept/Reject toggle next to each edit, plus a "Sign & export patch"
  button at the bottom (mounts a small `CounterSignPanel`)
- `app/src/ui/CounterSignPanel.tsx` (new) — prompts for passphrase,
  produces the `.lgpatch` download
- `app/src/ui/CounterSignPanel.test.tsx` (new)

**Tests / verify:**
- Patch round-trip: opener accepts 3 of 5 edits → author imports →
  exactly those 3 edits land in `RedlineEdit` store.
- Patch signed with rotated key still verifies after author rotates
  their own key (Wave 8-D semantics: retired keys remain
  verification-only).
- A `kind: 'patch-applied'` audit entry is appended on apply, with
  `payload: { archiveFingerprint, acceptedEditIds[] }`.

**Soft dependency on A:** `RedlinePanel.tsx` reads `useReviewMode`
from Part A. Implement against the spec's expected hook shape; rebase
onto A at merge time.

**Out of scope:** multi-round negotiation state machine, automatic
re-resolve of conflicting edits, partial-acceptance UI for split edits.

### Part C — Delta packets

**Branch:** `wave9-delta-packets`

**Files:**
- `app/src/versioning/deltaPacket.ts` (new) — diff two `LeaseVersion`
  records → signed `{baseInputHash, targetInputHash, changes[],
  rulePackVersion, signature, signedByKeyId}`. `changes[]` is a
  text-diff (line-level) over the canonicalized lease bytes
- `app/src/versioning/deltaPacket.test.ts` (new)
- `app/src/versioning/applyDelta.ts` (new) — verify signature, check
  `baseInputHash` matches recipient's local copy, apply line patch,
  re-run `analyze` to surface findings on the patched copy
- `app/src/versioning/applyDelta.test.ts` (new)
- `app/src/ui/DeltaPanel.tsx` (new) — pick base + target version from
  history, generate `.lgdelta` download
- `app/src/ui/DeltaPanel.test.tsx` (new) + `.stories.tsx` (new)
- `app/src/ui/OpenDeltaPanel.tsx` (new) — drop `.lgdelta`, verify
  signature, preview changes, accept-and-merge button

**Tests / verify:**
- Round-trip: diff(v1, v2) → apply to recipient's v1 → recipient's
  state = v2 (line-identical).
- `baseInputHash` mismatch (recipient on a different version) →
  applyDelta refuses with a clear "version mismatch" error.
- Signed delta verifies under Wave 8-D rotated keys.

**Out of scope:** 3-way merge, semantic-diff (we ship line-diff only),
auto-conflict resolution.

### Part D — Share-link privacy review + CLI verifier

**Branch:** `wave9-privacy-review`

**Files:**
- `docs/SYSTEM_DESIGN.md` — add "Collaboration escape hatches"
  subsection: archive format (envelope fields, AES-GCM + PBKDF2
  parameters), what is and is NOT included (no telemetry, no key
  escrow, no IDB dump beyond the chosen lease, no network), expiry
  semantics, recipient-trust model
- `docs/REPRODUCIBILITY.md` — add a section on verifying a review
  archive from the CLI without the in-app UI
- `cli/src/openReview.ts` (new) — `leaseguard-open-review
  <archive.lgreview> --passphrase <pp>` extracts the inner replay
  bundle to stdout (or a path), exits 1 on auth failure / expired
- `cli/src/openReview.test.ts` (new) — uses an in-test fixture from
  Part A's `reviewArchive.ts` (fixture script in `cli/scripts/`)
- `cli/src/index.ts` — register the new subcommand
- `cli/README.md` — document the subcommand

**Tests / verify:**
- CLI extracts a valid archive byte-identical to what the in-app
  decoder produces.
- CLI exits 1 on wrong passphrase, expired archive, tampered envelope.
- No network egress in the CLI path.

**Out of scope:** external security audit, formal threat-model
document, CLI for patch / delta application (Phase 15 follow-up).

## Merge order

A is foundational (Part B reads `useReviewMode` from A). C and D are
fully independent of A and B. D includes a CLI test that depends on
Part A's `reviewArchive.ts` shape — use `import type` in the test, and
rebase D onto A at merge time.

Suggested order: **A → B → C → D**. C can interleave anywhere after A
ships.

## TDD recommendation

Run as `/tdd-wave 9`. Wave 9 is security-critical (passphrase-gated
encryption, signature verification, audit-trail integrity); spec-first
catches "implementer took creative liberty with the envelope shape" at
red-test time instead of post-merge.

## Done definition

- All four PRs merged.
- ROADMAP Phase 15 moves from "Forward phase" to "Done"; new forward
  phases (if any) added.
- BACKLOG gains Phase 15 section with all four items ticked +
  footprint refreshed (new IDB store if added; new CLI subcommand).
- `docs/SYSTEM_DESIGN.md` has the new "Collaboration escape hatches"
  subsection with the privacy contract spelled out.
- Privacy contract re-affirmed: zero network egress, including all
  three sharing surfaces.

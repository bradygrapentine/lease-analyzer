# Wave 46 — Wave-45 Program Closeout Implementation Plan

**Goal.** Land the four code-level follow-ups deferred during the Wave 45 impeccable program: audit-log the signed-export event so the audit chain reflects what the UI claims, surface clipboard-write status for `Export public key`, add a SHA-256 fingerprint affordance to `SigningKeyPanel` so renters have a practical out-of-band verification artifact, and close the focus-containment gap left by Wave 45-F by applying `inert` to the background while a Dialog is open. After this wave, every clarify-pass copy claim shipped in 45-D maps to a code-verifiable behavior.

**Architecture.** No new primitives. Item A extends `useAppCallbacks.onExportSignedJson` to emit a `safeAudit` event; the audit-log type union grows by one `kind`. Item B returns a discriminated status from `onExportPublicKey` and renders a transient `role="status"` confirmation in `SigningKeyPanel`. Item C adds a fingerprint row computed via `crypto.subtle.digest('SHA-256', rawPublicKeyBytes)` truncated to the first 4 bytes (8 hex chars) plus a copy affordance, then refreshes the signed-export disclosure copy in `AppCurrentPane/ResultsHeader.tsx` to reference fingerprint compare. Item D applies the `inert` HTML attribute to siblings of the open `<Dialog>` portal root inside the existing `Dialog` primitive — no API change.

**Tech Stack.** React 18 + TypeScript strict, Tailwind v4, Vitest + RTL, Storybook 8 CSF, `crypto.subtle` (already used elsewhere in the audit chain).

**Base SHA.** `origin/main` after Wave 45-BE merge. Verify `git fetch origin && git log origin/main --oneline -5` before branching; expected to include both `wave(45-c)` and `wave(45-be)` commits.

**Prerequisites.** Wave 45 program fully merged: 45-A, 45-D, 45-F, 45-C, 45-BE. Verify with `git log origin/main --oneline | grep -E "Wave 45-[ABCDFE]" | wc -l` == 5.

---

## §1 Hard rules

1. **One PR.** Whole wave on one feature branch `wave46-program-closeout`.
2. **No new dependencies.** Reuse `safeAudit`, `crypto.subtle`, existing system/ primitives. The `inert` attribute is a baseline HTML platform feature; no polyfill.
3. **Audit-event schema is additive.** Adding `kind: 'signed-export'` must not break existing `AuditLogPanel` rendering or hash-chain consistency checks. Verify by running the audit-chain test suite and asserting old entries still verify.
4. **Fingerprint is informational, not authoritative.** The disclosure copy must say "compare the fingerprint your recipient sees against the one shown here" — it must NOT claim the fingerprint authenticates identity, just that mismatch is evidence of substitution. Plan for ≥3 Codex passes (per memory: crypto copy magnetizes adversarial findings).
5. **`Export public key` clipboard status is per-attempt, transient.** The `role="status"` confirmation appears for ≤4 seconds after success; on failure (denied / no clipboard API), it stays until the next user action. Do not introduce a global toast system.
6. **`inert` on Dialog background must not break existing `useFocusTrap` Tab-cycle tests.** The trap continues to govern Tab; `inert` only blocks programmatic `.focus()` and click-through from outside the dialog.
7. **Real-browser a11y gate.** `npx playwright test tests/e2e/a11y.spec.ts` must pass — the `inert` change touches a11y semantics.
8. **Local gate green** (`npm run typecheck && npm run lint && npm run test:coverage`) before push.
9. **Codex adversarial gate** before `gh pr ready`. Findings on items A and C (crypto/audit copy) likely; address or escalate per project policy.

## §2 Out of scope

- Any new UI redesign in `AppCurrentPane/ResultsHeader` beyond the disclosure-copy refresh required by item C.
- Migrating other clipboard call sites (annotations export, summary copy) to the same status pattern. This wave only touches `Export public key`.
- Surfacing the fingerprint anywhere outside `SigningKeyPanel` and the signed-export disclosure (e.g., embedding in the signed-export filename or in `AuditLogPanel`). Defer to a Wave 47 ticket if requested.
- Replacing `inert` with a polyfill for older browsers. The project already targets evergreen browsers per `browserslist`.
- Closing the deferred `keys?` / `KeyHistoryEntry.fingerprint` plumbing the BACKLOG entry references — that's a separate refactor and not required to ship the user-visible fingerprint row here.

## §3 Files in scope

**Item A — Signed-export audit event:**
- Modify: `app/src/App/useAppCallbacks.ts` (add `safeAudit` call site in `onExportSignedJson`)
- Modify: `app/src/App/useAppCallbacks.test.ts`
- Modify: the audit-event type union (search for the union; likely in `app/src/audit/types.ts` or similar — verify before edit)
- Modify: `app/src/ui/AuditLogPanel.tsx` if the new `kind` needs explicit rendering; otherwise no UI change

**Item B — Clipboard status for `Export public key`:**
- Modify: `app/src/ui/SigningKeyPanel.tsx` (line 91 area — wrap the `onExportPublicKey` call site to track status)
- Modify: the `signingKey.exportKeyToClipboard` implementation (find via grep; lives under `app/src/keys/` or similar)
- Modify: `app/src/ui/SigningKeyPanel.test.tsx` (add success + clipboard-denied tests)
- Modify: `app/src/ui/AppLibraryAndPacksPane.tsx:249` (caller may need to thread the status return)

**Item C — Public-key fingerprint affordance:**
- Modify: `app/src/ui/SigningKeyPanel.tsx` (add fingerprint row + copy button)
- Create or modify: a small `app/src/keys/fingerprint.ts` with `computeShortFingerprint(rawPublicKeyBytes: Uint8Array): Promise<string>` returning 8 hex chars
- Create: `app/src/keys/fingerprint.test.ts`
- Modify: `app/src/ui/SigningKeyPanel.test.tsx` (assert fingerprint row + copy)
- Modify: `app/src/ui/SigningKeyPanel.stories.tsx`
- Modify: `app/src/ui/AppCurrentPane/ResultsHeader.tsx` (refresh signed-export disclosure copy to reference fingerprint compare)
- Modify: `app/src/ui/AppCurrentPane/ResultsHeader.test.tsx`

**Item D — Dialog `inert` background:**
- Modify: `app/src/ui/system/Dialog.tsx` (apply/remove `inert` on body siblings while open)
- Modify: `app/src/ui/system/Dialog.test.tsx` (assert background siblings receive `inert` while open and lose it on close)
- Modify: `app/src/ui/system/Dialog.stories.tsx` if needed (probably no change)

## §4 Execution

**Direct, single-track.** Estimated 4-6 hours including tests + Codex passes. Items A → B → D → C in that order: A and B are the smallest and exercise familiar surfaces; D unblocks future Dialog work without UI change; C is the largest and the most likely to attract Codex findings, so it lands last with the wave's polish budget.

### Item A — Signed-export audit event

**Why.** Wave 45-D's clarify pass asserted in copy that signed-export events appear in the audit log. Codex's pass `20260429T135619Z` flagged that they do not — the signing path emits no `safeAudit` entry. The wave shipped with the copy weakened to describe only what the code records; the durable fix is to record the event.

**Scope.**
- Locate the audit-event type union (`grep -rn "kind: 'unsigned-export'\|kind: 'sign'" app/src` to find existing kinds).
- Add `kind: 'signed-export'` with payload `{ fileName: string; format: 'json'; inputHash: string; signingKeyId: string }`. The `inputHash` is the SHA-256 of the unsigned payload (already computed during signing — reuse). The `signingKeyId` is the active key's id (already in scope inside `onExportSignedJson`).
- In `useAppCallbacks.onExportSignedJson`, after the signed download succeeds, call `safeAudit({ kind: 'signed-export', ... })`.
- If `AuditLogPanel` renders kind-specific labels, add a label for `signed-export` ("Signed export"); if it just shows raw kinds, no UI change is required.
- Verify hash-chain consistency: existing audit entries chain by `prevHash` — adding a new kind appends to the chain, doesn't rewrite it. Existing entries verify unchanged.

**Tests.**
- `useAppCallbacks.test.ts`: add a test that `onExportSignedJson` emits exactly one `safeAudit` call with the expected shape.
- Audit-chain consistency test: synthesize a chain with a `signed-export` entry interleaved with existing kinds; verify the chain still validates.
- `AuditLogPanel.test.tsx`: if a label was added, assert it renders.

**Commit.** `feat(46): emit signed-export audit event`.

### Item B — Clipboard status for `Export public key`

**Why.** The button at `SigningKeyPanel.tsx:91` calls `onExportPublicKey` (which calls `signingKey.exportKeyToClipboard`) and assumes success. `clipboard.writeText` can fail with `NotAllowedError` on permission denial or `undefined` `navigator.clipboard` on insecure contexts. Today's UI gives no feedback either way — the user could believe the key was shared when it wasn't, undermining the signed-export verification copy.

**Scope.**
- Update `signingKey.exportKeyToClipboard` to return `{ status: 'copied' } | { status: 'denied'; reason: string }` instead of a bare promise. Wrap the existing `clipboard.writeText` call in `try/catch`; map the catch to `denied` with the error message.
- Update callers (`AppLibraryAndPacksPane.tsx:249`) to thread the status to `SigningKeyPanel` via a new `onExportResult` callback prop or by lifting the status to local state inside the panel itself. Choose the simpler: lift status into `SigningKeyPanel` local state by changing `onExportPublicKey` to return the status, and the panel renders the confirmation.
- Render `<p role="status" className="text-small text-fg-muted mt-1">Public key copied to clipboard.</p>` for ≤4 seconds after success (use `useEffect` + `setTimeout`). On denial, render `<p role="status" className="text-small text-severity-high mt-1">Couldn't copy: {reason}. Copy the key manually from the field above.</p>` and persist until next user action (clearing on re-click).
- Pair the failure message with `<Badge severity="high" label="Copy failed" />` (the 45-A primitive) per the discipline rule from 45-BE.

**Tests.**
- Mock `navigator.clipboard.writeText` to resolve → assert success status renders.
- Mock to reject with `DOMException('NotAllowedError')` → assert failure status renders + badge.
- Mock `navigator.clipboard` as `undefined` → assert failure status renders.

**Commit.** `feat(46): surface clipboard status for Export public key + Badge pairing`.

### Item D — Dialog `inert` background

**Why.** Wave 45-F's `useFocusTrap` only governs Tab cycling. `App.tsx`'s `/` and Cmd+F keyboard shortcuts call `.focus()` directly on the findings search input, which can move focus *out* of an open Dialog, leaving the trap and the dialog's modal pretense out of sync. The platform answer is the `inert` HTML attribute: applied to background siblings of the dialog portal root, it blocks programmatic focus and pointer interaction without disturbing Tab semantics inside the dialog.

**Scope.**
- In `app/src/ui/system/Dialog.tsx`, on dialog open: enumerate `document.body.children`, mark every child whose subtree does NOT contain the dialog root with `inert = true`. On close: clear `inert` on those same siblings. Use a ref to remember which siblings were toggled (avoid stomping siblings that were already `inert` for other reasons).
- Place this side effect adjacent to (not inside) `useFocusTrap` so the existing trap behavior is unchanged.
- Update the Dialog story to demonstrate the inert behavior is non-visual (no story-level change usually needed).

**Tests.**
- `Dialog.test.tsx`: render Dialog inside a wrapper with two sibling `<div>`s; on open, assert both siblings have `inert` attribute; on close, assert neither does.
- `Dialog.test.tsx`: assert that an attempt to call `.focus()` on a button inside an inert sibling does NOT move document.activeElement (browsers enforce this; jsdom may not — if jsdom doesn't, mark the test as `it.skip` with a comment pointing at the Playwright spec instead, and add the assertion to the existing `tests/e2e/a11y.spec.ts`).
- Existing `useFocusTrap` Tab-cycle tests must continue to pass.

**Commit.** `feat(46): apply inert to Dialog background siblings`.

### Item C — Public-key fingerprint affordance + disclosure copy refresh

**Why.** Wave 45-D's signed-export disclosure tells users to "share your public key with the recipient out-of-band; they compare it against the key embedded in the signed export." Comparing a full base64 ed25519 public key by eye is impractical for non-technical recipients. A short SHA-256 fingerprint (8 hex chars from the first 4 bytes) is the standard solution: short enough to read aloud over the phone, long enough that random collision is ~1 in 4 billion. Codex pass `20260429T135226Z` flagged the disclosure copy as overpromising the workflow given no fingerprint exists in the UI.

**Scope.**
- Create `app/src/keys/fingerprint.ts`:
```ts
export async function computeShortFingerprint(rawPublicKeyBytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', rawPublicKeyBytes);
  return Array.from(new Uint8Array(hash).slice(0, 4))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
```
- In `SigningKeyPanel.tsx`, when `state.publicKey` is set, compute the fingerprint via `useEffect` (async, store in local state) and render a row:
```tsx
<div className="text-small text-fg-muted mt-2">
  <span>Fingerprint: </span>
  <code className="font-mono text-mono">{fingerprint ?? '...'}</code>
  <Button type="button" variant="subtle" size="sm" onClick={() => copyFingerprint()}>
    Copy
  </Button>
</div>
```
- The fingerprint copy affordance threads through the same status pattern from item B (success / denied feedback).
- Refresh the disclosure body in `app/src/ui/AppCurrentPane/ResultsHeader.tsx` from the current "share your public key with the recipient" text to: "Share the 8-character fingerprint shown next to your signing key (Settings → Signing key) with the recipient out-of-band — phone, encrypted message, or paper. They compare it against the fingerprint shown after they verify the signed export. A match is evidence the file was signed by your key; a mismatch is evidence of substitution. Without this comparison step the export only verifies against its own embedded key, which an attacker could replace."
- Confirm the new copy stays accurate against the implementation: every claim ("8-character fingerprint", "shown next to your signing key", "shown after they verify the signed export") must point at code that exists. The third claim presumes the verification UI also surfaces the fingerprint — verify in `OpenReviewPanel` / `OpenDeltaPanel` that this is true; if not, add fingerprint rendering there too inside this wave's scope.

**Tests.**
- `fingerprint.test.ts`: known-vector test (a hardcoded raw public key + its known short SHA-256 prefix).
- `SigningKeyPanel.test.tsx`: assert the fingerprint row renders the computed value once async completes; assert copy affordance triggers the same status pattern.
- `ResultsHeader.test.tsx`: assert the new disclosure copy matches verbatim (so future copy drift is caught by tests).
- If verification panels (`OpenReviewPanel`, `OpenDeltaPanel`) gain fingerprint rendering: per-panel test that asserts the fingerprint appears alongside the verified-key block.

**Commit (split into two for blame clarity).**
1. `feat(46): add public-key fingerprint affordance in SigningKeyPanel`
2. `clarify(46): refresh signed-export disclosure copy to reference fingerprint compare`

### §5 Verification

Before `gh pr ready`:

1. `npm run typecheck && npm run lint && npm run test:coverage` — all green from `app/`.
2. `npx playwright test tests/e2e/a11y.spec.ts` — all green (Dialog inert change + new SigningKeyPanel copy surfaces).
3. `gh pr checks <pr>` — all green, no pending.
4. Codex adversarial gate clean. Expected hot spots:
   - Item A: does the audit event payload over-claim? (Specifically, the `inputHash` claim — verify it actually hashes the unsigned payload, not the signed envelope.)
   - Item C: does the disclosure copy promise the verifier sees the fingerprint in the verification panel? If yes, ensure that's true; if not, drop the claim.
   - Item D: does the `inert` cleanup leak — what happens if the Dialog unmounts without a close transition?

### §6 Risk register

- **Audit-chain hash drift** — item A appends a new entry kind. Verify with the existing chain-consistency test that prior entries still validate against their `prevHash`.
- **Clipboard API surface differences** — Safari's `navigator.clipboard.writeText` requires user-gesture context and may reject silently. The denied-status path covers this, but verify in the Playwright spec that the click-handler chain is preserved (no async hop before `writeText`).
- **`inert` on Dialog siblings catching React portal targets** — if the Dialog renders inside a portal whose root is itself a body-sibling, the cleanup must handle it. Test by including a portal in the Dialog test fixture.
- **Fingerprint copy claims** — see hard rule §1.4. Plan for ≥3 Codex passes.

### §7 Out-of-band notes

- BACKLOG `### Wave 45-D follow-ups` and `### Wave 45-F follow-ups` sections fully consumed by this wave; promote those rows to §7 (Done) on merge.
- No telemetry change.
- No public types added beyond the audit-event union extension.
- The wave's PR description must reference Codex run IDs `20260429T135619Z`, `20260429T135226Z`, and `20260429T124811Z` so the audit trail closes the loop.

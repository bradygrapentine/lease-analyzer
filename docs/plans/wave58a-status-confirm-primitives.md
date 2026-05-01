# Wave 58a — `StatusMessage` + `ConfirmDialog` primitives

**Track**: Wave 48 Slice 3a (BACKLOG.md:684)
**Status**: ✅ Shipped (PRs #227, #229, #230)
**Risk**: Low (additive primitives, mechanical migrations)
**Estimated PRs**: 3 small, sequential

## Goal

Consolidate two repeated UI recipes into single primitives:

1. The ~17 ad-hoc `<p role="status|alert">` one-liners (success/error/info)
   sprinkled across panels.
2. The 5 non-crypto `window.confirm` / `window.prompt` callsites that bypass
   our chrome and accessibility tokens.

Defer the 4 crypto-passphrase prompts (`SigningKeyPanel`, `useAppCallbacks`,
`appHelpers`) — they need a memory-zeroing pattern specced first; tracked in
the deferral row.

## Non-goals

- No restyling of existing panels beyond swapping the recipe.
- No new visual variants — primitives codify what already ships.
- No crypto-passphrase migration this wave.

## Slice plan

### Slice 1 — `<StatusMessage>` primitive (PR A)

**Surface:**

```tsx
<StatusMessage tone="success" | "error" | "info" | "warn">{children}</StatusMessage>
```

- Renders `<p role={tone === 'error' ? 'alert' : 'status'}>` with the right
  Tailwind classes from existing tokens (no new colors).
- Lives at `app/src/ui/primitives/StatusMessage.tsx` with stories +
  `vitest-axe` smoke test.
- File: 1 new component + 1 test + 1 story.

**Migration scope:** all in-tree `<p role="status|alert">` callsites that are
plain one-liners. Skip composite cases (where the `<p>` is nested inside a
larger live region pattern) — list each skip in the PR description.

**Verify:**

- `npm run test` green; existing snapshot tests unchanged.
- `npx playwright test tests/e2e/a11y.spec.ts` clean.
- Visual: spot-check the 3 noisiest panels (LibraryPanel, AppRedlinePane,
  PackManagerPanel) in the dev server.

### Slice 2 — `<ConfirmDialog>` primitive (PR B)

**Surface:**

```tsx
<ConfirmDialog
  open={...}
  title="Clear all 12 redline edits?"
  body={...}                  // optional
  confirmLabel="Clear all"
  confirmTone="destructive" | "default"
  onConfirm={...}
  onCancel={...}
/>
```

- Built on whatever Dialog primitive AppRedlinePane already uses (see
  `FindingDetailModal` for shape — focus trap, Escape-to-close, scrim).
- Lives at `app/src/ui/primitives/ConfirmDialog.tsx`.
- Imperative helper `useConfirm()` for callsites that prefer the
  `await confirm({...})` shape over JSX state plumbing.

**Migration order (safest first):**

1. `LibraryPanel.tsx:84` — rename prompt → input field inside ConfirmDialog
   (this is the row-prompt, not a confirm; needs `<InputDialog>` variant or
   inline input slot — propose at review).
2. `AppRedlinePane.tsx:113` — clear-all confirm. Already destructive-tone in
   Negative Red per Wave 54-A; pattern-match that.
3. `appHelpers.ts:209` (archive overwrite) + `appHelpers.ts:232` (delete-all
   leases) — destructive confirms with the same chrome.

**Defer:** `SigningKeyPanel.tsx:219/237`, `useAppCallbacks.ts:118`,
`appHelpers.ts:178/203` — passphrase prompts, blocked on memory-zeroing
spec.

**Verify:**

- Each migration: existing test continues to pass with the new primitive
  (mocked confirm replaced with `userEvent.click` on the dialog button).
- e2e a11y spec stays green.
- Manual: walk each replaced callsite once in dev, confirm Escape + scrim
  click + focus return all behave.

### Slice 3 — `<InputDialog>` (only if Slice 2 review asks for it) (PR C)

If LibraryPanel rename feels wrong inside `ConfirmDialog` at review time,
extract `<InputDialog>` as a sibling primitive — same chrome, adds a labeled
text field. Otherwise close out without this slice.

## Files touched

- New: `app/src/ui/primitives/StatusMessage.tsx` + `.test.tsx` + `.stories.tsx`
- New: `app/src/ui/primitives/ConfirmDialog.tsx` + `.test.tsx` + `.stories.tsx`
- Possibly new: `app/src/ui/primitives/InputDialog.tsx` (Slice 3 only)
- Migrations across: `LibraryPanel`, `AppRedlinePane`, `appHelpers`, plus
  ~17 status-recipe sites identified by `grep -rE 'role="(status|alert)"'`.

## Coverage / gates

- Coverage thresholds stay at 97/90/93/97; new primitives must land with
  tests that don't drop the floor.
- `vitest-axe` per primitive.
- Playwright `tests/e2e/a11y.spec.ts` must stay green after each slice.

## Closeout

- [x] Promote backlog row "Wave 48 Slice 3 — `<StatusMessage>` + `<ConfirmDialog>`
  primitives" to `[x]` with PR refs (#227, #229, #230).
- [x] Add a Wave 58a entry under Phase 20 closeout in BACKLOG.md.
- [x] Deferred captured in PR #229 body (4 crypto-passphrase prompts,
  `appHelpers` confirms, `SigningKeyPanel` "copy failed" composite blocks).

# Wave 45-F — A11y primitives (`<Dialog>`, `<FileButton>`, BulkImport progressive live region) Implementation Plan

**Goal.** Close the two P1 a11y findings from `/impeccable audit` (audit total 17/20) by codifying the missing patterns as design-system primitives rather than fixing them inline. After this wave: dialogs in LeaseGuard pass the WAI-ARIA APG dialog contract by construction, file-input affordances honor the 32px tap-target floor by construction, and the streaming `BulkImportPanel` announces progress to assistive tech.

**Architecture.** Two new primitives — `app/src/ui/system/Dialog.tsx` and `app/src/ui/system/FileButton.tsx`. Four file-input consumer migrations. One streaming-aria-live add. The systemic-issue framing is intentional: the audit named "no `<Dialog>` primitive" and "no `<FileButton>` primitive" as the gaps; this wave fills them.

**Tech Stack.** React 18 + strict TS, Tailwind v4, Vitest + RTL, Storybook 8 CSF, axe via `app/src/ui/__tests__/all-stories.a11y.test.tsx`.

**Base SHA.** `origin/main` (`b697a61` post-Wave-45-A merge or later) at start of session. Verify with `git fetch origin && git log origin/main --oneline -5` before branching.

**Prerequisites.** Waves 45-A (Badge extract, PR #166 → wave-45-A PR yet to ship) need not be merged; this wave is independent. If 45-A merges first, no rebase conflicts expected (different files). If 45-F merges first, 45-A picks up the new `<Dialog>` / `<FileButton>` primitives if it needs them.

---

## §1 Hard rules

1. **One PR.** All five items on one feature branch.
2. **No new dependencies.** Use existing tokens, existing focus-ring utility (`index.css:175`), existing `Button` primitive.
3. **Each primitive ships with tests + story before any consumer migrates to it.** TDD-shaped: write `Dialog.test.tsx` failing, implement until green, then migrate `OnboardingTour`. Same for `FileButton`.
4. **No regression on the 93-test all-stories axe sweep** (`app/src/ui/__tests__/all-stories.a11y.test.tsx`). Both new primitives must pass with zero violations across all severity / states.
5. **Tap-target floor is 32px** for file-input affordances. Primary file-import flows (header upload, bulk import) should be 44px. The `<FileButton>` API surfaces a `size: 'sm' | 'md'` prop to match `Button`.
6. **OnboardingTour Esc-to-dismiss behavior must remain.** The dialog primitive owns Esc handling; the consumer wires `onDismiss`. Existing tests for Esc dismissal must pass unchanged after migration.
7. **Local gate green** (`typecheck && lint && test:coverage`) before push. Rebase onto `origin/main` before push. Poll `gh pr checks` until terminal.

## §2 Out of scope

- Migrating `app/src/ui/AppHeader.tsx`'s native `<input type="file">` chrome to the new `<FileButton>` (that was earlier scoped to Wave 45-E; reaffirm there). The file-input mirror in 45-E now consumes the primitive this wave creates.
- A `<Toast>` / `<Snackbar>` primitive. Audit didn't surface a need; defer until a real consumer appears.
- Refactoring the entire `MarketplacePanel` install-streaming UI (the audit noted streaming-live-region inconsistency systemically; this wave handles only `BulkImportPanel` because it's the user-facing high-volume case).
- Extracting a `<LiveRegion>` primitive. One additional consumer (BulkImport) does not justify a primitive yet; revisit if a third streaming UI appears.
- The renter-IA split of `AppCurrentPane` (45-B), the ComparePanel rewrite (45-C), the renter-copy clarify (45-D), and the severity-vs-negative + Field error pass (45-E). Those waves remain independent.

## §3 Execution

Direct, single-track. Estimated 2.5-3.5 hours: ~60 min for `<Dialog>`, ~30 min for `<FileButton>`, ~30 min for the four consumer migrations, ~30 min for `OnboardingTour` migration, ~20 min for the BulkImport live region, the rest in tests + Storybook stories + verification.

## §4 Item A — `<Dialog>` primitive

**Why.** Audit P1: `OnboardingTour.tsx:90-148` is the codebase's only `role="dialog"` and is missing focus trap, initial focus, return focus, and a visible focus ring. The fix isn't inline — `/impeccable audit` named "no `<Dialog>` primitive" as a systemic gap because the next dialog will repeat the same omissions. Codify the WAI-ARIA APG dialog pattern once.

**API:**
```tsx
interface DialogProps {
  open: boolean;
  onDismiss: () => void;
  /** aria-labelledby target. Required for accessible name. */
  titleId: string;
  /** aria-describedby target, optional. */
  descriptionId?: string;
  /** Initial focus target on mount. Defaults to the first focusable inside the dialog. */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** Whether Esc dismisses. Default: true. */
  closeOnEscape?: boolean;
  /** Backdrop click dismiss. Default: false (lawyerly app, not consumer-soft). */
  closeOnBackdropClick?: boolean;
  className?: string;
  children: ReactNode;
}
```

**Doctrine to enforce inside the primitive:**
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby={titleId}` (+ `aria-describedby` if provided).
- Focus trap: cycle Tab / Shift-Tab within the dialog DOM tree. Use the first / last focusable descendants discovered at mount; recompute when content changes (use a `useFocusTrap` hook scoped to the primitive).
- Initial focus: move focus to `initialFocusRef.current` if provided, otherwise to the dialog root (which is `tabIndex={-1}`).
- Return focus: cache `document.activeElement as HTMLElement` at open, call `.focus()` on dismiss.
- Esc handler: `keydown` listener at `document` level while open; calls `onDismiss` if `closeOnEscape`.
- Backdrop: full-viewport `position: fixed inset-0 bg-fg/40` (cream paper at 40% won't read in dark mode; use `bg-fg/40` which inverts via the token system).
- Focus ring: apply `focus-visible:focus-ring` to the dialog root for the case where it gets focus directly.
- Honor `prefers-reduced-motion`: no enter/exit animation when reduce.

**Files:**
- Create: `app/src/ui/system/Dialog.tsx`
- Create: `app/src/ui/system/Dialog.test.tsx`
- Create: `app/src/ui/system/Dialog.stories.tsx`
- Create: `app/src/ui/system/useFocusTrap.ts` (internal hook, not exported from `system/index.ts`)
- Create: `app/src/ui/system/useFocusTrap.test.ts`

**Steps:**
- [ ] Write `useFocusTrap.test.ts`: mount with two focusable buttons, assert Tab from last cycles to first, Shift-Tab from first cycles to last, ignores `tabIndex={-1}`, handles dynamic content changes via `MutationObserver`.
- [ ] Implement `useFocusTrap.ts`. Reference the WAI-ARIA APG implementation: query `*[tabindex="0"], button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])` inside the container ref.
- [ ] Write `Dialog.test.tsx`: open=true, asserts initial focus moves to dialog (or initialFocusRef), Esc calls onDismiss, Tab traps inside, focus returns on dismiss, axe-clean.
- [ ] Implement `Dialog.tsx`. Backdrop + panel layout; panel max-width 32rem default, override via className.
- [ ] Write `Dialog.stories.tsx`: one default story (open + close button), one with `initialFocusRef` aimed at a specific button, one with backdrop-click-dismiss enabled.
- [ ] `npm run typecheck && npm run lint && npm test -- Dialog && npm test -- useFocusTrap`.
- [ ] Commit: `feat(system): add Dialog primitive with focus trap + return focus + Esc handler`.

## §5 Item B — Migrate `OnboardingTour` to `<Dialog>`

**Why.** Audit P1 fix. After Item A this is mechanical: replace the hand-rolled dialog DOM in `OnboardingTour.tsx:90-148` with `<Dialog>`, wire the existing dismiss/skip/done callbacks to `onDismiss`.

**Files:**
- Modify: `app/src/ui/OnboardingTour.tsx`
- Modify: `app/src/ui/OnboardingTour.test.tsx`
- Modify: `app/src/ui/OnboardingTour.stories.tsx` (if it exists; probably wrapped in the `Open` story for axe)

**Steps:**
- [ ] Update `OnboardingTour.tsx` to render `<Dialog open={open} onDismiss={onClose} titleId="onboarding-title" descriptionId="onboarding-step">`. Move panel-content children inside; keep the panel's stepper / skip / done buttons. Drop the manual `tabIndex={-1}` / `role="dialog"` / `aria-modal` from the old root.
- [ ] Confirm Esc-to-dismiss behavior preserves: existing test "closes on Escape" (or equivalent) must pass without modification.
- [ ] Verify focus moves into the dialog on open: add a test "moves focus into dialog on open" if not already covered. Verify focus returns to the trigger on dismiss: `getByRole('button', { name: /restart tour/i })` or wherever the trigger is.
- [ ] Visual sanity: `npm run dev`, trigger the tour, Tab around — confirm trap holds.
- [ ] `npm run typecheck && npm run lint && npm test -- OnboardingTour`.
- [ ] Commit: `refactor(onboarding): migrate OnboardingTour to Dialog primitive`.

## §6 Item C — `<FileButton>` primitive

**Why.** Audit P1: four panels reinvent file-input button styling at 28px (h-7), under the 32px sm floor and well under the 44px AAA primary target. The systemic gap is the missing primitive. Codify a hidden-`<input type="file">` + visible `<Button>` pattern; the trigger acts like a real button (keyboard-activatable, sized to spec, focus-ringed).

**API:**
```tsx
interface FileButtonProps {
  /** Visible label inside the button. */
  children: ReactNode;
  /** Forwarded to the underlying input. */
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  /** Variant + size matching Button. Defaults to subtle / md. */
  variant?: 'default' | 'ghost' | 'subtle';
  size?: 'sm' | 'md';
  /** Called with the FileList when files are picked. */
  onFiles: (files: FileList) => void;
  /** Optional aria-describedby target. */
  'aria-describedby'?: string;
  className?: string;
}
```

**Doctrine:**
- Renders a `<span>` (or `<label>`) wrapping a visually-hidden `<input type="file">` and a `<Button as="span">` (or button-styled span; pick whichever React forwards events for cleanly). The Button is the visible, focusable surface; the input is the file-pick mechanism.
- Uses the existing `Button` primitive's variant + size classes; never hand-rolls h-7.
- Forwards `onFiles` from the input's `onChange` (passing `e.target.files` after non-null guard).
- Resets the input value after each pick so re-picking the same file fires `onChange` again (a `react-hook-form` style trick: `inputRef.current.value = ''` after invoking `onFiles`).
- Honors `disabled` by setting both the visible Button's disabled state and the input's `disabled`.

**Files:**
- Create: `app/src/ui/system/FileButton.tsx`
- Create: `app/src/ui/system/FileButton.test.tsx`
- Create: `app/src/ui/system/FileButton.stories.tsx`

**Steps:**
- [ ] Write `FileButton.test.tsx`: assert rendered button visible at 32 / 44px height by checking computed class names; assert `onFiles` fires when input changes; assert keyboard-activatable (Enter on the visible button triggers the input file picker via label-association); assert disabled disables both input and button.
- [ ] Implement `FileButton.tsx`. Use `<label>` so click-on-label dispatches click-on-input automatically; the label houses both the hidden input and the visible Button.
- [ ] Write `FileButton.stories.tsx`: default md, sm variant, multiple-files variant, disabled state.
- [ ] `npm run typecheck && npm run lint && npm test -- FileButton`.
- [ ] Commit: `feat(system): add FileButton primitive (Button-sized file-input affordance)`.

## §7 Item D — Migrate four file-input sites to `<FileButton>`

**Why.** The four h-7 (28px) sites become one-line consumers of the new primitive. After migration: every file-input affordance hits the 32px floor; primary upload flows hit 44px.

**Sites:**
- `app/src/ui/AppFooterControls.tsx:28` — currently `inline-flex h-7` span over `sr-only` input. **Promote to `size="sm"`** (footer toolbar context).
- `app/src/ui/BulkImportPanel.tsx:79` — primary action of the panel. **Promote to `size="md"`** (44px).
- `app/src/ui/AppLibraryAndPacksPane.tsx:210` — pack import inside a section group, secondary. **`size="sm"`**.
- `app/src/ui/PackManagerPanel.tsx:165` — pack management primary. **`size="md"`**.

**Files:**
- Modify: the four files above + their respective `.test.tsx` files (the tests likely use `getByLabelText('Import pack')` etc.; the new structure preserves the visible label and the input still has the same accessible name, so most tests should pass without changes).

**Steps:**
- [ ] Replace each `<span className="…file:h-7…">` with `<FileButton size={...} accept={...} onFiles={...}>label</FileButton>`. Drop the inline className soup.
- [ ] Verify each consumer's existing test still passes; update any test that asserts `h-7` className (those assertions are now wrong by design).
- [ ] Visual sanity: `npm run dev`, walk through footer upload, bulk import, library pack import, pack manager — every button reads at the correct size and gets the focus ring on Tab.
- [ ] `npm run typecheck && npm run lint && npm test -- AppFooterControls BulkImportPanel AppLibraryAndPacksPane PackManagerPanel`.
- [ ] Commit: `refactor(panels): migrate four file-input sites to FileButton primitive`.

## §8 Item E — `BulkImportPanel` progressive aria-live

**Why.** Audit P2: per-file results stream into a `<tbody>` as rows mutate. SR users hear nothing until the closing `<p role="status">` summary fires. Streaming UIs need a progressive announcement.

**Files:**
- Modify: `app/src/ui/BulkImportPanel.tsx` (around the streaming-results section, near line 84-107).
- Modify: `app/src/ui/BulkImportPanel.test.tsx` (assert the live-region exists, asserts text updates as rows arrive).

**Steps:**
- [ ] Add a sibling element to the streaming `<tbody>`: `<p aria-live="polite" aria-atomic="false" className="text-small text-fg-muted">{processed} of {total} processed, {errorCount} error{errorCount === 1 ? '' : 's'}</p>`. Place it ABOVE the table so SRs hit the live region before the rows.
- [ ] Confirm the closing `<p role="status">` summary is unchanged (it remains the final terminal announcement).
- [ ] Add a test that mounts with mock `processed` / `total` / `errorCount` and asserts the live region renders the current count, then re-renders with updated counts and asserts the text changed (RTL `rerender`).
- [ ] `npm run typecheck && npm run lint && npm test -- BulkImportPanel`.
- [ ] Commit: `feat(bulk-import): progressive aria-live announcement during streaming`.

## §9 Wave-level verification

After all five items:

- [ ] `git grep -nE "h-7\b" app/src/ui` — must return zero hits in JSX (consumers migrated).
- [ ] `git grep -n "role=\"dialog\"" app/src/ui` — must return one hit (the new `Dialog` primitive itself); `OnboardingTour` no longer renders the role directly.
- [ ] `git grep -nE 'file:h-7|file:h-\[28px\]' app/src/ui` — zero hits.
- [ ] `npm run typecheck && npm run lint && npm run test:coverage` — clean. Coverage thresholds (96/90/93/96) maintained or raised.
- [ ] `npm run lhci` — accessibility ≥ 0.95 (new primitives must not regress Lighthouse).
- [ ] `npm run storybook && npm test -- all-stories` — 93+ stories, all axe-clean. New primitives' stories add to the count.
- [ ] `npm run dev` — manual walk: trigger OnboardingTour, Tab through, Esc to dismiss, confirm focus returns. Trigger BulkImport, watch the live region update with VoiceOver / NVDA. Click each migrated file-button via Tab + Enter; confirm picker opens.
- [ ] Re-run `/impeccable audit` — the two P1 items (OnboardingTour focus, file-input touch targets) should be gone; the audit total should lift from 17/20 toward 19/20.

## §10 PR + merge

- Branch: `wave45-f-a11y-primitives`
- PR title: `feat(system): Dialog + FileButton primitives + BulkImport progressive live region`
- PR body: this plan's goal + the five items + verification checklist.
- **Rebase before push:** `git fetch origin && git rebase origin/main && git push --force-with-lease`. Per the standing rebase-before-push memory.
- **Poll CI:** `gh pr checks <num>` every 1-2 min until terminal. Don't walk away from auto-merge.
- Single squash-merge after `gh pr checks` clears.
- Update BACKLOG `§4 Wave footprint` row counters; mark this plan as "shipped" in the wave's PR description.

## §11 Risks and rollback

- **Risk: focus-trap MutationObserver perf regression.** If `OnboardingTour`'s content changes frequently, the trap re-queries focusables on each mutation. Mitigate by debouncing the observer or by recomputing only on user-driven content change events (next/back step). Default impl uses passive observer; if it shows up in a perf trace, optimize.
- **Risk: `useFocusTrap` and React StrictMode double-invoke.** The hook attaches a document-level keydown listener; in StrictMode the cleanup must run reliably. Test under `<StrictMode>` in the test bed.
- **Risk: `<FileButton>` keyboard semantics.** A `<label>`-wrapped Button must dispatch the file picker on Enter; some browsers route this through the input automatically, others don't. Cover Enter and Space in tests.
- **Risk: BulkImport live-region over-announce.** Setting `aria-atomic="false"` lets SRs read the diff between updates; if updates fire faster than ~400 ms, SR queues stack and feel laggy. Throttle the live-region text update to ~500 ms intervals if a real-world test shows over-announcing.
- **Rollback.** Each item is its own commit; revert in reverse order. The `Dialog` and `FileButton` primitives are additive and can be removed cleanly if the migrations are reverted first.

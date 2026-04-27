import { test, expect } from '@playwright/test';

// Wave 26-C — annotation persistence across page reloads. The vitest
// flow test (Wave 26-A in App.test.tsx) covers the same-session round
// trip; this spec covers the cross-session leg via real IndexedDB
// (`leaseguard-annotations` v1).
//
// Contract:
//   1. Sample-lease analyze fires.
//   2. Click a finding to set the active paragraphIndex (the
//      AnnotationsPanel is gated on it).
//   3. Add a note; verify it renders in the saved-notes list.
//   4. Reload the page and re-open the saved lease from the library.
//   5. Click the same finding; the note is still there.

test.describe('Annotation persistence', () => {
  test('add a note → reload → reopen → note still attached to the same finding', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /skip onboarding tour/i }).click();
    await page.getByRole('button', { name: /try a sample lease/i }).click();

    const findings = page.getByRole('complementary', { name: /findings/i });
    await expect(findings).toBeVisible();
    const findingButtons = findings.locator('button.finding-btn');
    await expect(findingButtons.first()).toBeVisible({ timeout: 15_000 });

    // Click the first deterministic finding and write a note.
    await findingButtons.first().click();
    const noteText = `wave-26 e2e ${Date.now()}`;
    const addNoteForm = page.getByRole('form', { name: /add note/i });
    await expect(addNoteForm).toBeVisible();
    await addNoteForm.getByLabel(/new note/i).fill(noteText);
    await addNoteForm.getByRole('button', { name: /add note/i }).click();

    const annotations = page.getByRole('region', { name: /annotations/i });
    await expect(annotations.getByText(noteText)).toBeVisible();

    // Reload — the in-memory React state goes away; IDB persists.
    await page.reload();

    // Wave 30-B: bottom-pane accordions default closed. Expand "Library"
    // before reaching for the saved-lease row.
    await page.getByRole('button', { name: /^Library$/i }).click();

    // The library row's "Open" button surfaces the saved lease.
    const openSample = page.getByRole('button', { name: /open sample lease\.pdf/i });
    await expect(openSample).toBeVisible({ timeout: 10_000 });
    await openSample.click();

    // Findings panel re-renders from the saved record. Click the same
    // finding to re-set paragraphIndex; the note should still be there.
    const findingsAfter = page.getByRole('complementary', { name: /findings/i });
    const findingButtonsAfter = findingsAfter.locator('button.finding-btn');
    await expect(findingButtonsAfter.first()).toBeVisible({ timeout: 10_000 });
    await findingButtonsAfter.first().click();

    const annotationsAfter = page.getByRole('region', { name: /annotations/i });
    await expect(annotationsAfter.getByText(noteText)).toBeVisible({ timeout: 5_000 });
  });
});

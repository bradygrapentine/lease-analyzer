import { test, expect } from '@playwright/test';

// Wave 16-B — covers the auto-save → library → reopen path. The chromium
// happy-path spec (golden.spec.ts) only verifies analyze + audit; this
// spec asserts the round-trip is real: usePipeline auto-saves after
// analyze, the saved row surfaces in My Leases, and clicking Open
// rehydrates findings into the panel without re-running the parser.
test.describe('LeaseGuard library flow', () => {
  test('auto-saves the sample lease, lists it in My Leases, reopen restores findings', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /skip onboarding tour/i }).click();
    await page.getByRole('button', { name: /try a sample lease/i }).click();

    const findings = page.getByRole('complementary', { name: /findings/i });
    const findingButtons = findings.locator('button.finding-btn');
    await expect(findingButtons.first()).toBeVisible({ timeout: 15_000 });

    // Wave 30-B: bottom-pane accordions default closed. Expand "Library"
    // before reaching for the saved-lease row. The button's accessible
    // name includes a count badge ("Library 1") once leases exist, so
    // match by prefix not exact.
    await page.getByRole('button', { name: /^Library\b/i }).click();

    // usePipeline auto-saves analyzed leases. The library row's "open" button
    // surfaces with the file name aria-label, e.g. "Open Sample lease.pdf".
    // (The sample-lease handler in useAppCallbacks names the synthesized
    // file "Sample lease.pdf", not "sample.pdf" — the spec drifted from
    // the source.)
    const openSample = page.getByRole('button', { name: /open sample lease\.pdf/i });
    await expect(openSample).toBeVisible({ timeout: 10_000 });

    // Reopen the saved record. Findings panel stays populated (the saved
    // record carries findings, not just bytes). The "Open" button lives
    // at the bottom of the page, so after the click we're scrolled past
    // the FindingsPanel — which is virtualized (Phase 13's
    // VirtualFindingItem swaps offscreen rows for placeholders). Assert
    // on the severity-group heading instead, which is always rendered
    // and includes the finding count.
    await openSample.click();
    // The h2 wraps a button whose aria-label is "toggle high" — match by
    // visible text instead, which carries the rendered count "High (N)".
    await expect(findings.getByText(/^High \(\d+\)$/)).toBeVisible({ timeout: 10_000 });
  });
});

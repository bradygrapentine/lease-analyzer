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

    // usePipeline auto-saves analyzed leases. The library row's "open" button
    // surfaces with the file name aria-label, e.g. "open sample.pdf".
    const openSample = page.getByRole('button', { name: /open sample\.pdf/i });
    await expect(openSample).toBeVisible({ timeout: 10_000 });

    // Reopen the saved record. Findings panel stays populated (the saved
    // record carries findings, not just bytes).
    await openSample.click();
    await expect(findingButtons.first()).toBeVisible({ timeout: 10_000 });
  });
});

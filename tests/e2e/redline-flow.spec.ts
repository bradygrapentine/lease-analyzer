import { test, expect } from '@playwright/test';

// Wave 26-C — redline view smoke. The unit suite covers the redline
// editor's per-paragraph edit / revert / store mechanics; this spec
// pins the App-level transition that mounts the Redline pane in place
// of the standard analyzed view.
//
// Contract:
//   1. Sample-lease analyze fires.
//   2. Switch to Redline view via the view-mode group.
//   3. The redline section mounts, showing one editable paragraph
//      row per parsed paragraph.

test.describe('Redline view', () => {
  test('switch to Redline view → editor mounts with paragraph rows', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /skip onboarding tour/i }).click();
    await page.getByRole('button', { name: /try a sample lease/i }).click();

    // Wait for analyze to complete via the findings panel signal.
    const findings = page.getByRole('complementary', { name: /findings/i });
    await expect(findings).toBeVisible();
    await expect(findings.locator('button.finding-btn').first()).toBeVisible({
      timeout: 15_000,
    });

    // Switch to Redline.
    await page.getByRole('button', { name: /^Redline$/ }).click();

    // The redline section is aria-label="redline"; each paragraph row
    // exposes an "edit paragraph N" button.
    const redline = page.getByRole('region', { name: /^redline$/ });
    await expect(redline).toBeVisible();
    // Exact match — string-name without `exact` is a substring match,
    // so "edit paragraph 1" would also catch paragraphs 10, 11, …
    // and fail strict-mode visibility on >1 elements.
    await expect(
      redline.getByRole('button', { name: 'edit paragraph 1', exact: true }),
    ).toBeVisible();
  });
});

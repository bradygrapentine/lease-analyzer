import { test, expect } from '@playwright/test';

test.describe('LeaseGuard happy path', () => {
  test('analyze sample lease, navigate findings, switch views, see audit entries', async ({
    page,
  }) => {
    await page.goto('/');

    // First-run onboarding tour intercepts every interaction. Dismiss it.
    const skipTour = page.getByRole('button', { name: /skip onboarding tour/i });
    await skipTour.click();

    // Sample-lease button kicks the parse → analyze pipeline.
    await page.getByRole('button', { name: /try a sample lease/i }).click();

    // Findings panel populates once analyze completes. The sample lease is
    // hand-tuned to fire several rules; "at least one" is the contract.
    // Each clickable finding row has the `finding-btn` class — that's the
    // stable selector (filter / severity / category buttons live in the
    // same panel).
    const findings = page.getByRole('complementary', { name: /findings/i });
    await expect(findings).toBeVisible();
    const findingButtons = findings.locator('button.finding-btn');
    await expect(findingButtons.first()).toBeVisible({ timeout: 15_000 });

    // Click the first finding → the "selected finding" detail panel mounts
    // and the PDF viewer focuses the matching span. Asserting the detail
    // article is the smallest stable signal the click wired through.
    await findingButtons.first().click();
    await expect(page.getByRole('article', { name: /selected finding/i })).toBeVisible();

    // Portfolio toggle → portfolio section renders.
    await page.getByRole('tab', { name: /^portfolio$/i }).click();
    await expect(page.getByRole('region', { name: /portfolio/i }).first()).toBeVisible();

    // Back to current view so the audit log is rendered alongside.
    await page.getByRole('tab', { name: /^current lease$/i }).click();

    // Audit log lives inside the bottom-pane "Governance" disclosure, which
    // Wave 30-B made default-closed. Expand it before reaching for the
    // audit log region.
    await page.getByRole('button', { name: /^Governance\b/i }).click();

    // Audit log: section always exists; assert ≥ 1 entry from the analyze + save
    // events the sample-lease flow already produced. The panel renders a
    // <Refresh> control then a list of entries; the entries surface as
    // either <li> or <tr>, so we look for any visible row of the audit log.
    const auditSection = page.getByRole('region', { name: /audit log/i });
    await expect(auditSection).toBeVisible();
    await page.getByRole('button', { name: /^refresh$/i }).click();
    // Match any descendant element that looks like an entry row.
    const auditEntries = auditSection.locator('li, tr');
    await expect(auditEntries.first()).toBeVisible({ timeout: 10_000 });
  });
});

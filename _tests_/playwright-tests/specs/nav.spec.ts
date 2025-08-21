import { test, expect } from '@playwright/test';

const base = 'https://playwright.dev/';

test('navigate to getting started', async ({ page }) => {
  await page.goto(base);
  await page.getByRole('link', { name: 'Docs' }).click();
  await page.getByRole('link', { name: 'Getting started' }).click();
  await expect(page).toHaveURL(/.*getting-started/);
  await expect(page.getByRole('heading', { name: /Getting started/i })).toBeVisible();
});

test('search box appears on docs', async ({ page }) => {
  await page.goto(base + 'docs/intro');
  await expect(page.locator('input[type="search"], input[placeholder*="Search"]')).toBeVisible();
});

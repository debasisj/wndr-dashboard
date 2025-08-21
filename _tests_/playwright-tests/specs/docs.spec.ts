import { test, expect } from '@playwright/test';

const base = 'https://playwright.dev/';

test('has multiple languages selector', async ({ page }) => {
  await page.goto(base + 'docs/intro');
  const selector = page.locator('button, select').filter({ hasText: /Language|English|日本語|中文/ });
  await expect(selector).toBeVisible();
});

test('api reference page has title', async ({ page }) => {
  await page.goto(base + 'docs/api/class-test');
  await expect(page).toHaveTitle(/class: Test/);
});

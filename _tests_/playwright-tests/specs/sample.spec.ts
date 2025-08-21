import { test, expect } from '@playwright/test';

const site = 'https://playwright.dev/';

test('homepage has title', async ({ page }) => {
  await page.goto(site);
  await expect(page).toHaveTitle(/Playwright/);
});

test('intentional failure example', async ({ page }) => {
  await page.goto(site);
  await expect(page.getByRole('heading', { name: 'This heading does not exist' })).toBeVisible();
});

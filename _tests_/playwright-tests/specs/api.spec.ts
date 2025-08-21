import { test, expect } from '@playwright/test';

test('dashboard health endpoint is ok', async ({ request }) => {
  const res = await request.get('http://localhost:4000/health');
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  expect(json.status).toBe('ok');
});

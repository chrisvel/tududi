import { test, expect } from '@playwright/test';

// Simple smoke test: user can log in and gets redirected to Today page
// Requires backend and frontend dev servers running locally. By default:
// - Frontend: http://localhost:8080 (webpack dev server)
// - Backend: http://localhost:3002 (proxied by webpack dev server)
// Set APP_URL to override base URL if needed.

test('user can login and reach Today page', async ({ page, baseURL }) => {
  const appUrl = baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';

  // Go directly to login page
  await page.goto(appUrl + '/login');

  // Fill credentials. Ensure a user exists, e.g. TUDUDI_USER_EMAIL/TUDUDI_USER_PASSWORD or seed.
  const email = process.env.E2E_EMAIL || 'test@tududi.com';
  const password = process.env.E2E_PASSWORD || 'password123';

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /login/i }).click();

  // Expect redirect to Today view
  await expect(page).toHaveURL(/\/today$/);

  // Basic sanity check: unique control on Today page
  await expect(
    page.getByRole('button', { name: /Today Page Settings/i })
  ).toBeVisible();
});

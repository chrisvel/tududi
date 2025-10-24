import { test, expect, Page } from '@playwright/test';

// Shared login function
async function login(page: Page, baseURL: string | undefined) {
  const appUrl = baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';

  await page.goto(appUrl + '/login');

  const email = process.env.E2E_EMAIL || 'test@tududi.com';
  const password = process.env.E2E_PASSWORD || 'password123';

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /login/i }).click();

  await expect(page).toHaveURL(/\/today$/);

  return appUrl;
}

test('upcoming view loads and displays upcoming section', async ({ page, baseURL }) => {
  const appUrl = await login(page, baseURL);

  // Navigate to upcoming view
  await page.goto(appUrl + '/upcoming');
  await expect(page).toHaveURL(/\/upcoming/);

  // Verify the page heading is visible
  await expect(page.getByRole('heading', { name: 'Upcoming' })).toBeVisible();

  // Wait for content to load
  await page.waitForLoadState('networkidle');

  // Verify we don't have the task creation input (upcoming view is read-only)
  const taskInput = page.locator('[data-testid="new-task-input"]');
  await expect(taskInput).not.toBeVisible();
});

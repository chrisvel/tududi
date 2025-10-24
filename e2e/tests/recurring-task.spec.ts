import { test, expect } from '@playwright/test';

// Shared login function
async function loginAndNavigateToTasks(page, baseURL) {
  const appUrl = baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';

  // Go directly to login page first
  await page.goto(appUrl + '/login');

  // Fill credentials and login
  const email = process.env.E2E_EMAIL || 'test@tududi.com';
  const password = process.env.E2E_PASSWORD || 'password123';

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /login/i }).click();

  // Wait for redirect to Today view
  await expect(page).toHaveURL(/\/today$/);

  // Navigate to tasks page
  await page.goto(appUrl + '/tasks');
  await expect(page).toHaveURL(/\/tasks/);

  // Wait for the tasks page to fully load by waiting for the task input to be visible
  await expect(page.locator('[data-testid="new-task-input"]')).toBeVisible({ timeout: 10000 });

  return appUrl;
}

// Helper function to create a recurring task via API
async function createRecurringTaskViaAPI(page, taskName: string, recurrenceType: string) {
  // Use the browser context to make an API call
  const response = await page.request.post('/api/task', {
    data: {
      name: taskName,
      recurrence_type: recurrenceType,
      status: 'not_started',
      priority: 'medium'
    }
  });

  expect(response.ok()).toBeTruthy();
  const task = await response.json();
  return task;
}

test('recurring task displays actual name (not "Weekly") after page refresh', async ({ page, baseURL }) => {
  const appUrl = await loginAndNavigateToTasks(page, baseURL);

  // Create a unique recurring task
  const timestamp = Date.now();
  const taskName = `My Weekly Review ${timestamp}`;

  // Create a weekly recurring task via API
  const task = await createRecurringTaskViaAPI(page, taskName, 'weekly');

  // Refresh the page to simulate the bug scenario
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Wait for the tasks page to fully load
  await expect(page.locator('[data-testid="new-task-input"]')).toBeVisible({ timeout: 10000 });

  // Click on the recurring task in the task list
  const taskInList = page.locator('[data-testid*="task-item"]').filter({ hasText: taskName });
  await expect(taskInList).toBeVisible({ timeout: 10000 });
  await taskInList.click();

  // Wait for the task modal/details page to open
  // The task modal should show the task name input or a heading with the task name
  await page.waitForLoadState('networkidle');

  // Check if we're on the task detail page (URL-based) or modal (overlay)
  const currentUrl = page.url();

  if (currentUrl.includes(`/task/${task.uid}`)) {
    // We're on the task detail page
    // The title should be displayed correctly in the page heading or task name field
    const taskNameElement = page.locator('h1, h2, [data-testid="task-name-input"]');

    // The task name should be the actual name, not "Weekly"
    const displayedText = await taskNameElement.first().textContent();
    expect(displayedText).toContain(taskName);
    expect(displayedText).not.toBe('Weekly');
  } else {
    // We're in a modal
    await expect(page.locator('[data-testid="task-name-input"]')).toBeVisible({ timeout: 5000 });
    const taskNameInput = page.locator('[data-testid="task-name-input"]');

    // The task name input should show the actual name, not "Weekly"
    await expect(taskNameInput).toHaveValue(taskName);
    await expect(taskNameInput).not.toHaveValue('Weekly');
  }
});

test('monthly recurring task displays actual name (not "Monthly") after page refresh', async ({ page, baseURL }) => {
  const appUrl = await loginAndNavigateToTasks(page, baseURL);

  // Create a unique recurring task
  const timestamp = Date.now();
  const taskName = `Monthly Budget Review ${timestamp}`;

  // Create a monthly recurring task via API
  const task = await createRecurringTaskViaAPI(page, taskName, 'monthly');

  // Refresh the page to simulate the bug scenario
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Wait for the tasks page to fully load
  await expect(page.locator('[data-testid="new-task-input"]')).toBeVisible({ timeout: 10000 });

  // Click on the recurring task in the task list
  const taskInList = page.locator('[data-testid*="task-item"]').filter({ hasText: taskName });
  await expect(taskInList).toBeVisible({ timeout: 10000 });
  await taskInList.click();

  // Wait for the task modal/details page to open
  await page.waitForLoadState('networkidle');

  // Check if we're on the task detail page (URL-based) or modal (overlay)
  const currentUrl = page.url();

  if (currentUrl.includes(`/task/${task.uid}`)) {
    // We're on the task detail page
    const taskNameElement = page.locator('h1, h2, [data-testid="task-name-input"]');

    // The task name should be the actual name, not "Monthly"
    const displayedText = await taskNameElement.first().textContent();
    expect(displayedText).toContain(taskName);
    expect(displayedText).not.toBe('Monthly');
  } else {
    // We're in a modal
    await expect(page.locator('[data-testid="task-name-input"]')).toBeVisible({ timeout: 5000 });
    const taskNameInput = page.locator('[data-testid="task-name-input"]');

    // The task name input should show the actual name, not "Monthly"
    await expect(taskNameInput).toHaveValue(taskName);
    await expect(taskNameInput).not.toHaveValue('Monthly');
  }
});

test('daily recurring task displays actual name (not "Daily") after page refresh', async ({ page, baseURL }) => {
  const appUrl = await loginAndNavigateToTasks(page, baseURL);

  // Create a unique recurring task
  const timestamp = Date.now();
  const taskName = `Daily Standup ${timestamp}`;

  // Create a daily recurring task via API
  const task = await createRecurringTaskViaAPI(page, taskName, 'daily');

  // Refresh the page to simulate the bug scenario
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Wait for the tasks page to fully load
  await expect(page.locator('[data-testid="new-task-input"]')).toBeVisible({ timeout: 10000 });

  // Click on the recurring task in the task list
  const taskInList = page.locator('[data-testid*="task-item"]').filter({ hasText: taskName });
  await expect(taskInList).toBeVisible({ timeout: 10000 });
  await taskInList.click();

  // Wait for the task modal/details page to open
  await page.waitForLoadState('networkidle');

  // Check if we're on the task detail page (URL-based) or modal (overlay)
  const currentUrl = page.url();

  if (currentUrl.includes(`/task/${task.uid}`)) {
    // We're on the task detail page
    const taskNameElement = page.locator('h1, h2, [data-testid="task-name-input"]');

    // The task name should be the actual name, not "Daily"
    const displayedText = await taskNameElement.first().textContent();
    expect(displayedText).toContain(taskName);
    expect(displayedText).not.toBe('Daily');
  } else {
    // We're in a modal
    await expect(page.locator('[data-testid="task-name-input"]')).toBeVisible({ timeout: 5000 });
    const taskNameInput = page.locator('[data-testid="task-name-input"]');

    // The task name input should show the actual name, not "Daily"
    await expect(taskNameInput).toHaveValue(taskName);
    await expect(taskNameInput).not.toHaveValue('Daily');
  }
});

test('recurring task shows correct name without visiting Today page first', async ({ page, baseURL }) => {
  const appUrl = await loginAndNavigateToTasks(page, baseURL);

  // Create a unique recurring task
  const timestamp = Date.now();
  const taskName = `Weekly Planning ${timestamp}`;

  // Create a weekly recurring task via API
  const task = await createRecurringTaskViaAPI(page, taskName, 'weekly');

  // Navigate directly to the task detail page using the task UID
  await page.goto(`${appUrl}/task/${task.uid}`);
  await page.waitForLoadState('networkidle');

  // The task detail page should show the actual name, not "Weekly"
  const taskNameElement = page.locator('h1, h2, [data-testid="task-name-input"]');
  await expect(taskNameElement.first()).toBeVisible({ timeout: 5000 });

  const displayedText = await taskNameElement.first().textContent();
  expect(displayedText).toContain(taskName);
  expect(displayedText).not.toBe('Weekly');
});

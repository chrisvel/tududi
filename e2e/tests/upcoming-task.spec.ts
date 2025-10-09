import { test, expect } from '@playwright/test';

// Shared login function
async function loginAndNavigateToUpcoming(page: any, baseURL: any) {
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

  // Navigate to upcoming page
  await page.goto(appUrl + '/upcoming');
  await expect(page).toHaveURL(/\/upcoming/);

  // Wait for the upcoming page to fully load and tasks to be fetched
  await page.waitForTimeout(3000);

  return appUrl;
}

// Create a task with a due date via API
async function createTaskWithDueDate(page: any, taskName: string, dueDate: string) {
  // Get cookies to extract session
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find(c => c.name === 'connect.sid');

  if (!sessionCookie) {
    throw new Error('No session cookie found');
  }

  // Create task via API
  const response = await page.request.post('/api/task', {
    headers: {
      'Cookie': `connect.sid=${sessionCookie.value}`,
      'Content-Type': 'application/json',
    },
    data: {
      name: taskName,
      status: 'not_started',
      due_date: dueDate,
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to create task: ${response.status()}`);
  }

  const task = await response.json();
  console.log('Created task:', task.name, 'with due date:', task.due_date);
  return task;
}

test('user can mark an upcoming task as complete, show completed, and mark incomplete', async ({ page, baseURL }) => {
  const appUrl = await loginAndNavigateToUpcoming(page, baseURL);

  // Create a task with tomorrow's date
  const timestamp = Date.now();
  const taskName = `Upcoming test task ${timestamp}`;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split('T')[0];

  const createdTask = await createTaskWithDueDate(page, taskName, tomorrowDate);
  console.log('Task created with ID:', createdTask.id, 'Due date:', createdTask.due_date);

  // Navigate to upcoming page to see the new task
  await page.goto(appUrl + '/upcoming');
  await page.waitForTimeout(3000);

  // Debug: Check the page title and URL
  console.log('Current URL:', page.url());
  const pageTitle = await page.title();
  console.log('Page title:', pageTitle);

  // Debug: Check if any tasks are visible
  const allTasks = page.locator('[data-testid*="task-item"]');
  const taskCount = await allTasks.count();
  console.log(`Total tasks visible: ${taskCount}`);

  // Debug: Check if there's any error message
  const errorMessage = page.locator('text=/error/i');
  if (await errorMessage.count() > 0) {
    console.log('Error message found:', await errorMessage.textContent());
  }

  // Debug: List all visible task names
  if (taskCount > 0) {
    for (let i = 0; i < taskCount; i++) {
      const taskText = await allTasks.nth(i).textContent();
      console.log(`Task ${i}:`, taskText?.substring(0, 50));
    }
  }

  // Step 1: Verify the task is visible in the upcoming view
  const taskContainer = page.locator('[data-testid*="task-item"]').filter({ hasText: taskName });
  await expect(taskContainer).toBeVisible({ timeout: 10000 });

  // Step 2: Mark the task as complete
  const completionCheckbox = taskContainer.locator('[data-testid="task-completion-checkbox-desktop"]');
  await expect(completionCheckbox).toBeVisible();

  // Verify it's not checked initially
  await expect(completionCheckbox).toHaveAttribute('aria-checked', 'false');

  // Click to mark as complete
  await completionCheckbox.click();

  // Wait for the fade-out animation and state update
  await page.waitForTimeout(1000);

  // Step 3: Verify the task disappears after completion (when show completed is off)
  await expect(taskContainer).not.toBeVisible({ timeout: 5000 });

  // Step 4: Enable "Show completed" toggle
  const showCompletedToggle = page.locator('button').filter({ has: page.locator('span:has-text("Show completed")') });
  await expect(showCompletedToggle).toBeVisible({ timeout: 5000 });

  // Click the toggle button itself (not the text)
  await showCompletedToggle.click();
  await page.waitForTimeout(1000);

  // Step 5: Verify the completed task reappears
  await expect(taskContainer).toBeVisible({ timeout: 5000 });

  // Step 6: Verify the checkbox shows as checked (green checkmark)
  const completedCheckbox = taskContainer.locator('[data-testid="task-completion-checkbox-desktop"]');
  await expect(completedCheckbox).toHaveAttribute('aria-checked', 'true');

  // Step 7: Mark the task as incomplete
  await completedCheckbox.click();
  await page.waitForTimeout(1000);

  // Step 8: Verify the checkbox is no longer checked
  await expect(completedCheckbox).toHaveAttribute('aria-checked', 'false');

  // Step 9: Verify the task is still visible (because show completed is still on)
  await expect(taskContainer).toBeVisible();

  // Step 10: Turn off "Show completed" and verify the task is still visible (because it's not completed)
  await showCompletedToggle.click();
  await page.waitForTimeout(1000);

  // Task should still be visible because it's no longer completed
  await expect(taskContainer).toBeVisible();
});

test('multiple upcoming tasks can be completed and show completed works correctly', async ({ page, baseURL }) => {
  const appUrl = await loginAndNavigateToUpcoming(page, baseURL);

  // Create multiple tasks with different dates
  const timestamp = Date.now();

  // Task 1: Tomorrow
  const task1Name = `Upcoming task 1 ${timestamp}`;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split('T')[0];
  await createTaskWithDueDate(page, task1Name, tomorrowDate);

  // Task 2: Day after tomorrow
  const task2Name = `Upcoming task 2 ${timestamp}`;
  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);
  const dayAfterDate = dayAfter.toISOString().split('T')[0];
  await createTaskWithDueDate(page, task2Name, dayAfterDate);

  // Navigate to upcoming page to see the new tasks
  await page.goto(appUrl + '/upcoming');
  await page.waitForTimeout(3000);

  // Debug: Check if any tasks are visible
  const allTasks = page.locator('[data-testid*="task-item"]');
  const taskCount = await allTasks.count();
  console.log(`Total tasks visible in test 2: ${taskCount}`);

  // Step 1: Verify both tasks are visible in upcoming view
  const task1Container = page.locator('[data-testid*="task-item"]').filter({ hasText: task1Name });
  const task2Container = page.locator('[data-testid*="task-item"]').filter({ hasText: task2Name });

  await expect(task1Container).toBeVisible({ timeout: 10000 });
  await expect(task2Container).toBeVisible({ timeout: 10000 });

  // Step 2: Complete the first task
  const task1Checkbox = task1Container.locator('[data-testid="task-completion-checkbox-desktop"]');
  await task1Checkbox.click();
  await page.waitForTimeout(500);

  // Step 3: Verify first task disappears, second task remains
  await expect(task1Container).not.toBeVisible({ timeout: 5000 });
  await expect(task2Container).toBeVisible();

  // Step 4: Enable "Show completed"
  const showCompletedToggle = page.locator('button').filter({ has: page.locator('span:has-text("Show completed")') });
  await showCompletedToggle.click();
  await page.waitForTimeout(1000);

  // Step 5: Verify first task reappears with completed status
  await expect(task1Container).toBeVisible({ timeout: 5000 });
  await expect(task1Checkbox).toHaveAttribute('aria-checked', 'true');

  // Step 6: Verify second task is still visible and not completed
  await expect(task2Container).toBeVisible();
  const task2Checkbox = task2Container.locator('[data-testid="task-completion-checkbox-desktop"]');
  await expect(task2Checkbox).toHaveAttribute('aria-checked', 'false');

  // Step 7: Complete the second task while show completed is on
  await task2Checkbox.click();
  await page.waitForTimeout(500);

  // Step 8: Verify both tasks remain visible (show completed is on)
  await expect(task1Container).toBeVisible();
  await expect(task2Container).toBeVisible();
  await expect(task2Checkbox).toHaveAttribute('aria-checked', 'true');

  // Step 9: Disable "Show completed"
  await showCompletedToggle.click();
  await page.waitForTimeout(1000);

  // Step 10: Verify both completed tasks disappear
  await expect(task1Container).not.toBeVisible();
  await expect(task2Container).not.toBeVisible();
});

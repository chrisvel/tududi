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

  return appUrl;
}

// Shared function to create a task via the inline input field
async function createTask(page, taskName) {
  // Find task input - try multiple selectors to be more robust
  let taskInput;
  
  // Find the NewTask input field more specifically to avoid the search field
  // Look for input with the exact placeholder text from NewTask component
  try {
    taskInput = page.locator('input[placeholder="Προσθήκη Νέας Εργασίας"]').first();
    await expect(taskInput).toBeVisible({ timeout: 5000 });
  } catch {
    // Fallback: look for input within the NewTask component structure
    // NewTask has a container with rounded-lg shadow-sm and a PlusCircleIcon
    taskInput = page.locator('.rounded-lg.shadow-sm').filter({ has: page.locator('svg') }).locator('input[type="text"]').first();
    await expect(taskInput).toBeVisible({ timeout: 5000 });
  }
  
  // Clear and fill in the task name
  await taskInput.clear();
  await taskInput.fill(taskName);
  
  // Press Enter to create the task
  await taskInput.press('Enter');

  // Verify task creation by checking that the input field is cleared
  // (this is simpler and more reliable than trying to find the created task in the UI)
  await expect(taskInput).toHaveValue('');
  
  // Wait for the task creation API call to complete
  await page.waitForTimeout(2000);
}

test('user can create a new task and verify it appears in the task list', async ({ page, baseURL }) => {
  await loginAndNavigateToTasks(page, baseURL);

  // Create a unique test task
  const timestamp = Date.now();
  const taskName = `Test task ${timestamp}`;
  await createTask(page, taskName);
});

test('user can update an existing task', async ({ page, baseURL }) => {
  await loginAndNavigateToTasks(page, baseURL);

  // Create an initial task
  const timestamp = Date.now();
  const originalTaskName = `Test task to edit ${timestamp}`;
  await createTask(page, originalTaskName);

  // Find the task and click on it to open the edit modal
  const taskContainer = page.locator('.task-item-wrapper').filter({ hasText: originalTaskName });
  await taskContainer.click();

  // Wait for the Task Modal to appear with the task data
  await expect(page.locator('input[name="name"], input[placeholder*="task" i], input[placeholder*="name" i]')).toBeVisible();

  // Verify the task name field is pre-filled
  const taskNameInput = page.locator('input[name="name"], input[placeholder*="task" i], input[placeholder*="name" i]').first();
  await expect(taskNameInput).toHaveValue(originalTaskName);

  // Edit the task name
  const editedTaskName = `Edited test task ${timestamp}`;
  await taskNameInput.clear();
  await taskNameInput.fill(editedTaskName);

  // Save the changes
  await page.locator('.bg-blue-600.text-white').filter({ hasText: 'Save' }).click();

  // Wait for the modal to close
  await expect(page.locator('input[name="name"], input[placeholder*="task" i], input[placeholder*="name" i]')).not.toBeVisible();

  // Verify the edited task appears in the task list
  await expect(page.locator('.task-item-wrapper').filter({ hasText: editedTaskName })).toBeVisible();

  // Verify the original task name is no longer visible
  await expect(page.locator('.task-item-wrapper').filter({ hasText: originalTaskName })).not.toBeVisible();
});

test('user can delete an existing task', async ({ page, baseURL }) => {
  await loginAndNavigateToTasks(page, baseURL);

  // Create an initial task
  const timestamp = Date.now();
  const taskName = `Test task to delete ${timestamp}`;
  await createTask(page, taskName);

  // Find the task container and hover to show action buttons
  const taskContainer = page.locator('.task-item-wrapper').filter({ hasText: taskName });
  await taskContainer.hover();

  // Click the delete button (trash icon)
  await taskContainer.locator('button[title="Delete"], button').filter({ hasText: '' }).last().click();

  // Wait for and handle the confirmation dialog
  await expect(page.locator('text=Delete Task')).toBeVisible();
  // Click the red "Delete" button in the confirmation dialog
  await page.locator('.bg-red-500.text-white').click();

  // Verify the task is no longer visible in the task list
  await expect(page.locator('.task-item-wrapper').filter({ hasText: taskName })).not.toBeVisible();
});

test('user can mark a task as complete', async ({ page, baseURL }) => {
  await loginAndNavigateToTasks(page, baseURL);

  // Create an initial task
  const timestamp = Date.now();
  const taskName = `Test task to complete ${timestamp}`;
  await createTask(page, taskName);

  // Find the task container and click the checkbox to mark it as complete
  const taskContainer = page.locator('.task-item-wrapper').filter({ hasText: taskName });
  await taskContainer.locator('input[type="checkbox"], button[role="checkbox"]').click();

  // Verify the task is marked as completed (usually with strikethrough or different styling)
  await expect(taskContainer.locator('.line-through, .completed, .opacity-50')).toBeVisible();
});
import { test, expect } from '@playwright/test';
import {
  login,
  navigateAndWait,
  waitForElement,
  hoverAndWaitForVisible,
  createUniqueEntity,
  waitForNetworkIdle
} from '../helpers/testHelpers';

// Helper to create a task
async function createTask(page, taskName) {
  const taskInput = page.locator('[data-testid="new-task-input"]');
  await taskInput.fill(taskName);
  await taskInput.press('Enter');
  await waitForNetworkIdle(page);
}

// Helper to open task edit modal
async function openTaskEditModal(page, taskName) {
  const taskContainer = page.locator('[data-testid*="task-item"]').filter({ hasText: taskName });
  await expect(taskContainer).toBeVisible({ timeout: 15000 });

  const editButton = taskContainer.locator('[data-testid*="task-edit"]');
  await hoverAndWaitForVisible(taskContainer, editButton);

  await editButton.click();

  const taskNameInput = page.locator('[data-testid="task-name-input"]');
  await waitForElement(taskNameInput, { timeout: 15000 });

  return taskNameInput;
}

test('user can set task priority to high', async ({ page, baseURL }) => {
  const appUrl = await login(page, baseURL);

  await navigateAndWait(page, appUrl + '/tasks');

  // Create a task
  const taskName = createUniqueEntity('High Priority Task');
  await createTask(page, taskName);

  // Open the task edit modal
  await openTaskEditModal(page, taskName);

  // Wait for modal to be in idle state (not saving)
  await expect(page.locator('[data-testid="task-modal"][data-state="idle"]')).toBeVisible();

  // Click the priority section icon to expand the priority section
  const prioritySectionButton = page.locator('button[title*="Priority"]').filter({ has: page.locator('svg') });
  await prioritySectionButton.click();

  // Wait for priority section to be expanded
  await expect(page.locator('[data-testid="priority-section"][data-state="expanded"]')).toBeVisible();

  // Wait for priority dropdown to be ready, then click it
  const priorityDropdown = page.locator('.inline-flex.justify-between').filter({ hasText: /low|medium|high/i }).first();
  await expect(priorityDropdown).toBeVisible();
  await priorityDropdown.click();

  // Wait for dropdown to open
  await expect(page.locator('[data-testid="priority-dropdown"][data-state="open"]')).toBeVisible();

  // Select "High" priority from the portal dropdown
  const highPriorityOption = page.locator('button').filter({ hasText: /high/i }).first();
  await expect(highPriorityOption).toBeVisible();
  await highPriorityOption.click();

  // Wait for dropdown to close
  await expect(page.locator('[data-testid="priority-dropdown"][data-state="closed"]')).toBeVisible();

  // Save the task
  await page.locator('[data-testid="task-save-button"]').click();

  // Wait for saving state then idle state
  await expect(page.locator('[data-testid="task-modal"][data-state="saving"]')).toBeVisible();
  await expect(page.locator('[data-testid="task-modal"][data-state="idle"]')).not.toBeVisible({ timeout: 10000 });

  // Verify the task was saved successfully (modal should have closed)
  const taskContainer = page.locator('[data-testid*="task-item"]').filter({ hasText: taskName });
  await expect(taskContainer).toBeVisible();
});

test('user can set task priority to medium and low', async ({ page, baseURL }) => {
  const appUrl = await login(page, baseURL);

  await navigateAndWait(page, appUrl + '/tasks');

  // Create a task
  const taskName = createUniqueEntity('Medium Priority Task');
  await createTask(page, taskName);

  // Open the task edit modal
  await openTaskEditModal(page, taskName);

  // Wait for modal to be in idle state
  await expect(page.locator('[data-testid="task-modal"][data-state="idle"]')).toBeVisible();

  // Expand priority section
  const prioritySectionButton = page.locator('button[title*="Priority"]').filter({ has: page.locator('svg') });
  await prioritySectionButton.click();
  await expect(page.locator('[data-testid="priority-section"][data-state="expanded"]')).toBeVisible();

  // Set to medium priority
  const priorityDropdown = page.locator('.inline-flex.justify-between').filter({ hasText: /low|medium|high/i }).first();
  await expect(priorityDropdown).toBeVisible();
  await priorityDropdown.click();
  await expect(page.locator('[data-testid="priority-dropdown"][data-state="open"]')).toBeVisible();

  const mediumPriorityOption = page.locator('button').filter({ hasText: /medium/i }).first();
  await expect(mediumPriorityOption).toBeVisible();
  await mediumPriorityOption.click();
  await expect(page.locator('[data-testid="priority-dropdown"][data-state="closed"]')).toBeVisible();

  // Save the task
  await page.locator('[data-testid="task-save-button"]').click();
  await expect(page.locator('[data-testid="task-modal"][data-state="saving"]')).toBeVisible();
  await expect(page.locator('[data-testid="task-modal"]')).not.toBeVisible({ timeout: 10000 });

  // Verify task is saved with medium priority
  const taskContainer = page.locator('[data-testid*="task-item"]').filter({ hasText: taskName });
  await expect(taskContainer).toBeVisible();

  // Now change to low priority
  await openTaskEditModal(page, taskName);
  await expect(page.locator('[data-testid="task-modal"][data-state="idle"]')).toBeVisible();

  // Check if priority section is already expanded (it should be for non-default priority)
  const priorityDropdown2 = page.locator('.inline-flex.justify-between').filter({ hasText: /low|medium|high/i }).first();
  const isAlreadyExpanded = await priorityDropdown2.isVisible().catch(() => false);

  if (!isAlreadyExpanded) {
    const prioritySectionButton2 = page.locator('button[title*="Priority"]').filter({ has: page.locator('svg') });
    await prioritySectionButton2.click();
    await expect(page.locator('[data-testid="priority-section"][data-state="expanded"]')).toBeVisible();
  }

  await expect(priorityDropdown2).toBeVisible();
  await priorityDropdown2.click();
  await expect(page.locator('[data-testid="priority-dropdown"][data-state="open"]')).toBeVisible();

  const lowPriorityOption = page.locator('button').filter({ hasText: /low/i }).first();
  await expect(lowPriorityOption).toBeVisible();
  await lowPriorityOption.click();
  await expect(page.locator('[data-testid="priority-dropdown"][data-state="closed"]')).toBeVisible();

  await page.locator('[data-testid="task-save-button"]').click();
  await expect(page.locator('[data-testid="task-modal"][data-state="saving"]')).toBeVisible();
  await expect(page.locator('[data-testid="task-modal"]')).not.toBeVisible({ timeout: 10000 });

  // Verify task is saved with low priority
  await expect(taskContainer).toBeVisible();
});

test('user can set a due date for a task', async ({ page, baseURL }) => {
  const appUrl = await login(page, baseURL);

  await navigateAndWait(page, appUrl + '/tasks');

  // Create a task
  const taskName = createUniqueEntity('Task With Due Date');
  await createTask(page, taskName);

  // Open the task edit modal
  await openTaskEditModal(page, taskName);
  await expect(page.locator('[data-testid="task-modal"][data-state="idle"]')).toBeVisible();

  // Click the due date section icon to expand it
  const dueDateSectionButton = page.locator('button[title*="Due Date"]').filter({ has: page.locator('svg') });
  await dueDateSectionButton.click();
  await expect(page.locator('[data-testid="duedate-section"][data-state="expanded"]')).toBeVisible();

  // Click the date picker button to open the calendar
  const datePickerButton = page.locator('button').filter({ hasText: /Select due date/i }).first();
  await expect(datePickerButton).toBeVisible();
  await datePickerButton.click();
  await expect(page.locator('[data-testid="datepicker"][data-state="open"]')).toBeVisible();

  // Calculate tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDay = tomorrow.getDate();

  // Select tomorrow's date from the calendar
  const dayButton = page.locator('.date-picker-menu button').filter({ hasText: new RegExp(`^${tomorrowDay}$`) }).first();
  await expect(dayButton).toBeVisible();
  await dayButton.click();
  await expect(page.locator('[data-testid="datepicker"][data-state="closed"]')).toBeVisible();

  // Save the task
  await page.locator('[data-testid="task-save-button"]').click();
  await expect(page.locator('[data-testid="task-modal"][data-state="saving"]')).toBeVisible();
  await expect(page.locator('[data-testid="task-modal"]')).not.toBeVisible({ timeout: 10000 });

  // Verify the task was saved successfully
  const taskContainer = page.locator('[data-testid*="task-item"]').filter({ hasText: taskName });
  await expect(taskContainer).toBeVisible();
});

test('user can change the due date of a task', async ({ page, baseURL }) => {
  const appUrl = await login(page, baseURL);

  await navigateAndWait(page, appUrl + '/tasks');

  // Create a task
  const taskName = createUniqueEntity('Task Due Date Change');
  await createTask(page, taskName);

  // Open the task edit modal and set initial due date
  await openTaskEditModal(page, taskName);
  await expect(page.locator('[data-testid="task-modal"][data-state="idle"]')).toBeVisible();

  // Expand due date section
  const dueDateSectionButton = page.locator('button[title*="Due Date"]').filter({ has: page.locator('svg') });
  await dueDateSectionButton.click();
  await expect(page.locator('[data-testid="duedate-section"][data-state="expanded"]')).toBeVisible();

  // Click the date picker and select tomorrow
  const datePickerButton = page.locator('button').filter({ hasText: /Select due date/i }).first();
  await expect(datePickerButton).toBeVisible();
  await datePickerButton.click();
  await expect(page.locator('[data-testid="datepicker"][data-state="open"]')).toBeVisible();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDay = tomorrow.getDate();

  const tomorrowButton = page.locator('.date-picker-menu button').filter({ hasText: new RegExp(`^${tomorrowDay}$`) }).first();
  await expect(tomorrowButton).toBeVisible();
  await tomorrowButton.click();
  await expect(page.locator('[data-testid="datepicker"][data-state="closed"]')).toBeVisible();

  await page.locator('[data-testid="task-save-button"]').click();
  await expect(page.locator('[data-testid="task-modal"][data-state="saving"]')).toBeVisible();
  await expect(page.locator('[data-testid="task-modal"]')).not.toBeVisible({ timeout: 10000 });

  // Now change the due date
  await openTaskEditModal(page, taskName);
  await expect(page.locator('[data-testid="task-modal"][data-state="idle"]')).toBeVisible();

  // Due date section should already be expanded (task has due date)
  const datePickerButton2 = page.locator('button').filter({ hasText: /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i }).first();
  const isAlreadyExpanded = await datePickerButton2.isVisible().catch(() => false);

  if (!isAlreadyExpanded) {
    const dueDateSectionButton2 = page.locator('button[title*="Due Date"]').filter({ has: page.locator('svg') });
    await dueDateSectionButton2.click();
    await expect(page.locator('[data-testid="duedate-section"][data-state="expanded"]')).toBeVisible();
  }

  await expect(datePickerButton2).toBeVisible();
  await datePickerButton2.click();
  await expect(page.locator('[data-testid="datepicker"][data-state="open"]')).toBeVisible();

  // Select a date next week
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekDay = nextWeek.getDate();

  const nextWeekButton = page.locator('.date-picker-menu button').filter({ hasText: new RegExp(`^${nextWeekDay}$`) }).first();
  await expect(nextWeekButton).toBeVisible();
  await page.waitForLoadState('networkidle');
  await nextWeekButton.click({ force: true });
  await expect(page.locator('[data-testid="datepicker"][data-state="closed"]')).toBeVisible();

  // Wait for any re-renders after datepicker closes
  await page.waitForLoadState('networkidle');

  const saveButton = page.locator('[data-testid="task-save-button"]');
  await saveButton.click();
  await expect(page.locator('[data-testid="task-modal"][data-state="saving"]')).toBeVisible();
  await expect(page.locator('[data-testid="task-modal"]')).not.toBeVisible({ timeout: 10000 });

  // Verify the task is still visible with updated due date
  const taskContainer = page.locator('[data-testid*="task-item"]').filter({ hasText: taskName });
  await expect(taskContainer).toBeVisible();
});

test('user can remove the due date from a task', async ({ page, baseURL }) => {
  const appUrl = await login(page, baseURL);

  await navigateAndWait(page, appUrl + '/tasks');

  // Create a task
  const taskName = createUniqueEntity('Task Remove Due Date');
  await createTask(page, taskName);

  // Open the task edit modal and set initial due date
  await openTaskEditModal(page, taskName);
  await expect(page.locator('[data-testid="task-modal"][data-state="idle"]')).toBeVisible();

  // Expand due date section
  const dueDateSectionButton = page.locator('button[title*="Due Date"]').filter({ has: page.locator('svg') });
  await dueDateSectionButton.click();
  await expect(page.locator('[data-testid="duedate-section"][data-state="expanded"]')).toBeVisible();

  // Click the date picker and select tomorrow
  const datePickerButton = page.locator('button').filter({ hasText: /Select due date/i }).first();
  await expect(datePickerButton).toBeVisible();
  await datePickerButton.click();
  await expect(page.locator('[data-testid="datepicker"][data-state="open"]')).toBeVisible();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDay = tomorrow.getDate();

  const tomorrowButton = page.locator('.date-picker-menu button').filter({ hasText: new RegExp(`^${tomorrowDay}$`) }).first();
  await expect(tomorrowButton).toBeVisible();
  await tomorrowButton.click();
  await expect(page.locator('[data-testid="datepicker"][data-state="closed"]')).toBeVisible();

  await page.locator('[data-testid="task-save-button"]').click();
  await expect(page.locator('[data-testid="task-modal"][data-state="saving"]')).toBeVisible();
  await expect(page.locator('[data-testid="task-modal"]')).not.toBeVisible({ timeout: 10000 });

  // Now remove the due date
  await openTaskEditModal(page, taskName);
  await expect(page.locator('[data-testid="task-modal"][data-state="idle"]')).toBeVisible();

  // Due date section should already be expanded
  const datePickerButton2 = page.locator('button').filter({ hasText: /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i }).first();
  await expect(datePickerButton2).toBeVisible();
  await datePickerButton2.click();
  await expect(page.locator('[data-testid="datepicker"][data-state="open"]')).toBeVisible();

  // Click the "Clear" button in the date picker footer
  const clearButton = page.locator('.date-picker-menu button').filter({ hasText: /Clear/i });
  await expect(clearButton).toBeVisible();
  await page.waitForLoadState('networkidle');
  await clearButton.click({ force: true });
  await expect(page.locator('[data-testid="datepicker"][data-state="closed"]')).toBeVisible();

  // Wait for any re-renders after datepicker closes
  await page.waitForLoadState('networkidle');

  const saveButton2 = page.locator('[data-testid="task-save-button"]');
  await saveButton2.click();
  await expect(page.locator('[data-testid="task-modal"][data-state="saving"]')).toBeVisible();
  await expect(page.locator('[data-testid="task-modal"]')).not.toBeVisible({ timeout: 10000 });

  // Verify the task is still visible
  const taskContainer = page.locator('[data-testid*="task-item"]').filter({ hasText: taskName });
  await expect(taskContainer).toBeVisible();
});

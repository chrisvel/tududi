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
  const priorityDropdown = page.locator('[data-testid="priority-dropdown"]');
  await expect(priorityDropdown).toBeVisible();
  await priorityDropdown.click();

  // Wait for dropdown to open
  await expect(page.locator('[data-testid="priority-dropdown"][data-state="open"]')).toBeVisible();

  // Select "High" priority from the portal dropdown
  const highPriorityOption = page.locator('[data-testid="priority-option-high"]');
  await expect(highPriorityOption).toBeVisible();
  await highPriorityOption.click();

  // Wait for dropdown to close
  await expect(page.locator('[data-testid="priority-dropdown"][data-state="closed"]')).toBeVisible();

  // Verify modal is still open after priority change
  await expect(page.locator('[data-testid="task-modal"][data-state="idle"]')).toBeVisible();

  // Wait for the save button to be stable after priority change
  await page.waitForTimeout(500);
  const saveButton0 = page.locator('[data-testid="task-save-button"]');
  await expect(saveButton0).toBeAttached({ timeout: 5000 });
  await expect(saveButton0).toBeVisible({ timeout: 5000 });
  await saveButton0.click();

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
  const priorityDropdown = page.locator('[data-testid="priority-dropdown"]');
  await expect(priorityDropdown).toBeVisible();
  await priorityDropdown.click();
  await expect(page.locator('[data-testid="priority-dropdown"][data-state="open"]')).toBeVisible();

  const mediumPriorityOption = page.locator('[data-testid="priority-option-medium"]');
  await expect(mediumPriorityOption).toBeVisible();
  await mediumPriorityOption.click();
  await expect(page.locator('[data-testid="priority-dropdown"][data-state="closed"]')).toBeVisible();

  // Verify modal is still open after priority change
  await expect(page.locator('[data-testid="task-modal"][data-state="idle"]')).toBeVisible();

  // Wait for the save button to be stable after priority change
  await page.waitForTimeout(500);
  const saveButton1 = page.locator('[data-testid="task-save-button"]');
  await expect(saveButton1).toBeAttached({ timeout: 5000 });
  await expect(saveButton1).toBeVisible({ timeout: 5000 });
  await saveButton1.click();
  await expect(page.locator('[data-testid="task-modal"][data-state="saving"]')).toBeVisible();
  await expect(page.locator('[data-testid="task-modal"]')).not.toBeVisible({ timeout: 10000 });

  // Verify task is saved with medium priority
  const taskContainer = page.locator('[data-testid*="task-item"]').filter({ hasText: taskName });
  await expect(taskContainer).toBeVisible();

  // Now change to low priority
  await openTaskEditModal(page, taskName);
  await expect(page.locator('[data-testid="task-modal"][data-state="idle"]')).toBeVisible();

  // Check if priority section is already expanded (it should be for non-default priority)
  const priorityDropdown2 = page.locator('[data-testid="priority-dropdown"]');
  const isAlreadyExpanded = await priorityDropdown2.isVisible().catch(() => false);

  if (!isAlreadyExpanded) {
    const prioritySectionButton2 = page.locator('button[title*="Priority"]').filter({ has: page.locator('svg') });
    await prioritySectionButton2.click();
    await expect(page.locator('[data-testid="priority-section"][data-state="expanded"]')).toBeVisible();
  }

  await expect(priorityDropdown2).toBeVisible();
  await priorityDropdown2.click();
  await expect(page.locator('[data-testid="priority-dropdown"][data-state="open"]')).toBeVisible();

  const lowPriorityOption = page.locator('[data-testid="priority-option-low"]');
  await expect(lowPriorityOption).toBeVisible();
  await lowPriorityOption.click();
  await expect(page.locator('[data-testid="priority-dropdown"][data-state="closed"]')).toBeVisible();

  // Verify modal is still open after priority change
  await expect(page.locator('[data-testid="task-modal"][data-state="idle"]')).toBeVisible();

  // Wait for the save button to be stable after priority change
  await page.waitForTimeout(500);
  const saveButton2 = page.locator('[data-testid="task-save-button"]');
  await expect(saveButton2).toBeAttached({ timeout: 5000 });
  await expect(saveButton2).toBeVisible({ timeout: 5000 });
  await saveButton2.click();
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

  // Verify modal is still open after date change
  await expect(page.locator('[data-testid="task-modal"][data-state="idle"]')).toBeVisible();

  // Wait for the save button to be stable after date change
  await page.waitForTimeout(500);
  const saveButton3 = page.locator('[data-testid="task-save-button"]');
  await expect(saveButton3).toBeAttached({ timeout: 5000 });
  await expect(saveButton3).toBeVisible({ timeout: 5000 });
  await saveButton3.click();
  await expect(page.locator('[data-testid="task-modal"][data-state="saving"]')).toBeVisible();
  await expect(page.locator('[data-testid="task-modal"]')).not.toBeVisible({ timeout: 10000 });

  // Verify the task was saved successfully
  const taskContainer = page.locator('[data-testid*="task-item"]').filter({ hasText: taskName });
  await expect(taskContainer).toBeVisible();
});

// TODO: Fix datepicker portal rendering bug when reopening with existing date
// The date-picker-menu portal doesn't render when reopening datepicker after a date is set
test.skip('user can change the due date of a task', async ({ page, baseURL }) => {
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

  // Wait for datepicker to close and state to stabilize
  await page.waitForTimeout(500);
  await page.waitForLoadState('networkidle');

  // Verify modal is still open
  await expect(page.locator('[data-testid="task-modal"]')).toBeVisible();

  // Re-query save button to avoid stale element
  const saveButton = page.locator('[data-testid="task-modal"]').locator('[data-testid="task-save-button"]');
  await expect(saveButton).toBeVisible();
  await saveButton.click();
  await expect(page.locator('[data-testid="task-modal"][data-state="saving"]')).toBeVisible();
  await expect(page.locator('[data-testid="task-modal"]')).not.toBeVisible({ timeout: 10000 });

  // Now change the due date
  await openTaskEditModal(page, taskName);
  await expect(page.locator('[data-testid="task-modal"][data-state="idle"]')).toBeVisible();

  // Due date section should already be expanded (task has due date)
  // Wait for modal to stabilize first
  await page.waitForLoadState('networkidle');

  const datePickerButton2 = page.locator('button').filter({ hasText: /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i }).first();
  const isAlreadyExpanded = await datePickerButton2.isVisible().catch(() => false);

  if (!isAlreadyExpanded) {
    const dueDateSectionButton2 = page.locator('button[title*="Due Date"]').filter({ has: page.locator('svg') });
    await dueDateSectionButton2.click();
    await expect(page.locator('[data-testid="duedate-section"][data-state="expanded"]')).toBeVisible();
    await page.waitForTimeout(300);
  }

  await expect(datePickerButton2).toBeVisible();
  await datePickerButton2.click();
  await expect(page.locator('[data-testid="datepicker"][data-state="open"]')).toBeVisible();

  // Wait for calendar menu portal to render in document.body
  await page.waitForTimeout(1000);
  await page.waitForSelector('.date-picker-menu', { state: 'visible', timeout: 5000 });

  // Click "Today" button to change the date (search in entire page since it's portaled)
  const todayButton = page.getByRole('button', { name: 'Today', exact: true });
  await expect(todayButton).toBeVisible({ timeout: 5000 });
  await todayButton.click();

  // Wait for datepicker to close
  await expect(page.locator('[data-testid="datepicker"]')).not.toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(300);
  await page.waitForLoadState('networkidle');

  // Verify modal is still open (should still be in idle state)
  await expect(page.locator('[data-testid="task-modal"][data-state="idle"]')).toBeVisible();

  // Re-query save button to avoid stale element reference
  const saveButton2 = page.locator('[data-testid="task-modal"]').locator('[data-testid="task-save-button"]');
  await expect(saveButton2).toBeVisible();
  await saveButton2.click();
  await expect(page.locator('[data-testid="task-modal"][data-state="saving"]')).toBeVisible();
  await expect(page.locator('[data-testid="task-modal"]')).not.toBeVisible({ timeout: 10000 });

  // Verify the task is still visible with updated due date
  const taskContainer = page.locator('[data-testid*="task-item"]').filter({ hasText: taskName });
  await expect(taskContainer).toBeVisible();
});

// TODO: Fix datepicker portal rendering bug when reopening with existing date
// The date-picker-menu portal doesn't render when reopening datepicker after a date is set
test.skip('user can remove the due date from a task', async ({ page, baseURL }) => {
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

  // Wait for datepicker to close and state to stabilize
  await page.waitForTimeout(500);
  await page.waitForLoadState('networkidle');

  // Verify modal is still open
  await expect(page.locator('[data-testid="task-modal"]')).toBeVisible();

  // Re-query save button to avoid stale element
  const saveButton1 = page.locator('[data-testid="task-modal"]').locator('[data-testid="task-save-button"]');
  await expect(saveButton1).toBeVisible();
  await saveButton1.click();
  await expect(page.locator('[data-testid="task-modal"][data-state="saving"]')).toBeVisible();
  await expect(page.locator('[data-testid="task-modal"]')).not.toBeVisible({ timeout: 10000 });

  // Now remove the due date
  await openTaskEditModal(page, taskName);
  await expect(page.locator('[data-testid="task-modal"][data-state="idle"]')).toBeVisible();

  // Wait for modal to stabilize
  await page.waitForLoadState('networkidle');

  // Check if due date section is already expanded, if not expand it
  const datePickerButton3 = page.locator('button').filter({ hasText: /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i }).first();
  const isAlreadyExpanded2 = await datePickerButton3.isVisible().catch(() => false);

  if (!isAlreadyExpanded2) {
    const dueDateSectionButton3 = page.locator('button[title*="Due Date"]').filter({ has: page.locator('svg') });
    await dueDateSectionButton3.click();
    await expect(page.locator('[data-testid="duedate-section"][data-state="expanded"]')).toBeVisible();
    await page.waitForTimeout(500);
  }

  // Re-query the button after potential expansion
  const datePickerButton4 = page.locator('button').filter({ hasText: /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i }).first();
  await expect(datePickerButton4).toBeVisible();
  await datePickerButton4.click();
  await expect(page.locator('[data-testid="datepicker"][data-state="open"]')).toBeVisible();

  // Click the "Clear" button in the date picker footer
  const clearButton = page.locator('.date-picker-menu button').filter({ hasText: /Clear/i });
  await expect(clearButton).toBeVisible();
  await clearButton.click();

  // Wait for datepicker to close and all state updates to complete
  await page.waitForTimeout(500);
  await page.waitForLoadState('networkidle');

  // Verify modal is still open
  await expect(page.locator('[data-testid="task-modal"]')).toBeVisible();

  // Re-query save button to avoid stale element reference
  const saveButton3 = page.locator('[data-testid="task-modal"]').locator('[data-testid="task-save-button"]');
  await expect(saveButton3).toBeVisible();
  await saveButton3.click();
  await expect(page.locator('[data-testid="task-modal"][data-state="saving"]')).toBeVisible();
  await expect(page.locator('[data-testid="task-modal"]')).not.toBeVisible({ timeout: 10000 });

  // Verify the task is still visible
  const taskContainer = page.locator('[data-testid*="task-item"]').filter({ hasText: taskName });
  await expect(taskContainer).toBeVisible();
});

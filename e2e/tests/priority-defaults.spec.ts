import { test, expect, Page } from '@playwright/test';
import {
  login,
  navigateAndWait,
  waitForElement,
  hoverAndWaitForVisible,
  createUniqueEntity,
  waitForNetworkIdle
} from '../helpers/testHelpers';

// Helper to create a task
async function createTask(page: Page, taskName: string) {
  const taskInput = page.locator('[data-testid="new-task-input"]');
  await taskInput.fill(taskName);
  await taskInput.press('Enter');
  await waitForNetworkIdle(page);
}

// Helper to open task edit modal
async function openTaskEditModal(page: Page, taskName: string) {
  const taskContainer = page.locator('[data-testid*="task-item"]').filter({ hasText: taskName });
  await expect(taskContainer).toBeVisible({ timeout: 15000 });

  const editButton = taskContainer.locator('[data-testid*="task-edit"]');
  await hoverAndWaitForVisible(taskContainer, editButton);

  await editButton.click();

  const taskNameInput = page.locator('[data-testid="task-name-input"]');
  await waitForElement(taskNameInput, { timeout: 15000 });

  return taskNameInput;
}

// Helper to create a project
async function createProject(page: Page, projectName: string) {
  // Find the "Add Project" button in the sidebar
  const addProjectButton = page.locator('button[aria-label="Add Project"]');
  await expect(addProjectButton).toBeVisible();

  // Click the Add Project button
  await addProjectButton.click();

  // Wait for the Project Modal to appear
  await expect(page.locator('input[name="name"]')).toBeVisible({ timeout: 10000 });

  // Fill in the project name
  const nameInput = page.locator('[data-testid="project-name-input"]');
  await nameInput.click();
  await nameInput.clear();
  await nameInput.fill(projectName);

  // Verify the field has the expected value
  await expect(nameInput).toHaveValue(projectName, { timeout: 2000 });

  // Wait for the save button to be enabled
  const saveButton = page.locator('[data-testid="project-save-button"]');
  await expect(saveButton).toBeEnabled();

  // Save the project
  await saveButton.click();

  // Wait for modal to close
  await expect(page.locator('[data-testid="project-modal"]')).not.toBeVisible({ timeout: 15000 });
}

// Helper to open project edit modal
async function openProjectEditModal(page: Page, projectName: string) {
  // Click on the project in the projects list
  const projectCard = page.locator('[data-testid*="project-card"]').filter({ hasText: projectName });
  await expect(projectCard).toBeVisible({ timeout: 15000 });

  // Click the edit button
  const editButton = projectCard.locator('[data-testid*="project-edit"]');
  await expect(editButton).toBeVisible();
  await editButton.click();

  // Wait for modal to open
  const nameInput = page.locator('[data-testid="project-name-input"]');
  await waitForElement(nameInput, { timeout: 15000 });

  return nameInput;
}

test('task created without priority selection defaults to None', async ({ page, baseURL }) => {
  const appUrl = await login(page, baseURL);

  await navigateAndWait(page, appUrl + '/tasks');

  // Create a task without setting any priority
  const taskName = createUniqueEntity('Default Priority Task');
  await createTask(page, taskName);

  // Open the task edit modal
  await openTaskEditModal(page, taskName);

  // Wait for modal to be in idle state
  await expect(page.locator('[data-testid="task-modal"][data-state="idle"]')).toBeVisible();

  // Click the priority section icon to expand the priority section
  const prioritySectionButton = page.locator('button[title*="Priority"]').filter({ has: page.locator('svg') });
  await prioritySectionButton.click();

  // Wait for priority section to be expanded
  await expect(page.locator('[data-testid="priority-section"][data-state="expanded"]')).toBeVisible();

  // Check that the priority dropdown shows "None"
  const priorityDropdown = page.locator('[data-testid="priority-dropdown"]');
  await expect(priorityDropdown).toBeVisible();

  // The dropdown should contain "None" text
  await expect(priorityDropdown).toContainText(/none/i);

  // Close modal without saving
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="task-modal"]')).not.toBeVisible({ timeout: 5000 });
});

test('project created without priority selection defaults to None', async ({ page, baseURL }) => {
  const appUrl = await login(page, baseURL);

  await navigateAndWait(page, appUrl + '/projects');

  // Click the "Add Project" button
  const addProjectButton = page.locator('button[aria-label="Add Project"]');
  await expect(addProjectButton).toBeVisible();
  await addProjectButton.click();

  // Wait for the Project Modal to appear
  await expect(page.locator('[data-testid="project-modal"]')).toBeVisible({ timeout: 10000 });

  // Fill in the project name
  const projectName = createUniqueEntity('Default Priority Project');
  const nameInput = page.locator('[data-testid="project-name-input"]');
  await nameInput.fill(projectName);

  // Click the priority section icon to expand the priority section
  const prioritySectionButton = page.locator('button[title*="Priority"]').filter({ has: page.locator('svg') });
  await expect(prioritySectionButton).toBeVisible();
  await prioritySectionButton.click();

  // Wait for priority section to be expanded
  await page.waitForTimeout(300);

  // Check that the priority dropdown shows "None"
  const priorityDropdown = page.locator('[data-testid="priority-dropdown"]');
  await expect(priorityDropdown).toBeVisible();

  // The dropdown should contain "None" text
  await expect(priorityDropdown).toContainText(/none/i);

  // Close modal without saving
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="project-modal"]')).not.toBeVisible({ timeout: 5000 });
});

test('task priority can be set to None after being set to High', async ({ page, baseURL }) => {
  const appUrl = await login(page, baseURL);

  await navigateAndWait(page, appUrl + '/tasks');

  // Create a task
  const taskName = createUniqueEntity('Priority Clear Task');
  await createTask(page, taskName);

  // Open the task edit modal
  await openTaskEditModal(page, taskName);

  // Wait for modal to be in idle state
  await expect(page.locator('[data-testid="task-modal"][data-state="idle"]')).toBeVisible();

  // Expand priority section
  const prioritySectionButton = page.locator('button[title*="Priority"]').filter({ has: page.locator('svg') });
  await prioritySectionButton.click();
  await expect(page.locator('[data-testid="priority-section"][data-state="expanded"]')).toBeVisible();

  // Set priority to High
  const priorityDropdown = page.locator('[data-testid="priority-dropdown"]');
  await priorityDropdown.click();
  await expect(page.locator('[data-testid="priority-dropdown"][data-state="open"]')).toBeVisible();

  const highPriorityOption = page.locator('[data-testid="priority-option-high"]');
  await expect(highPriorityOption).toBeVisible();
  await highPriorityOption.click();

  await expect(page.locator('[data-testid="priority-dropdown"][data-state="closed"]')).toBeVisible();

  // Verify High is selected
  await expect(priorityDropdown).toContainText(/high/i);

  // Now clear the priority by selecting None
  await priorityDropdown.click();
  await expect(page.locator('[data-testid="priority-dropdown"][data-state="open"]')).toBeVisible();

  const nonePriorityOption = page.locator('[data-testid="priority-option-none"]');
  await expect(nonePriorityOption).toBeVisible();
  await nonePriorityOption.click();

  await expect(page.locator('[data-testid="priority-dropdown"][data-state="closed"]')).toBeVisible();

  // Verify None is now selected
  await expect(priorityDropdown).toContainText(/none/i);

  // Close modal without saving
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="task-modal"]')).not.toBeVisible({ timeout: 5000 });
});

test('project priority can be set to None after being set to Medium', async ({ page, baseURL }) => {
  const appUrl = await login(page, baseURL);

  await navigateAndWait(page, appUrl + '/projects');

  // Click the "Add Project" button
  const addProjectButton = page.locator('button[aria-label="Add Project"]');
  await expect(addProjectButton).toBeVisible();
  await addProjectButton.click();

  // Wait for the Project Modal to appear
  await expect(page.locator('[data-testid="project-modal"]')).toBeVisible({ timeout: 10000 });

  // Fill in the project name
  const projectName = createUniqueEntity('Priority Clear Project');
  const nameInput = page.locator('[data-testid="project-name-input"]');
  await nameInput.fill(projectName);

  // Expand priority section
  const prioritySectionButton = page.locator('button[title*="Priority"]').filter({ has: page.locator('svg') });
  await expect(prioritySectionButton).toBeVisible();
  await prioritySectionButton.click();
  await page.waitForTimeout(300);

  // Set priority to Medium
  const priorityDropdown = page.locator('[data-testid="priority-dropdown"]');
  await priorityDropdown.click();
  await page.waitForTimeout(200);

  const mediumPriorityOption = page.locator('[data-testid="priority-option-medium"]');
  await expect(mediumPriorityOption).toBeVisible();
  await mediumPriorityOption.click();
  await page.waitForTimeout(200);

  // Verify Medium is selected
  await expect(priorityDropdown).toContainText(/medium/i);

  // Now clear the priority by selecting None
  await priorityDropdown.click();
  await page.waitForTimeout(200);

  const nonePriorityOption = page.locator('[data-testid="priority-option-none"]');
  await expect(nonePriorityOption).toBeVisible();
  await nonePriorityOption.click();
  await page.waitForTimeout(200);

  // Verify None is now selected
  await expect(priorityDropdown).toContainText(/none/i);

  // Close modal without saving
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="project-modal"]')).not.toBeVisible({ timeout: 5000 });
});

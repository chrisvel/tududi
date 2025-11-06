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
  const addProjectButton = page.locator('button[aria-label="Add Project"]');
  await expect(addProjectButton).toBeVisible();
  await addProjectButton.click();

  await expect(page.locator('input[name="name"]')).toBeVisible({ timeout: 10000 });

  const nameInput = page.locator('[data-testid="project-name-input"]');
  await nameInput.click();
  await nameInput.clear();
  await nameInput.fill(projectName);

  await expect(nameInput).toHaveValue(projectName, { timeout: 2000 });

  const saveButton = page.locator('[data-testid="project-save-button"]');
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  await expect(page.locator('[data-testid="project-modal"]')).not.toBeVisible({ timeout: 15000 });
}

test('comprehensive project assignment functionality in task modal', async ({ page, baseURL }) => {
  const appUrl = await login(page, baseURL);

  // === SETUP: Create two projects ===
  await navigateAndWait(page, appUrl + '/projects');
  const project1Name = createUniqueEntity('First Project');
  await createProject(page, project1Name);

  const project2Name = createUniqueEntity('Second Project');
  await createProject(page, project2Name);

  // Navigate to tasks page
  await navigateAndWait(page, appUrl + '/tasks');

  // Create a task
  const taskName = createUniqueEntity('Task with Project');
  await createTask(page, taskName);

  // === TEST 1: Assign project using keyboard navigation ===
  await openTaskEditModal(page, taskName);
  await expect(page.locator('[data-testid="task-modal"][data-state="idle"]')).toBeVisible();

  let taskModal = page.locator('[data-testid="task-modal"]');
  let projectSectionButton = taskModal.locator('button[title="Project"]').filter({ has: page.locator('svg') });
  await projectSectionButton.click();

  let projectSearchInput = page.locator('input[placeholder*="Search or create"]');
  await expect(projectSearchInput).toBeVisible({ timeout: 5000 });
  await projectSearchInput.fill(project1Name);
  await page.waitForTimeout(500);

  // Use arrow down + Enter
  await projectSearchInput.press('ArrowDown');
  await projectSearchInput.press('Enter');

  // Verify badge appears and input is hidden
  let projectBadge = taskModal.locator('span').filter({ hasText: project1Name });
  await expect(projectBadge).toBeVisible();
  await expect(projectSearchInput).not.toBeVisible();

  // === TEST 2: Cannot add a second project (single project restriction) ===
  // Badge should be visible, no input available
  const inputStillGone = page.locator('input[placeholder*="Search or create"]');
  await expect(inputStillGone).not.toBeVisible();

  // === TEST 3: Remove project by clicking × button ===
  const removeButton = projectBadge.locator('button');
  await expect(removeButton).toBeVisible();
  await removeButton.click();

  // Badge should disappear, input should reappear
  await expect(projectBadge).not.toBeVisible();
  projectSearchInput = page.locator('input[placeholder*="Search or create"]');
  await expect(projectSearchInput).toBeVisible();

  // === TEST 4: Exact match auto-selection with Enter ===
  // Type exact project name and press Enter (no arrow keys needed)
  await projectSearchInput.fill(project2Name);
  await page.waitForTimeout(500);
  await projectSearchInput.press('Enter');

  // Verify project is selected immediately
  projectBadge = taskModal.locator('span').filter({ hasText: project2Name });
  await expect(projectBadge).toBeVisible();
  await expect(projectSearchInput).not.toBeVisible();

  // Test complete - all project assignment functionality verified
  // No need to close modal as test is finished
});

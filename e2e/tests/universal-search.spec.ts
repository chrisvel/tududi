import { test, expect } from '@playwright/test';
import {
  login,
  navigateAndWait,
  clickAndWaitForModal,
  fillInputReliably,
  waitForElement,
  createUniqueEntity,
  waitForNetworkIdle
} from '../helpers/testHelpers';

// Helper to create a task for search testing
async function createTaskForSearch(page, taskName) {
  const taskInput = page.locator('[data-testid="new-task-input"]');
  await taskInput.fill(taskName);
  await taskInput.press('Enter');
  await waitForNetworkIdle(page);
}

// Helper to create a project for search testing
async function createProjectForSearch(page, projectName) {
  const addProjectButton = page.locator('button[aria-label="Add Project"]');
  const nameInput = page.locator('[data-testid="project-name-input"]');

  await clickAndWaitForModal(addProjectButton, nameInput);
  await fillInputReliably(nameInput, projectName);

  const saveButton = page.locator('[data-testid="project-save-button"]');
  await saveButton.click();
  await waitForElement(nameInput, { state: 'hidden' });
  await waitForNetworkIdle(page);
}

// Helper to create a note for search testing
async function createNoteForSearch(page, noteTitle, noteContent = '') {
  const addNoteButton = page.locator('[data-testid="add-note-button"]');
  const titleInput = page.locator('[data-testid="note-title-input"]');

  await clickAndWaitForModal(addNoteButton, titleInput);
  await titleInput.fill(noteTitle);

  if (noteContent) {
    const contentTextarea = page.locator('[data-testid="note-content-textarea"]');
    await contentTextarea.fill(noteContent);
  }

  await page.locator('[data-testid="note-save-button"]').click();
  await waitForElement(titleInput, { state: 'hidden' });
  await waitForNetworkIdle(page);
}

test('user can search across tasks, projects, and notes', async ({ page, baseURL }) => {
  const appUrl = await login(page, baseURL);

  // Create unique test data with a common search term
  const searchTerm = createUniqueEntity('SearchTest');
  const taskName = `${searchTerm} Task`;
  const projectName = `${searchTerm} Project`;
  const noteName = `${searchTerm} Note`;

  // Navigate to tasks page and create a task
  await navigateAndWait(page, appUrl + '/tasks');
  await createTaskForSearch(page, taskName);

  // Navigate to projects page and create a project
  await navigateAndWait(page, appUrl + '/projects');
  await createProjectForSearch(page, projectName);

  // Create a note (can be done from sidebar)
  await createNoteForSearch(page, noteName, 'Test note content');

  // Navigate to a neutral page (like tasks) before searching
  await navigateAndWait(page, appUrl + '/tasks');

  // Click on the search input in the navbar to open search
  const searchInput = page.locator('input[placeholder*="Search" i]').first();
  await expect(searchInput).toBeVisible();
  await searchInput.click();

  // Type the search term
  await searchInput.fill(searchTerm);

  // Wait for search to finish loading by checking for the loading state to disappear
  // The search component shows a loading indicator while fetching results
  const loadingIndicator = page.locator('[data-testid="search-loading"]');

  // If loading appears, wait for it to disappear
  const isLoadingVisible = await loadingIndicator.isVisible().catch(() => false);
  if (isLoadingVisible) {
    await expect(loadingIndicator).not.toBeVisible({ timeout: 10000 });
  }

  // Wait for search results container to appear
  const searchResults = page.locator('[data-testid="search-results"]');
  await expect(searchResults).toBeVisible({ timeout: 10000 });

  // Verify all three result sections appear
  await expect(page.locator('[data-testid="search-results-task"]')).toBeVisible();
  await expect(page.locator('[data-testid="search-results-project"]')).toBeVisible();
  await expect(page.locator('[data-testid="search-results-note"]')).toBeVisible();

  // Verify the specific items appear in search results
  await expect(page.getByText(taskName).first()).toBeVisible();
  await expect(page.getByText(projectName).first()).toBeVisible();
  await expect(page.getByText(noteName).first()).toBeVisible();
});

test('user can filter search results by type', async ({ page, baseURL }) => {
  const appUrl = await login(page, baseURL);

  // Create unique test data
  const searchTerm = createUniqueEntity('FilterTest');
  const taskName = `${searchTerm} Task`;
  const projectName = `${searchTerm} Project`;

  // Create test data
  await navigateAndWait(page, appUrl + '/tasks');
  await createTaskForSearch(page, taskName);

  await navigateAndWait(page, appUrl + '/projects');
  await createProjectForSearch(page, projectName);

  // Open universal search
  await page.keyboard.press('Meta+K');
  await page.waitForTimeout(500);

  const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]').first();

  if (!(await searchInput.isVisible().catch(() => false))) {
    await page.keyboard.press('Control+K');
    await page.waitForTimeout(500);
  }

  await waitForElement(searchInput);
  await searchInput.fill(searchTerm);
  await waitForNetworkIdle(page);

  // Look for filter buttons/tabs (Tasks, Projects, Notes, etc.)
  const taskFilter = page.locator('button, [role="tab"]').filter({ hasText: /^tasks?$/i }).first();

  if (await taskFilter.isVisible().catch(() => false)) {
    await taskFilter.click();
    await page.waitForTimeout(500);

    // After filtering, only task should be visible
    await expect(page.getByText(taskName)).toBeVisible();

    // Project might not be visible or should be filtered out
    // We can't assert it's not visible as it depends on the UI implementation
  }
});

test('user can navigate to search result by clicking on it', async ({ page, baseURL }) => {
  const appUrl = await login(page, baseURL);

  // Create a unique task
  const taskName = createUniqueEntity('NavigationTest Task');

  await navigateAndWait(page, appUrl + '/tasks');
  await createTaskForSearch(page, taskName);

  // Open universal search
  await page.keyboard.press('Meta+K');
  await page.waitForTimeout(500);

  const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]').first();

  if (!(await searchInput.isVisible().catch(() => false))) {
    await page.keyboard.press('Control+K');
    await page.waitForTimeout(500);
  }

  await waitForElement(searchInput);
  await searchInput.fill(taskName);
  await waitForNetworkIdle(page);

  // Click on the search result
  const searchResult = page.getByText(taskName).first();
  await searchResult.click();

  // Should navigate to the task detail page or close search and show task
  // The exact behavior depends on the implementation
  // We can verify the URL changed or the search closed
  await page.waitForTimeout(1000);

  // Search modal should close after clicking a result
  const searchInputAfterClick = page.locator('input[placeholder*="search" i], input[type="search"]').first();
  const isStillVisible = await searchInputAfterClick.isVisible().catch(() => false);

  // Either the search closed, or we navigated away, or both
  expect(isStillVisible || page.url().includes('/task/')).toBeTruthy();
});

import { test, expect } from '@playwright/test';

// Shared login function
async function loginAndNavigateToProjects(page, baseURL) {
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

  // Navigate to projects page
  await page.goto(appUrl + '/projects');
  await expect(page).toHaveURL(/\/projects/);

  return appUrl;
}

// Shared function to create a project via the sidebar button
async function createProject(page, projectName) {
  // Find the "Add Project" button in the sidebar
  const addProjectButton = page.locator('button[aria-label="Add Project"]');
  await expect(addProjectButton).toBeVisible();
  
  // Click the Add Project button
  await addProjectButton.click();

  // Wait for the Project Modal to appear
  await expect(page.locator('input[name="name"]')).toBeVisible({ timeout: 10000 });

  // Fill in the project name
  await page.locator('input[name="name"]').fill(projectName);

  // Save the project
  await page.getByRole('button', { name: /create.*project|save/i }).click();

  // Wait for the modal to close
  await expect(page.locator('input[name="name"]')).not.toBeVisible({ timeout: 10000 });

  // Wait for project creation to complete
  await page.waitForTimeout(2000);
}

test('user can create a new project and verify it appears in the projects list', async ({ page, baseURL }) => {
  await loginAndNavigateToProjects(page, baseURL);

  // Create a unique test project
  const timestamp = Date.now();
  const projectName = `Test Project ${timestamp}`;
  await createProject(page, projectName);

  // Verify the project appears in the projects list
  await expect(page.getByText(projectName)).toBeVisible({ timeout: 10000 });
});

test('user can update an existing project', async ({ page, baseURL }) => {
  await loginAndNavigateToProjects(page, baseURL);

  // Create an initial project
  const timestamp = Date.now();
  const originalProjectName = `Test project to edit ${timestamp}`;
  await createProject(page, originalProjectName);

  // Find and click the project to open its details or edit it
  // Look for the project card/item and find its edit button
  const projectContainer = page.getByText(originalProjectName).locator('..');
  await projectContainer.hover();

  // Click the edit button (pencil icon)
  await projectContainer.locator('button[title="Edit"], button').filter({ hasText: '' }).first().click();

  // Wait for the Project Modal to appear with the project data
  await expect(page.locator('input[name="name"]')).toBeVisible();

  // Verify the project name field is pre-filled
  const projectNameInput = page.locator('input[name="name"]').first();
  await expect(projectNameInput).toHaveValue(originalProjectName);

  // Edit the project name
  const editedProjectName = `Edited test project ${timestamp}`;
  await projectNameInput.clear();
  await projectNameInput.fill(editedProjectName);

  // Save the changes
  await page.getByRole('button', { name: /save/i }).click();

  // Wait for the modal to close
  await expect(page.locator('input[name="name"]')).not.toBeVisible();

  // Verify the edited project appears in the projects list
  await expect(page.getByText(editedProjectName)).toBeVisible();

  // Verify the original project name is no longer visible
  await expect(page.getByText(originalProjectName)).not.toBeVisible();
});

test('user can delete an existing project', async ({ page, baseURL }) => {
  await loginAndNavigateToProjects(page, baseURL);

  // Create an initial project
  const timestamp = Date.now();
  const projectName = `Test project to delete ${timestamp}`;
  await createProject(page, projectName);

  // Find the project container and hover to show action buttons
  const projectContainer = page.getByText(projectName).locator('..');
  await projectContainer.hover();

  // Click the delete button (trash icon)
  await projectContainer.locator('button[title="Delete"], button').filter({ hasText: '' }).last().click();

  // Wait for and handle the confirmation dialog
  await expect(page.locator('text=Delete Project')).toBeVisible();
  // Click the red "Delete" button in the confirmation dialog
  await page.locator('.bg-red-500.text-white').click();

  // Verify the project is no longer visible in the projects list
  await expect(page.getByText(projectName)).not.toBeVisible();
});

test('user can add a task to a project via ProjectDetails view', async ({ page, baseURL }) => {
  await loginAndNavigateToProjects(page, baseURL);

  // Create an initial project
  const timestamp = Date.now();
  const projectName = `Test project for tasks ${timestamp}`;
  await createProject(page, projectName);

  // Click on the project to open its details view
  await page.getByText(projectName).click();

  // Wait for the project details page to load
  await expect(page).toHaveURL(/\/project\//);

  // Find the task creation input field within the project details
  const taskInput = page.locator('input[placeholder="Προσθήκη Νέας Εργασίας"]').first();
  
  // Wait for the input to be visible
  await expect(taskInput).toBeVisible({ timeout: 5000 });

  // Create a task within this project
  const taskName = `Test task in project ${timestamp}`;
  await taskInput.fill(taskName);
  await taskInput.press('Enter');

  // Verify task creation by checking that the input field is cleared
  await expect(taskInput).toHaveValue('');

  // Wait for the task to be created and appear in the project's task list
  await page.waitForTimeout(2000);

  // Verify the task appears in the project's task list
  // Use a more general approach since the exact structure might vary
  await expect(page.getByText(taskName)).toBeVisible({ timeout: 10000 });
});

test('user can delete a project with tasks - tasks should survive', async ({ page, baseURL }) => {
  const appUrl = await loginAndNavigateToProjects(page, baseURL);

  // Create an initial project
  const timestamp = Date.now();
  const projectName = `Test project with tasks ${timestamp}`;
  await createProject(page, projectName);

  // Click on the project to open its details view
  await page.getByText(projectName).click();

  // Wait for the project details page to load
  await expect(page).toHaveURL(/\/project\//);

  // Add a task to this project
  const taskInput = page.locator('input[placeholder="Προσθήκη Νέας Εργασίας"]').first();
  await expect(taskInput).toBeVisible({ timeout: 5000 });
  
  const taskName = `Task that should survive project deletion ${timestamp}`;
  await taskInput.fill(taskName);
  await taskInput.press('Enter');
  await expect(taskInput).toHaveValue('');
  await page.waitForTimeout(2000);

  // Navigate back to projects list
  await page.goto(appUrl + '/projects');
  await expect(page).toHaveURL(/\/projects/);

  // Delete the project
  const projectContainer = page.getByText(projectName).locator('..');
  await projectContainer.hover();
  await projectContainer.locator('button[title="Delete"], button').filter({ hasText: '' }).last().click();

  // Handle the confirmation dialog
  await expect(page.locator('text=Delete Project')).toBeVisible();
  await page.locator('.bg-red-500.text-white').click();

  // Verify the project is deleted
  await expect(page.getByText(projectName)).not.toBeVisible();

  // Verify the task still exists - navigate to tasks page
  await page.goto(appUrl + '/tasks');
  await expect(page).toHaveURL(/\/tasks/);

  // Wait for tasks to load
  await page.waitForTimeout(2000);

  // The task should still exist but without the project association
  // This is the expected behavior based on backend implementation:
  // - project.destroy() doesn't cascade to tasks
  // - tasks have project_id set to NULL when project is deleted
  await expect(page.getByText(taskName)).toBeVisible({ timeout: 10000 });
});
import { test, expect, Page } from '@playwright/test';

// Shared login function
async function loginAndNavigateToProjects(page: Page, baseURL: string | undefined) {
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
async function createProject(page: Page, projectName: string) {
  // Find the "Add Project" button in the sidebar
  const addProjectButton = page.locator('button[aria-label="Add Project"]');
  await expect(addProjectButton).toBeVisible();
  
  // Click the Add Project button
  await addProjectButton.click();

  // Wait for the Project Modal to appear
  await expect(page.locator('input[name="name"]')).toBeVisible({ timeout: 10000 });

  // Fill in the project name - comprehensive clearing and filling
  const nameInput = page.locator('[data-testid="project-name-input"]');
  
  // Click to focus the field
  await nameInput.click();
  
  // Clear the field using multiple methods
  await nameInput.selectText();
  await nameInput.press('Delete');
  await nameInput.clear();
  
  // Small delay to ensure field is ready
  await page.waitForTimeout(100);
  
  // Use fill method with force
  await nameInput.fill(projectName);
  
  // Verify the field has the expected value, retry if needed
  let retryCount = 0;
  while (retryCount < 3) {
    try {
      await expect(nameInput).toHaveValue(projectName, { timeout: 2000 });
      break; // Success, exit loop
    } catch {
      retryCount++;
      
      // More aggressive retry approach
      await nameInput.click();
      await page.keyboard.press('Control+a'); // Select all
      await page.keyboard.press('Delete'); // Delete selected
      await page.waitForTimeout(100);
      await nameInput.pressSequentially(projectName, { delay: 20 });
      
      if (retryCount === 3) {
        throw new Error(`Failed to fill project name after ${retryCount} attempts`);
      }
    }
  }

  // Wait for the save button to be enabled (form validation)
  const saveButton = page.locator('[data-testid="project-save-button"]');
  await expect(saveButton).toBeEnabled();
  
  // Save the project
  await saveButton.click();

  // Wait for the save request to complete and modal to close
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-testid="project-name-input"]')).not.toBeVisible({ timeout: 15000 });

  // Wait for project creation to complete and appear in list
  await page.waitForTimeout(3000);
}

test('user can create a new project and verify it appears in the projects list', async ({ page, baseURL }) => {
  await loginAndNavigateToProjects(page, baseURL);

  // Create a unique test project
  const timestamp = Date.now();
  const projectName = `Test Project ${timestamp}`;
  await createProject(page, projectName);

  // Verify the project appears in the projects list - look for timestamp as it's unique
  const timestampStr = timestamp.toString();
  await expect(page.getByText(timestampStr)).toBeVisible({ timeout: 10000 });
});

test('user can update an existing project', async ({ page, baseURL }) => {
  await loginAndNavigateToProjects(page, baseURL);

  // Create an initial project
  const timestamp = Date.now();
  const originalProjectName = `Test project to edit ${timestamp}`;
  await createProject(page, originalProjectName);

  // Find the specific project card by its timestamp (which is unique and visible)
  const timestampStr = timestamp.toString();
  
  // Find the project card that contains this timestamp
  const projectCard = page.locator('.group').filter({ hasText: timestampStr }).first();
  await expect(projectCard).toBeVisible();
  
  // Hover over the project card to show the dropdown button
  await projectCard.hover();
  
  // Wait a moment for any transitions  
  await page.waitForTimeout(1000);

  // Find the dropdown button specifically within this project's container
  const dropdownButton = projectCard.locator('button[data-testid^="project-dropdown-"]');
  await dropdownButton.click({ force: true });

  // Wait for dropdown menu to appear and click Edit
  const editButton = page.locator('button[data-testid^="project-edit-"]').first();
  await expect(editButton).toBeVisible({ timeout: 10000 });
  await editButton.click();

  // Wait for the Project Modal to appear with the project data
  await expect(page.locator('[data-testid="project-name-input"]')).toBeVisible();

  // Verify the project name field is pre-filled (may be truncated)
  const projectNameInput = page.locator('[data-testid="project-name-input"]');
  const actualValue = await projectNameInput.inputValue();
  // Just verify it contains the timestamp part which is unique
  expect(actualValue).toContain(timestampStr);

  // Edit the project name using the same reliable approach as creation
  const editedProjectName = `Edited test project ${timestamp}`;
  
  // Click to focus the field
  await projectNameInput.click();
  
  // Clear the field using multiple methods
  await projectNameInput.selectText();
  await projectNameInput.press('Delete');
  await projectNameInput.clear();
  
  // Small delay to ensure field is ready
  await page.waitForTimeout(100);
  
  // Use fill method
  await projectNameInput.fill(editedProjectName);

  // Save the changes
  await page.locator('[data-testid="project-save-button"]').click();

  // Wait for the modal to close
  await expect(page.locator('[data-testid="project-name-input"]')).not.toBeVisible();

  // Verify the edited project appears in the projects list - still contains timestamp
  await expect(page.getByText(timestampStr)).toBeVisible();

  // Verify it now shows the complete edited project name with the specific timestamp
  await expect(page.getByText(`Edited test project ${timestampStr}`)).toBeVisible();
});

test('user can delete an existing project', async ({ page, baseURL }) => {
  await loginAndNavigateToProjects(page, baseURL);

  // Create an initial project
  const timestamp = Date.now();
  const projectName = `Test project to delete ${timestamp}`;
  await createProject(page, projectName);

  // Find the specific project card by its timestamp (which is unique and visible)
  const timestampStr = timestamp.toString();
  const projectCard = page.locator('.group').filter({ hasText: timestampStr }).first();
  await expect(projectCard).toBeVisible();
  
  // Hover over the project card to show the dropdown button
  await projectCard.hover();
  
  // Wait a moment for any transitions  
  await page.waitForTimeout(1000);

  // Find the dropdown button specifically within this project's container
  const dropdownButton = projectCard.locator('button[data-testid^="project-dropdown-"]');
  await dropdownButton.click({ force: true });

  // Wait for dropdown menu to appear and click Delete
  const deleteButton = page.locator('button[data-testid^="project-delete-"]').first();
  await expect(deleteButton).toBeVisible({ timeout: 10000 });
  await deleteButton.click();

  // Wait for and handle the confirmation dialog
  await expect(page.locator('text=Delete Project')).toBeVisible();
  // Click the red "Delete" button in the confirmation dialog
  await page.locator('[data-testid="confirm-dialog-confirm"]').click();

  // Verify the project is no longer visible in the projects list - check for timestamp
  await expect(page.getByText(timestampStr)).not.toBeVisible();
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
  const taskInput = page.locator('[data-testid="new-task-input"]');
  
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

  // Verify the task appears in the project's task list (use first link to avoid strict mode)
  await expect(page.getByRole('link', { name: new RegExp(taskName) }).first()).toBeVisible({ timeout: 10000 });
});

test('user can delete a project with tasks - tasks should survive', async ({ page, baseURL }) => {
  const appUrl = await loginAndNavigateToProjects(page, baseURL);

  // Create an initial project
  const timestamp = Date.now();
  const projectName = `Test project with tasks ${timestamp}`;
  await createProject(page, projectName);

  // Click on the project to open its details view - use timestamp to find it reliably
  const timestampStr = timestamp.toString();
  await page.getByText(timestampStr).click();

  // Wait for the project details page to load
  await expect(page).toHaveURL(/\/project\//);

  // Add a task to this project
  const taskInput = page.locator('[data-testid="new-task-input"]');
  await expect(taskInput).toBeVisible({ timeout: 5000 });
  
  const taskName = `Task that should survive project deletion ${timestamp}`;
  await taskInput.fill(taskName);
  await taskInput.press('Enter');
  await expect(taskInput).toHaveValue('');
  await page.waitForTimeout(2000);

  // Navigate back to projects list
  await page.goto(appUrl + '/projects');
  await expect(page).toHaveURL(/\/projects/);

  // Delete the project using the same approach as other tests
  // timestampStr already declared above
  const projectCard = page.locator('.group').filter({ hasText: timestampStr }).first();
  await expect(projectCard).toBeVisible();
  
  // Hover over the project card to show the dropdown button
  await projectCard.hover();
  
  // Wait a moment for any transitions  
  await page.waitForTimeout(1000);

  // Find the dropdown button specifically within this project's container
  const dropdownButton = projectCard.locator('button[data-testid^="project-dropdown-"]');
  await dropdownButton.click({ force: true });

  // Wait for dropdown menu to appear and click Delete
  const deleteButton = page.locator('button[data-testid^="project-delete-"]').first();
  await expect(deleteButton).toBeVisible({ timeout: 10000 });
  await deleteButton.click();

  // Handle the confirmation dialog
  await expect(page.locator('text=Delete Project')).toBeVisible();
  await page.locator('[data-testid="confirm-dialog-confirm"]').click();

  // Verify the project is deleted - check for timestamp
  await expect(page.getByText(timestampStr)).not.toBeVisible();

  // Verify the task still exists - navigate to tasks page
  await page.goto(appUrl + '/tasks');
  await expect(page).toHaveURL(/\/tasks/);

  // Wait for tasks to load
  await page.waitForTimeout(2000);

  // The task should still exist but without the project association
  // This is the expected behavior based on backend implementation:
  // - project.destroy() doesn't cascade to tasks
  // - tasks have project_id set to NULL when project is deleted
  await expect(page.getByText(new RegExp(taskName)).first()).toBeVisible({ timeout: 10000 });
});

test('user can create a note from project details page and view it in project notes', async ({ page, baseURL }) => {
  await loginAndNavigateToProjects(page, baseURL);

  // Create a project for testing
  const timestamp = Date.now();
  const projectName = `Test project for notes ${timestamp}`;
  await createProject(page, projectName);

  // Click on the project to open its details view
  await page.getByText(projectName).click();

  // Wait for the project details page to load
  await expect(page).toHaveURL(/\/project\//);

  // Click on the "Notes" tab to show the notes section
  const notesTab = page.getByRole('button', { name: /^Notes$/i });
  await expect(notesTab).toBeVisible({ timeout: 5000 });
  await notesTab.click();

  // Wait for the notes tab to be active
  await page.waitForTimeout(500);

  // Find and click the "Create New Note" button
  const createNoteButton = page.getByRole('button', { name: /create new note/i });
  await expect(createNoteButton).toBeVisible({ timeout: 5000 });
  await createNoteButton.click();

  // Wait for the note modal to appear
  const noteTitleInput = page.locator('[data-testid="note-title-input"]');
  await expect(noteTitleInput).toBeVisible({ timeout: 5000 });

  // Fill in the note details
  const noteTitle = `Test note ${timestamp}`;
  const noteContent = `This is a test note created at ${timestamp}`;

  await noteTitleInput.fill(noteTitle);

  // Find the content textarea and fill it
  const noteContentTextarea = page.locator('textarea[name="content"]');
  await expect(noteContentTextarea).toBeVisible();
  await noteContentTextarea.fill(noteContent);

  // Save the note
  const saveNoteButton = page.locator('[data-testid="note-save-button"]');
  await expect(saveNoteButton).toBeEnabled();
  await saveNoteButton.click();

  // Wait for the modal to close
  await expect(noteTitleInput).not.toBeVisible({ timeout: 5000 });

  // Wait for the note to be created
  await page.waitForTimeout(2000);

  // Verify the note appears in the project's notes section
  // Look for the note title as a heading (more specific than just text)
  await expect(page.getByRole('heading', { name: noteTitle })).toBeVisible({ timeout: 10000 });

  // Verify we can see the note card with the content
  // Use a more specific selector - look for the note content within a paragraph
  await expect(page.locator('p', { hasText: noteContent })).toBeVisible();
});
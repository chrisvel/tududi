import { test, expect } from '@playwright/test';

// Shared login function
async function loginAndNavigateToNotes(page, baseURL) {
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

  // Navigate to notes page
  await page.goto(appUrl + '/notes');
  await expect(page).toHaveURL(/\/notes/);

  return appUrl;
}

// Shared function to create a note via the sidebar button
async function createNote(page, noteTitle, noteContent = '') {
  // Find the "Add Note" button in the sidebar
  const addNoteButton = page.locator('[data-testid="add-note-button"]');
  await expect(addNoteButton).toBeVisible();
  
  // Click the Add Note button
  await addNoteButton.click();

  // Wait for the Note Modal to appear
  await expect(page.locator('[data-testid="note-title-input"]')).toBeVisible({ timeout: 10000 });

  // Fill in the note title - focus first, clear, then type
  const titleInput = page.locator('[data-testid="note-title-input"]');
  await titleInput.click();
  await titleInput.clear();
  await titleInput.type(noteTitle, { delay: 50 });

  // Fill in the note content if provided
  if (noteContent) {
    const contentTextarea = page.locator('[data-testid="note-content-textarea"]');
    await contentTextarea.click();
    await contentTextarea.fill(noteContent);
  }

  // Save the note using the specific test ID
  await page.locator('[data-testid="note-save-button"]').click();

  // Wait for the modal to close - wait for it to become not visible
  await expect(page.locator('[data-testid="note-title-input"]')).not.toBeVisible({ timeout: 10000 });

  // Wait for note creation to complete
  await page.waitForTimeout(2000);
}

test('user can create a new note and verify it appears in the notes list', async ({ page, baseURL }) => {
  await loginAndNavigateToNotes(page, baseURL);

  // Create a unique test note
  const timestamp = Date.now();
  const noteTitle = `Test Note ${timestamp}`;
  const noteContent = `This is test content for note ${timestamp}`;
  await createNote(page, noteTitle, noteContent);

  // Verify the note appears in the notes list
  await expect(page.getByText(noteTitle)).toBeVisible({ timeout: 10000 });
});

test('user can update an existing note', async ({ page, baseURL }) => {
  await loginAndNavigateToNotes(page, baseURL);

  // Create an initial note
  const timestamp = Date.now();
  const originalNoteTitle = `Test note to edit ${timestamp}`;
  const originalNoteContent = `Original content ${timestamp}`;
  await createNote(page, originalNoteTitle, originalNoteContent);

  // Find the specific note card by title text
  const noteCard = page.locator('a').filter({ hasText: originalNoteTitle });
  await expect(noteCard).toBeVisible();
  
  // Hover over the note card to show the dropdown button
  await noteCard.hover();
  
  // Wait a moment for any transitions
  await page.waitForTimeout(1000);

  // Find the dropdown button within this specific note card's parent container
  const dropdownButton = noteCard.locator('..').locator('button[data-testid^="note-dropdown-"]');
  await dropdownButton.click({ force: true });

  // Wait for dropdown menu to appear and click Edit
  const editButton = page.locator('button[data-testid^="note-edit-"]').first();
  await expect(editButton).toBeVisible({ timeout: 10000 });
  await editButton.click();

  // Wait for the Note Modal to appear with the note data
  await expect(page.locator('[data-testid="note-title-input"]')).toBeVisible();

  // Verify the note title field is pre-filled
  const noteTitleInput = page.locator('[data-testid="note-title-input"]');
  await expect(noteTitleInput).toHaveValue(originalNoteTitle);

  // Edit the note title and content
  const editedNoteTitle = `Edited test note ${timestamp}`;
  const editedNoteContent = `Edited content ${timestamp}`;
  await noteTitleInput.clear();
  await noteTitleInput.fill(editedNoteTitle);
  
  const noteContentTextarea = page.locator('[data-testid="note-content-textarea"]');
  await noteContentTextarea.clear();
  await noteContentTextarea.fill(editedNoteContent);

  // Save the changes
  await page.locator('[data-testid="note-save-button"]').click();

  // Wait for the modal to close
  await expect(page.locator('[data-testid="note-title-input"]')).not.toBeVisible();

  // Verify the edited note appears in the notes list
  await expect(page.getByText(editedNoteTitle)).toBeVisible();

  // Verify the original note title is no longer visible
  await expect(page.getByText(originalNoteTitle)).not.toBeVisible();
});

test('user can delete an existing note', async ({ page, baseURL }) => {
  await loginAndNavigateToNotes(page, baseURL);

  // Create an initial note
  const timestamp = Date.now();
  const noteTitle = `Test note to delete ${timestamp}`;
  const noteContent = `Content to delete ${timestamp}`;
  await createNote(page, noteTitle, noteContent);

  // Find the specific note card by title text
  const noteCard = page.locator('a').filter({ hasText: noteTitle });
  await expect(noteCard).toBeVisible();
  
  // Hover over the note card to show the dropdown button
  await noteCard.hover();
  
  // Wait a moment for any transitions
  await page.waitForTimeout(1000);

  // Find the dropdown button within this specific note card's parent container
  const dropdownButton = noteCard.locator('..').locator('button[data-testid^="note-dropdown-"]');
  await dropdownButton.click({ force: true });

  // Wait for dropdown menu to appear and click Delete
  const deleteButton = page.locator('button[data-testid^="note-delete-"]').first();
  await expect(deleteButton).toBeVisible({ timeout: 10000 });
  await deleteButton.click();

  // Wait for and handle the confirmation dialog
  await expect(page.locator('text=Delete Note')).toBeVisible();
  // Click the red "Delete" button in the confirmation dialog
  await page.locator('[data-testid="confirm-dialog-confirm"]').click();

  // Verify the note is no longer visible in the notes list (use specific role selector)
  await expect(page.getByRole('link', { name: new RegExp(noteTitle) })).not.toBeVisible();
});
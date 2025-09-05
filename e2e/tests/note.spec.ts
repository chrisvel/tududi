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
  const addNoteButton = page.locator('button[aria-label="Add Note"]');
  await expect(addNoteButton).toBeVisible();
  
  // Click the Add Note button
  await addNoteButton.click();

  // Wait for the Note Modal to appear
  await expect(page.locator('input[name="title"]')).toBeVisible({ timeout: 10000 });

  // Fill in the note title
  await page.locator('input[name="title"]').fill(noteTitle);

  // Fill in the note content if provided
  if (noteContent) {
    await page.locator('textarea[name="content"]').fill(noteContent);
  }

  // Save the note
  await page.getByRole('button', { name: /create.*note|save/i }).click();

  // Wait for the modal to close
  await expect(page.locator('input[name="title"]')).not.toBeVisible({ timeout: 10000 });

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

  // Find and click the note to edit it
  const noteContainer = page.getByText(originalNoteTitle).locator('..');
  await noteContainer.hover();

  // Click the edit button (pencil icon)
  await noteContainer.locator('button[title="Edit"], button').filter({ hasText: '' }).first().click();

  // Wait for the Note Modal to appear with the note data
  await expect(page.locator('input[name="title"]')).toBeVisible();

  // Verify the note title field is pre-filled
  const noteTitleInput = page.locator('input[name="title"]').first();
  await expect(noteTitleInput).toHaveValue(originalNoteTitle);

  // Edit the note title and content
  const editedNoteTitle = `Edited test note ${timestamp}`;
  const editedNoteContent = `Edited content ${timestamp}`;
  await noteTitleInput.clear();
  await noteTitleInput.fill(editedNoteTitle);
  
  const noteContentTextarea = page.locator('textarea[name="content"]').first();
  await noteContentTextarea.clear();
  await noteContentTextarea.fill(editedNoteContent);

  // Save the changes
  await page.getByRole('button', { name: /save/i }).click();

  // Wait for the modal to close
  await expect(page.locator('input[name="title"]')).not.toBeVisible();

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

  // Find the note container and hover to show action buttons
  const noteContainer = page.getByText(noteTitle).locator('..');
  await noteContainer.hover();

  // Click the delete button (trash icon)
  await noteContainer.locator('button[title="Delete"], button').filter({ hasText: '' }).last().click();

  // Wait for and handle the confirmation dialog
  await expect(page.locator('text=Delete Note')).toBeVisible();
  // Click the red "Delete" button in the confirmation dialog
  await page.locator('.bg-red-500.text-white').click();

  // Verify the note is no longer visible in the notes list
  await expect(page.getByText(noteTitle)).not.toBeVisible();
});
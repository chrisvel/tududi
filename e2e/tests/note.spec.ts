import { test, expect } from '@playwright/test';
import {
  login,
  navigateAndWait,
  clickAndWaitForModal,
  fillInputReliably,
  waitForElement,
  hoverAndWaitForVisible,
  confirmDialog,
  createUniqueEntity,
  waitForNetworkIdle
} from '../helpers/testHelpers';

// Navigate to notes page after login
async function loginAndNavigateToNotes(page, baseURL) {
  const appUrl = await login(page, baseURL);

  // Navigate to notes page
  await navigateAndWait(page, appUrl + '/notes');
  await expect(page).toHaveURL(/\/notes/);

  return appUrl;
}

// Shared function to create a note via the sidebar button
async function createNote(page, noteTitle, noteContent = '') {
  // Find and click the "Add Note" button in the sidebar
  const addNoteButton = page.locator('[data-testid="add-note-button"]');
  const titleInput = page.locator('[data-testid="note-title-input"]');

  await clickAndWaitForModal(addNoteButton, titleInput);

  // Fill in the note title
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

  // Wait for the modal to close
  await waitForElement(titleInput, { state: 'hidden' });

  // Wait for note creation to complete
  await waitForNetworkIdle(page);
}

test('user can create a new note and verify it appears in the notes list', async ({ page, baseURL }) => {
  await loginAndNavigateToNotes(page, baseURL);

  // Create a unique test note
  const noteTitle = createUniqueEntity('Test Note');
  const noteContent = 'This is test content for note';
  await createNote(page, noteTitle, noteContent);

  // Verify the note appears in the notes list
  await expect(page.getByText(noteTitle)).toBeVisible();
});

test('user can update an existing note', async ({ page, baseURL }) => {
  await loginAndNavigateToNotes(page, baseURL);

  // Create an initial note
  const originalNoteTitle = createUniqueEntity('Test note to edit');
  const originalNoteContent = 'Original content';
  await createNote(page, originalNoteTitle, originalNoteContent);

  // Find the specific note card by title text
  const noteCard = page.locator('a').filter({ hasText: originalNoteTitle });
  await expect(noteCard).toBeVisible();

  // Hover over the note card and wait for dropdown button to be visible
  const dropdownButton = noteCard.locator('..').locator('button[data-testid^="note-dropdown-"]');
  await hoverAndWaitForVisible(noteCard, dropdownButton);

  // Click dropdown button
  await dropdownButton.click();

  // Wait for dropdown menu to appear and click Edit
  const editButton = page.locator('button[data-testid^="note-edit-"]').first();
  await waitForElement(editButton);
  await editButton.click();

  // Wait for the Note Modal to appear with the note data
  const noteTitleInput = page.locator('[data-testid="note-title-input"]');
  await waitForElement(noteTitleInput);

  // Verify the note title field is pre-filled
  await expect(noteTitleInput).toHaveValue(originalNoteTitle);

  // Edit the note title and content
  const editedNoteTitle = createUniqueEntity('Edited test note');
  const editedNoteContent = 'Edited content';
  await fillInputReliably(noteTitleInput, editedNoteTitle);

  const noteContentTextarea = page.locator('[data-testid="note-content-textarea"]');
  await noteContentTextarea.clear();
  await noteContentTextarea.fill(editedNoteContent);

  // Save the changes
  await page.locator('[data-testid="note-save-button"]').click();

  // Wait for the modal to close
  await waitForElement(noteTitleInput, { state: 'hidden' });

  // Verify the edited note appears in the notes list
  await expect(page.getByText(editedNoteTitle)).toBeVisible();

  // Verify the original note title is no longer visible
  await expect(page.getByText(originalNoteTitle)).not.toBeVisible();
});

test('user can delete an existing note', async ({ page, baseURL }) => {
  await loginAndNavigateToNotes(page, baseURL);

  // Create an initial note
  const noteTitle = createUniqueEntity('Test note to delete');
  const noteContent = 'Content to delete';
  await createNote(page, noteTitle, noteContent);

  // Find the specific note card by title text
  const noteCard = page.locator('a').filter({ hasText: noteTitle });
  await expect(noteCard).toBeVisible();

  // Hover over the note card and wait for dropdown button to be visible
  const dropdownButton = noteCard.locator('..').locator('button[data-testid^="note-dropdown-"]');
  await hoverAndWaitForVisible(noteCard, dropdownButton);

  // Click dropdown button
  await dropdownButton.click();

  // Wait for dropdown menu to appear and click Delete
  const deleteButton = page.locator('button[data-testid^="note-delete-"]').first();
  await waitForElement(deleteButton);
  await deleteButton.click();

  // Wait for and handle the confirmation dialog
  await confirmDialog(page, 'Delete Note');

  // Verify the note is no longer visible in the notes list
  await expect(page.getByRole('link', { name: new RegExp(noteTitle) })).not.toBeVisible();
});

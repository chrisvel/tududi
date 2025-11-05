import { test, expect } from '@playwright/test';
import {
  login,
  navigateAndWait,
  clickAndWaitForModal,
  waitForElement,
  createUniqueEntity,
  waitForNetworkIdle
} from '../helpers/testHelpers';

// Navigate to notes page after login
async function loginAndNavigateToNotes(page, baseURL) {
  const appUrl = await login(page, baseURL);
  await navigateAndWait(page, appUrl + '/notes');
  await expect(page).toHaveURL(/\/notes/);
  return appUrl;
}

// Create a note with checkbox content
async function createNoteWithCheckboxes(page, noteTitle) {
  const addNoteButton = page.locator('[data-testid="add-note-button"]');
  const titleInput = page.locator('[data-testid="note-title-input"]');

  await clickAndWaitForModal(addNoteButton, titleInput);

  // Fill in the note title
  await titleInput.click();
  await titleInput.clear();
  await titleInput.type(noteTitle, { delay: 50 });

  // Fill in note content with checkboxes
  const contentTextarea = page.locator('[data-testid="note-content-textarea"]');
  await contentTextarea.click();
  await contentTextarea.fill('# Shopping List\n\n- [ ] Buy milk\n- [ ] Buy eggs\n- [ ] Buy bread');

  // Save the note
  await page.locator('[data-testid="note-save-button"]').click();

  // Wait for the modal to close
  await waitForElement(titleInput, { state: 'hidden' });
  await waitForNetworkIdle(page);
}

test('user can toggle checkboxes in note detail view and changes are saved', async ({ page, baseURL }) => {
  await loginAndNavigateToNotes(page, baseURL);

  // Create a note with checkboxes
  const noteTitle = createUniqueEntity('Shopping List');
  await createNoteWithCheckboxes(page, noteTitle);

  // Click on the note to view it
  const noteLink = page.locator('a').filter({ hasText: noteTitle });
  await expect(noteLink).toBeVisible();
  await noteLink.click();

  // Wait for note detail page to load
  await expect(page).toHaveURL(/\/note\//);

  // Wait for checkboxes to be visible
  const checkboxes = page.locator('input[type="checkbox"]');
  await expect(checkboxes.first()).toBeVisible();

  // Verify we have 3 checkboxes
  await expect(checkboxes).toHaveCount(3);

  // Verify all checkboxes are initially unchecked
  for (let i = 0; i < 3; i++) {
    await expect(checkboxes.nth(i)).not.toBeChecked();
  }

  // Click the first checkbox (Buy milk)
  await checkboxes.first().click();

  // Wait for the save to complete
  await page.waitForTimeout(500);

  // Verify the checkbox is now checked
  await expect(checkboxes.first()).toBeChecked();

  // Refresh the page to verify the change was saved
  await page.reload();
  await expect(checkboxes.first()).toBeVisible();

  // Verify the first checkbox is still checked after reload
  await expect(checkboxes.first()).toBeChecked();

  // Verify other checkboxes are still unchecked
  await expect(checkboxes.nth(1)).not.toBeChecked();
  await expect(checkboxes.nth(2)).not.toBeChecked();

  // Toggle the first checkbox back to unchecked
  await checkboxes.first().click();
  await page.waitForTimeout(500);

  // Verify it's now unchecked
  await expect(checkboxes.first()).not.toBeChecked();
});

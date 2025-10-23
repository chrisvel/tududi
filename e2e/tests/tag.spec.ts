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

// Navigate to tags page after login
async function loginAndNavigateToTags(page, baseURL) {
  const appUrl = await login(page, baseURL);

  // Navigate to tags page
  await navigateAndWait(page, appUrl + '/tags');
  await expect(page).toHaveURL(/\/tags/);

  return appUrl;
}

// Shared function to create a tag via the sidebar button
async function createTag(page, tagName) {
  // Find and click the "Add Tag" button in the sidebar
  const addTagButton = page.locator('[data-testid="add-tag-button"]');
  const nameInput = page.locator('[data-testid="tag-name-input"]');

  await clickAndWaitForModal(addTagButton, nameInput);

  // Fill in the tag name
  await fillInputReliably(nameInput, tagName);

  // Save the tag
  await page.locator('[data-testid="tag-save-button"]').click();

  // Wait for the modal to close
  await waitForElement(nameInput, { state: 'hidden' });

  // Wait for tag creation to complete
  await waitForNetworkIdle(page);
}

test('user can create a new tag and verify it appears in the tags list', async ({ page, baseURL }) => {
  await loginAndNavigateToTags(page, baseURL);

  // Create a unique test tag
  const tagName = createUniqueEntity('TestTag');
  await createTag(page, tagName);

  // Verify the tag appears in the tags list
  await expect(page.getByText(tagName)).toBeVisible();
});

test('user can update an existing tag', async ({ page, baseURL }) => {
  await loginAndNavigateToTags(page, baseURL);

  // Create an initial tag
  const originalTagName = createUniqueEntity('TestTagEdit');
  await createTag(page, originalTagName);

  // Find the tag container and hover to show edit button
  const tagContainer = page.getByText(originalTagName).locator('../..');
  const editButton = tagContainer.locator('[data-testid*="tag-edit"]');

  await hoverAndWaitForVisible(tagContainer, editButton);

  // Click the edit button
  await editButton.click();

  // Wait for the Tag Modal to appear with the tag data
  const tagNameInput = page.locator('[data-testid="tag-name-input"]');
  await waitForElement(tagNameInput);

  // Verify the tag name field is pre-filled
  await expect(tagNameInput).toHaveValue(originalTagName);

  // Edit the tag name
  const editedTagName = createUniqueEntity('EditedTestTag');
  await fillInputReliably(tagNameInput, editedTagName);

  // Save the changes
  await page.locator('[data-testid="tag-save-button"]').click();

  // Wait for the modal to close
  await waitForElement(tagNameInput, { state: 'hidden' });

  // Verify the edited tag appears in the tags list
  await expect(page.getByText(editedTagName)).toBeVisible();

  // Verify the original tag name is no longer visible
  await expect(page.getByText(originalTagName)).not.toBeVisible();
});

test('user can delete an existing tag', async ({ page, baseURL }) => {
  await loginAndNavigateToTags(page, baseURL);

  // Create an initial tag
  const tagName = createUniqueEntity('TestTagDelete');
  await createTag(page, tagName);

  // Find the tag container and hover to show delete button
  const tagContainer = page.getByText(tagName).locator('../..');
  const deleteButton = tagContainer.locator('[data-testid*="tag-delete"]');

  await hoverAndWaitForVisible(tagContainer, deleteButton);

  // Click the delete button
  await deleteButton.click();

  // Wait for and handle the confirmation dialog
  await confirmDialog(page, 'Delete Tag');

  // Verify the tag is no longer visible in the tags list
  await expect(page.getByRole('link', { name: tagName })).not.toBeVisible();
});

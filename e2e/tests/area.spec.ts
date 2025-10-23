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

// Navigate to areas page after login
async function loginAndNavigateToAreas(page, baseURL) {
  const appUrl = await login(page, baseURL);

  // Navigate to areas page
  await navigateAndWait(page, appUrl + '/areas');
  await expect(page).toHaveURL(/\/areas/);

  return appUrl;
}

// Shared function to create an area via the sidebar button
async function createArea(page, areaName, areaDescription = '') {
  // Find and click the "Add Area" button in the sidebar
  const addAreaButton = page.locator('[data-testid="add-area-button"]');
  const nameInput = page.locator('input[name="name"]');

  await clickAndWaitForModal(addAreaButton, nameInput);

  // Fill in the area name
  await fillInputReliably(nameInput, areaName);

  // Fill in the area description if provided
  if (areaDescription) {
    await page.locator('textarea[name="description"]').fill(areaDescription);
  }

  // Save the area and wait for modal to close
  await page.getByRole('button', { name: /create.*area|save/i }).click();
  await waitForElement(nameInput, { state: 'hidden' });

  // Wait for area creation to complete
  await waitForNetworkIdle(page);
}

test('user can create a new area and verify it appears in the areas list', async ({ page, baseURL }) => {
  await loginAndNavigateToAreas(page, baseURL);

  // Create a unique test area
  const areaName = createUniqueEntity('Test Area');
  const areaDescription = `This is test description for area`;
  await createArea(page, areaName, areaDescription);

  // Verify the area appears in the areas list
  await expect(page.getByText(areaName)).toBeVisible();
});

test('user can update an existing area', async ({ page, baseURL }) => {
  await loginAndNavigateToAreas(page, baseURL);

  // Create an initial area
  const originalAreaName = createUniqueEntity('Test area to edit');
  const originalAreaDescription = 'Original description';
  await createArea(page, originalAreaName, originalAreaDescription);

  // Find the specific area card by text
  const areaCard = page.locator('a').filter({ hasText: originalAreaName });
  await expect(areaCard).toBeVisible();

  // Hover over the area card and wait for dropdown button to be visible
  const dropdownButton = areaCard.locator('button[data-testid^="area-dropdown-"]');
  await hoverAndWaitForVisible(areaCard, dropdownButton);

  // Click dropdown button
  await dropdownButton.click();

  // Wait for dropdown menu to appear and click Edit
  const editButton = page.locator('button[data-testid^="area-edit-"]').first();
  await waitForElement(editButton);
  await editButton.click();

  // Wait for the Area Modal to appear with the area data
  const areaNameInput = page.locator('[data-testid="area-name-input"]');
  await waitForElement(areaNameInput);

  // Verify the area name field is pre-filled
  await expect(areaNameInput).toHaveValue(originalAreaName);

  // Edit the area name and description
  const editedAreaName = createUniqueEntity('Edited test area');
  const editedAreaDescription = 'Edited description';
  await fillInputReliably(areaNameInput, editedAreaName);

  const areaDescriptionTextarea = page.locator('textarea[name="description"]').first();
  await areaDescriptionTextarea.clear();
  await areaDescriptionTextarea.fill(editedAreaDescription);

  // Save the changes and wait for modal to close
  await page.locator('[data-testid="area-save-button"]').click();
  await waitForElement(areaNameInput, { state: 'hidden' });

  // Verify the edited area appears in the areas list
  await expect(page.getByText(editedAreaName)).toBeVisible();

  // Verify the original area name is no longer visible
  await expect(page.getByText(originalAreaName)).not.toBeVisible();
});

test('user can delete an existing area', async ({ page, baseURL }) => {
  await loginAndNavigateToAreas(page, baseURL);

  // Create an initial area
  const areaName = createUniqueEntity('Test area to delete');
  const areaDescription = 'Description to delete';
  await createArea(page, areaName, areaDescription);

  // Find the specific area card by text
  const areaCard = page.locator('a').filter({ hasText: areaName });
  await expect(areaCard).toBeVisible();

  // Hover over the area card and wait for dropdown button to be visible
  const dropdownButton = areaCard.locator('button[data-testid^="area-dropdown-"]');
  await hoverAndWaitForVisible(areaCard, dropdownButton);

  // Click dropdown button
  await dropdownButton.click();

  // Wait for dropdown menu to appear and click Delete
  const deleteButton = page.locator('button[data-testid^="area-delete-"]').first();
  await waitForElement(deleteButton);
  await deleteButton.click();

  // Wait for and handle the confirmation dialog
  await confirmDialog(page, 'Delete Area');

  // Verify the area is no longer visible in the areas list
  await expect(page.getByText(areaName)).not.toBeVisible();
});
import { test, expect } from '@playwright/test';

// Shared login function
async function loginAndNavigateToAreas(page, baseURL) {
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

  // Navigate to areas page
  await page.goto(appUrl + '/areas');
  await expect(page).toHaveURL(/\/areas/);

  return appUrl;
}

// Shared function to create an area via the sidebar button
async function createArea(page, areaName, areaDescription = '') {
  // Find the "Add Area" button in the sidebar
  const addAreaButton = page.locator('[data-testid="add-area-button"]');
  await expect(addAreaButton).toBeVisible();
  
  // Click the Add Area button
  await addAreaButton.click();

  // Wait for the Area Modal to appear
  await expect(page.locator('input[name="name"]')).toBeVisible({ timeout: 10000 });

  // Fill in the area name
  await page.locator('input[name="name"]').fill(areaName);

  // Fill in the area description if provided
  if (areaDescription) {
    await page.locator('textarea[name="description"]').fill(areaDescription);
  }

  // Save the area
  await page.getByRole('button', { name: /create.*area|save/i }).click();

  // Wait for the modal to close
  await expect(page.locator('input[name="name"]')).not.toBeVisible({ timeout: 10000 });

  // Wait for area creation to complete
  await page.waitForTimeout(2000);
}

test('user can create a new area and verify it appears in the areas list', async ({ page, baseURL }) => {
  await loginAndNavigateToAreas(page, baseURL);

  // Create a unique test area
  const timestamp = Date.now();
  const areaName = `Test Area ${timestamp}`;
  const areaDescription = `This is test description for area ${timestamp}`;
  await createArea(page, areaName, areaDescription);

  // Verify the area appears in the areas list
  await expect(page.getByText(areaName)).toBeVisible({ timeout: 10000 });
});

test('user can update an existing area', async ({ page, baseURL }) => {
  await loginAndNavigateToAreas(page, baseURL);

  // Create an initial area
  const timestamp = Date.now();
  const originalAreaName = `Test area to edit ${timestamp}`;
  const originalAreaDescription = `Original description ${timestamp}`;
  await createArea(page, originalAreaName, originalAreaDescription);

  // Find the specific area card by text
  const areaCard = page.locator('a').filter({ hasText: originalAreaName });
  await expect(areaCard).toBeVisible();
  
  // Hover over the area card to show the dropdown button
  await areaCard.hover();
  
  // Wait a moment for the opacity transition
  await page.waitForTimeout(1000);

  // Find the dropdown button within this specific area card
  const dropdownButton = areaCard.locator('button[data-testid^="area-dropdown-"]');
  await dropdownButton.click({ force: true });

  // Wait for dropdown menu to appear and click Edit
  const editButton = page.locator('button[data-testid^="area-edit-"]').first();
  await expect(editButton).toBeVisible({ timeout: 10000 });
  await editButton.click();

  // Wait for the Area Modal to appear with the area data
  await expect(page.locator('[data-testid="area-name-input"]')).toBeVisible();

  // Verify the area name field is pre-filled
  const areaNameInput = page.locator('[data-testid="area-name-input"]');
  await expect(areaNameInput).toHaveValue(originalAreaName);

  // Edit the area name and description
  const editedAreaName = `Edited test area ${timestamp}`;
  const editedAreaDescription = `Edited description ${timestamp}`;
  await areaNameInput.clear();
  await areaNameInput.fill(editedAreaName);
  
  const areaDescriptionTextarea = page.locator('textarea[name="description"]').first();
  await areaDescriptionTextarea.clear();
  await areaDescriptionTextarea.fill(editedAreaDescription);

  // Save the changes
  await page.locator('[data-testid="area-save-button"]').click();

  // Wait for the modal to close
  await expect(page.locator('[data-testid="area-name-input"]')).not.toBeVisible();

  // Verify the edited area appears in the areas list
  await expect(page.getByText(editedAreaName)).toBeVisible();

  // Verify the original area name is no longer visible
  await expect(page.getByText(originalAreaName)).not.toBeVisible();
});

test('user can delete an existing area', async ({ page, baseURL }) => {
  await loginAndNavigateToAreas(page, baseURL);

  // Create an initial area
  const timestamp = Date.now();
  const areaName = `Test area to delete ${timestamp}`;
  const areaDescription = `Description to delete ${timestamp}`;
  await createArea(page, areaName, areaDescription);

  // Find the specific area card by text
  const areaCard = page.locator('a').filter({ hasText: areaName });
  await expect(areaCard).toBeVisible();
  
  // Hover over the area card to show the dropdown button
  await areaCard.hover();
  
  // Wait a moment for the opacity transition
  await page.waitForTimeout(1000);

  // Find the dropdown button within this specific area card
  const dropdownButton = areaCard.locator('button[data-testid^="area-dropdown-"]');
  await dropdownButton.click({ force: true });

  // Wait for dropdown menu to appear and click Delete
  const deleteButton = page.locator('button[data-testid^="area-delete-"]').first();
  await expect(deleteButton).toBeVisible({ timeout: 10000 });
  await deleteButton.click();

  // Wait for and handle the confirmation dialog
  await expect(page.locator('text=Delete Area')).toBeVisible();
  // Click the confirm button in the confirmation dialog
  await page.locator('[data-testid="confirm-dialog-confirm"]').click();

  // Verify the area is no longer visible in the areas list
  await expect(page.getByText(areaName)).not.toBeVisible();
});
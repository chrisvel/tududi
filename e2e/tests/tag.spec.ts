import { test, expect } from '@playwright/test';

// Shared login function
async function loginAndNavigateToTags(page, baseURL) {
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

  // Navigate to tags page
  await page.goto(appUrl + '/tags');
  await expect(page).toHaveURL(/\/tags/);

  return appUrl;
}

// Shared function to create a tag via the sidebar button
async function createTag(page, tagName) {
  // Find the "Add Tag" button in the sidebar using test ID
  const addTagButton = page.locator('[data-testid="add-tag-button"]');
  await expect(addTagButton).toBeVisible();
  
  // Click the Add Tag button
  await addTagButton.click();

  // Wait for the Tag Modal to appear
  await expect(page.locator('[data-testid="tag-name-input"]')).toBeVisible({ timeout: 10000 });

  // Fill in the tag name
  await page.locator('[data-testid="tag-name-input"]').fill(tagName);

  // Save the tag
  await page.locator('[data-testid="tag-save-button"]').click();

  // Wait for the modal to close
  await expect(page.locator('[data-testid="tag-name-input"]')).not.toBeVisible({ timeout: 10000 });

  // Wait for tag creation to complete
  await page.waitForTimeout(2000);
}

test('user can create a new tag and verify it appears in the tags list', async ({ page, baseURL }) => {
  await loginAndNavigateToTags(page, baseURL);

  // Create a unique test tag
  const timestamp = Date.now();
  const tagName = `TestTag${timestamp}`;
  await createTag(page, tagName);

  // Verify the tag appears in the tags list
  await expect(page.getByText(tagName)).toBeVisible({ timeout: 10000 });
});

test('user can update an existing tag', async ({ page, baseURL }) => {
  await loginAndNavigateToTags(page, baseURL);

  // Create an initial tag
  const timestamp = Date.now();
  const originalTagName = `TestTagEdit${timestamp}`;
  await createTag(page, originalTagName);

  // Find the tag container and hover to show edit button
  const tagContainer = page.getByText(originalTagName).locator('../..');
  await tagContainer.hover();
  
  // Wait for the edit button to become visible (opacity transition)
  await tagContainer.locator(`[data-testid*="tag-edit"]`).waitFor({ state: 'visible' });
  
  // Click the edit button (pencil icon) using test ID within the tag container
  await tagContainer.locator(`[data-testid*="tag-edit"]`).click();

  // Wait for the Tag Modal to appear with the tag data
  await expect(page.locator('[data-testid="tag-name-input"]')).toBeVisible();

  // Verify the tag name field is pre-filled
  const tagNameInput = page.locator('[data-testid="tag-name-input"]');
  await expect(tagNameInput).toHaveValue(originalTagName);

  // Edit the tag name
  const editedTagName = `EditedTestTag${timestamp}`;
  await tagNameInput.clear();
  await tagNameInput.fill(editedTagName);

  // Save the changes
  await page.locator('[data-testid="tag-save-button"]').click();

  // Wait for the modal to close
  await expect(page.locator('[data-testid="tag-name-input"]')).not.toBeVisible();

  // Verify the edited tag appears in the tags list
  await expect(page.getByText(editedTagName)).toBeVisible();

  // Verify the original tag name is no longer visible
  await expect(page.getByText(originalTagName)).not.toBeVisible();
});

test('user can delete an existing tag', async ({ page, baseURL }) => {
  await loginAndNavigateToTags(page, baseURL);

  // Create an initial tag
  const timestamp = Date.now();
  const tagName = `TestTagDelete${timestamp}`;
  await createTag(page, tagName);

  // Find the tag container and hover to show delete button
  const tagContainer = page.getByText(tagName).locator('../..');
  await tagContainer.hover();
  
  // Wait for the delete button to become visible (opacity transition)
  await tagContainer.locator(`[data-testid*="tag-delete"]`).waitFor({ state: 'visible' });

  // Click the delete button (trash icon) using test ID within the tag container
  await tagContainer.locator(`[data-testid*="tag-delete"]`).click();

  // Wait for and handle the confirmation dialog
  await expect(page.locator('text=Delete Tag')).toBeVisible();
  // Click the confirm button in the confirmation dialog
  await page.locator('[data-testid="confirm-dialog-confirm"]').click();

  // Verify the tag is no longer visible in the tags list (check specifically for the link)
  await expect(page.getByRole('link', { name: tagName })).not.toBeVisible();
});
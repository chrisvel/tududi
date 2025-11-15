import { test, expect } from '@playwright/test';
import { login } from '../helpers/testHelpers';

test.describe('Notes - Basic Functionality', () => {
    test('should create a new note', async ({ page, baseURL }) => {
        // Login
        await login(page, baseURL);

        // Navigate to notes page
        await page.goto('/notes');
        await page.waitForLoadState('networkidle');

        // Verify we're on the notes page
        await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();

        // Create a new note
        const timestamp = Date.now();
        const noteTitle = `Test Note ${timestamp}`;
        const noteContent = `This is test content for note ${timestamp}`;

        // Click add note button in the notes list header
        await page.locator('div').filter({ hasText: /^Notes$/ }).getByLabel('Add Note').click();

        // Verify we're in edit mode
        await expect(page.getByPlaceholder('Note title...')).toBeVisible();

        // Fill in note details
        await page.getByPlaceholder('Note title...').fill(noteTitle);
        await page
            .getByPlaceholder(/Write your note content here/)
            .fill(noteContent);

        // Save by pressing Escape
        await page.keyboard.press('Escape');

        // Verify note was created and is shown in preview
        await expect(page.locator('h1', { hasText: noteTitle })).toBeVisible();

        // Verify content is shown in the markdown preview area
        await expect(
            page.locator('.markdown-content p', { hasText: noteContent })
        ).toBeVisible();

        // Verify note appears in the list
        await expect(
            page.locator('h3', { hasText: noteTitle }).first()
        ).toBeVisible();
    });

    test('should edit an existing note', async ({ page, baseURL }) => {
        // Login
        await login(page, baseURL);

        // Navigate to notes page
        await page.goto('/notes');
        await page.waitForLoadState('networkidle');

        // Create a note first
        const timestamp = Date.now();
        const originalTitle = `Original Note ${timestamp}`;
        const originalContent = `Original content ${timestamp}`;

        await page.locator('div').filter({ hasText: /^Notes$/ }).getByLabel('Add Note').click();
        await page.getByPlaceholder('Note title...').fill(originalTitle);
        await page.getByPlaceholder(/Write your note content here/).fill(originalContent);
        await page.keyboard.press('Escape');

        // Verify note was created
        await expect(page.locator('h3', { hasText: originalTitle }).first()).toBeVisible();

        // Click on the note in the list to select it
        await page.locator('h3', { hasText: originalTitle }).first().click();
        await page.waitForTimeout(300);

        // Verify we're in preview mode
        await expect(page.locator('h1', { hasText: originalTitle })).toBeVisible();

        // Click on the title to enter edit mode
        await page.locator('h1', { hasText: originalTitle }).click();

        // Verify we're in edit mode
        await expect(page.getByPlaceholder('Note title...')).toBeVisible();

        // Edit the note
        const updatedTitle = `Updated Note ${timestamp}`;
        const updatedContent = `Updated content ${timestamp}`;

        await page.getByPlaceholder('Note title...').fill(updatedTitle);
        await page.getByPlaceholder(/Write your note content here/).fill(updatedContent);

        // Save by pressing Escape
        await page.keyboard.press('Escape');

        // Verify updated note is shown in preview
        await expect(page.locator('h1', { hasText: updatedTitle })).toBeVisible();
        await expect(
            page.locator('.markdown-content p', { hasText: updatedContent })
        ).toBeVisible();

        // Verify updated note appears in the list
        await expect(page.locator('h3', { hasText: updatedTitle }).first()).toBeVisible();

        // Verify old title is not shown
        await expect(page.locator('h3', { hasText: originalTitle })).toHaveCount(0);
    });
});

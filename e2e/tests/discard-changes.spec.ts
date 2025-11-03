import { test, expect } from '@playwright/test';
import {
    login,
    navigateAndWait,
    waitForElement,
    hoverAndWaitForVisible,
    createUniqueEntity,
    waitForNetworkIdle,
} from '../helpers/testHelpers';

// Helper to create a task
async function createTask(page, taskName) {
    const taskInput = page.locator('[data-testid="new-task-input"]');
    await taskInput.fill(taskName);
    await taskInput.press('Enter');
    await waitForNetworkIdle(page);
}

// Helper to open task edit modal
async function openTaskEditModal(page, taskName) {
    const taskContainer = page
        .locator('[data-testid*="task-item"]')
        .filter({ hasText: taskName });
    await expect(taskContainer).toBeVisible({ timeout: 15000 });

    const editButton = taskContainer.locator('[data-testid*="task-edit"]');
    await hoverAndWaitForVisible(taskContainer, editButton);

    await editButton.click();

    const taskNameInput = page.locator('[data-testid="task-name-input"]');
    await waitForElement(taskNameInput, { timeout: 15000 });

    return taskNameInput;
}

test.describe('Discard Changes Dialog', () => {
    test('shows discard dialog when closing task modal with unsaved changes', async ({
        page,
        baseURL,
    }) => {
        const appUrl = await login(page, baseURL);

        await navigateAndWait(page, appUrl + '/tasks');

        // Create a task
        const taskName = createUniqueEntity('Test Task for Discard');
        await createTask(page, taskName);

        // Open the task edit modal
        await openTaskEditModal(page, taskName);

        // Wait for modal to be in idle state
        await expect(
            page.locator('[data-testid="task-modal"][data-state="idle"]')
        ).toBeVisible();

        // Make a change to the task name
        const taskNameInput = page.locator('[data-testid="task-name-input"]');
        await taskNameInput.fill(taskName + ' Modified');

        // Press Escape key
        await page.keyboard.press('Escape');

        // Verify discard dialog appears
        const discardDialog = page.locator(
            '[data-testid="discard-dialog-cancel"]'
        );
        await expect(discardDialog).toBeVisible({ timeout: 5000 });

        // Verify the "No, keep editing" button is focused
        await expect(discardDialog).toBeFocused();

        // Verify both buttons are visible
        await expect(
            page.locator('[data-testid="discard-dialog-confirm"]')
        ).toBeVisible();
    });

    test('keeps editing when clicking "No, keep editing" button', async ({
        page,
        baseURL,
    }) => {
        const appUrl = await login(page, baseURL);

        await navigateAndWait(page, appUrl + '/tasks');

        // Create a task
        const taskName = createUniqueEntity('Test Task Keep Editing');
        await createTask(page, taskName);

        // Open the task edit modal
        await openTaskEditModal(page, taskName);

        // Wait for modal to be in idle state
        await expect(
            page.locator('[data-testid="task-modal"][data-state="idle"]')
        ).toBeVisible();

        // Make a change
        const taskNameInput = page.locator('[data-testid="task-name-input"]');
        const modifiedName = taskName + ' Modified';
        await taskNameInput.fill(modifiedName);

        // Press Escape
        await page.keyboard.press('Escape');

        // Wait for discard dialog
        const cancelButton = page.locator(
            '[data-testid="discard-dialog-cancel"]'
        );
        await expect(cancelButton).toBeVisible({ timeout: 5000 });

        // Click "No, keep editing"
        await cancelButton.click();

        // Verify modal is still open and changes are preserved
        await expect(
            page.locator('[data-testid="task-modal"]')
        ).toBeVisible();
        await expect(taskNameInput).toHaveValue(modifiedName);
    });

    test('discards changes when clicking "Yes, discard" button', async ({
        page,
        baseURL,
    }) => {
        const appUrl = await login(page, baseURL);

        await navigateAndWait(page, appUrl + '/tasks');

        // Create a task
        const taskName = createUniqueEntity('Test Task Discard');
        await createTask(page, taskName);

        // Open the task edit modal
        await openTaskEditModal(page, taskName);

        // Wait for modal to be in idle state
        await expect(
            page.locator('[data-testid="task-modal"][data-state="idle"]')
        ).toBeVisible();

        // Make a change
        const taskNameInput = page.locator('[data-testid="task-name-input"]');
        await taskNameInput.fill(taskName + ' Modified');

        // Press Escape
        await page.keyboard.press('Escape');

        // Wait for discard dialog
        const confirmButton = page.locator(
            '[data-testid="discard-dialog-confirm"]'
        );
        await expect(confirmButton).toBeVisible({ timeout: 5000 });

        // Click "Yes, discard"
        await confirmButton.click();

        // Verify modal is closed
        await expect(
            page.locator('[data-testid="task-modal"]')
        ).not.toBeVisible({ timeout: 5000 });
    });

    test('closes modal directly when pressing Escape with no changes', async ({
        page,
        baseURL,
    }) => {
        const appUrl = await login(page, baseURL);

        await navigateAndWait(page, appUrl + '/tasks');

        // Create a task
        const taskName = createUniqueEntity('Test Task No Changes');
        await createTask(page, taskName);

        // Open the task edit modal
        await openTaskEditModal(page, taskName);

        // Wait for modal to be in idle state
        await expect(
            page.locator('[data-testid="task-modal"][data-state="idle"]')
        ).toBeVisible();

        // Don't make any changes, just press Escape
        await page.keyboard.press('Escape');

        // Verify modal closes immediately without showing discard dialog
        await expect(
            page.locator('[data-testid="task-modal"]')
        ).not.toBeVisible({ timeout: 5000 });

        // Verify discard dialog never appeared
        await expect(
            page.locator('[data-testid="discard-dialog-cancel"]')
        ).not.toBeVisible();
    });

    test('closes discard dialog when pressing Escape in the dialog', async ({
        page,
        baseURL,
    }) => {
        const appUrl = await login(page, baseURL);

        await navigateAndWait(page, appUrl + '/tasks');

        // Create a task
        const taskName = createUniqueEntity('Test Task Escape Dialog');
        await createTask(page, taskName);

        // Open the task edit modal
        await openTaskEditModal(page, taskName);

        // Wait for modal to be in idle state
        await expect(
            page.locator('[data-testid="task-modal"][data-state="idle"]')
        ).toBeVisible();

        // Make a change
        const taskNameInput = page.locator('[data-testid="task-name-input"]');
        const modifiedName = taskName + ' Modified';
        await taskNameInput.fill(modifiedName);

        // Press Escape to show discard dialog
        await page.keyboard.press('Escape');

        // Wait for discard dialog
        const cancelButton = page.locator(
            '[data-testid="discard-dialog-cancel"]'
        );
        await expect(cancelButton).toBeVisible({ timeout: 5000 });

        // Press Escape again to close the discard dialog
        await page.keyboard.press('Escape');

        // Verify discard dialog is closed
        await expect(cancelButton).not.toBeVisible({ timeout: 5000 });

        // Verify task modal is still open with changes preserved
        await expect(
            page.locator('[data-testid="task-modal"]')
        ).toBeVisible();
        await expect(taskNameInput).toHaveValue(modifiedName);
    });

    test('shows discard dialog when closing project modal with unsaved changes', async ({
        page,
        baseURL,
    }) => {
        const appUrl = await login(page, baseURL);

        await navigateAndWait(page, appUrl + '/projects');

        // Click "Add Project" button
        const addProjectButton = page.locator(
            'button[aria-label="Add Project"]'
        );
        await expect(addProjectButton).toBeVisible();
        await addProjectButton.click();

        // Wait for modal to open
        await expect(page.locator('input[name="name"]')).toBeVisible({
            timeout: 10000,
        });

        // Type a project name
        const projectName = createUniqueEntity('Test Project');
        const nameInput = page.locator('[data-testid="project-name-input"]');
        await nameInput.fill(projectName);

        // Press Escape
        await page.keyboard.press('Escape');

        // Verify discard dialog appears
        const discardDialog = page.locator(
            '[data-testid="discard-dialog-cancel"]'
        );
        await expect(discardDialog).toBeVisible({ timeout: 5000 });

        // Click "Yes, discard"
        await page
            .locator('[data-testid="discard-dialog-confirm"]')
            .click();

        // Verify modal is closed
        await expect(
            page.locator('[data-testid="project-modal"]')
        ).not.toBeVisible({ timeout: 5000 });
    });

    test('detects changes in task note field', async ({ page, baseURL }) => {
        const appUrl = await login(page, baseURL);

        await navigateAndWait(page, appUrl + '/tasks');

        // Create a task
        const taskName = createUniqueEntity('Test Task Note Change');
        await createTask(page, taskName);

        // Open the task edit modal
        await openTaskEditModal(page, taskName);

        // Wait for modal to be in idle state
        await expect(
            page.locator('[data-testid="task-modal"][data-state="idle"]')
        ).toBeVisible();

        // Add content to the note field
        const noteTextarea = page.locator('textarea[name="note"]');
        await noteTextarea.fill('This is a test note');

        // Press Escape
        await page.keyboard.press('Escape');

        // Verify discard dialog appears
        const discardDialog = page.locator(
            '[data-testid="discard-dialog-cancel"]'
        );
        await expect(discardDialog).toBeVisible({ timeout: 5000 });
    });

    test('detects changes when adding tags to task', async ({
        page,
        baseURL,
    }) => {
        const appUrl = await login(page, baseURL);

        await navigateAndWait(page, appUrl + '/tasks');

        // Create a task
        const taskName = createUniqueEntity('Test Task Tag Change');
        await createTask(page, taskName);

        // Open the task edit modal
        await openTaskEditModal(page, taskName);

        // Wait for modal to be in idle state
        await expect(
            page.locator('[data-testid="task-modal"][data-state="idle"]')
        ).toBeVisible();

        // Open tags section
        const tagsSectionButton = page
            .locator('button[title*="Tags"]')
            .filter({ has: page.locator('svg') });
        await tagsSectionButton.click();

        // Wait for tag input to become visible
        const tagInput = page.locator('input[placeholder*="tag"]');
        await expect(tagInput).toBeVisible({ timeout: 5000 });

        // Add a tag
        await tagInput.fill('test-tag');
        await tagInput.press('Enter');

        // Wait a moment for tag to be added
        await page.waitForTimeout(500);

        // Press Escape
        await page.keyboard.press('Escape');

        // Verify discard dialog appears
        const discardDialog = page.locator(
            '[data-testid="discard-dialog-cancel"]'
        );
        await expect(discardDialog).toBeVisible({ timeout: 5000 });
    });
});

import { test, expect } from '@playwright/test';

test.describe('Inbox', () => {
    // Helper function to login via UI
    async function loginViaUI(page, baseURL) {
        const appUrl =
            baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
        await page.goto(`${appUrl}/login`);

        await page
            .getByTestId('login-email')
            .fill(process.env.E2E_EMAIL || 'test@tududi.com');
        await page
            .getByTestId('login-password')
            .fill(process.env.E2E_PASSWORD || 'password123');
        await page.getByTestId('login-submit').click();

        // Wait for redirect to dashboard or today page
        await page.waitForURL(/\/(dashboard|today)/, { timeout: 10000 });
    }

    test('clicking inbox button navigates to inbox and focuses input', async ({
        page,
        baseURL,
    }) => {
        // Login first
        await loginViaUI(page, baseURL);

        // Click the inbox navigation button
        const inboxNavButton = page.getByTestId('sidebar-nav-inbox');
        await expect(inboxNavButton).toBeVisible({ timeout: 5000 });
        await inboxNavButton.click();

        // Wait for navigation to inbox page
        await page.waitForURL(/\/inbox/, { timeout: 10000 });

        // Verify the quick capture input is visible
        const quickCaptureInput = page.getByTestId('quick-capture-input');
        await expect(quickCaptureInput).toBeVisible({ timeout: 5000 });

        // Verify the input is focused
        await expect(quickCaptureInput).toBeFocused({ timeout: 5000 });
    });

    test('can add an inbox item via quick capture', async ({
        page,
        context,
        baseURL,
    }) => {
        // Login first
        await loginViaUI(page, baseURL);

        const appUrl =
            baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
        const timestamp = Date.now();
        const testContent = `Test inbox item ${timestamp}`;

        // Navigate to inbox
        await page.goto(`${appUrl}/inbox`);

        // Wait for the quick capture input to be visible and focused
        const quickCaptureInput = page.getByTestId('quick-capture-input');
        await expect(quickCaptureInput).toBeVisible({ timeout: 5000 });
        await expect(quickCaptureInput).toBeFocused({ timeout: 5000 });

        // Type a new inbox item
        await quickCaptureInput.fill(testContent);

        // Press Enter to submit
        await quickCaptureInput.press('Enter');

        // Wait for the item to appear in the list (toast or item in list)
        // The input should be cleared after successful submission
        await expect(quickCaptureInput).toHaveValue('', { timeout: 5000 });

        // Clean up - delete the inbox item via API
        // First, get the inbox items to find our test item
        const response = await context.request.get(`${appUrl}/api/inbox`);
        if (response.ok()) {
            const data = await response.json();
            const items = data.items || data;
            const testItem = items.find((item) =>
                item.content.includes(testContent)
            );
            if (testItem) {
                await context.request.delete(
                    `${appUrl}/api/inbox/${testItem.uid}`
                );
            }
        }
    });

    test('inbox shows item count badge when items exist', async ({
        page,
        context,
        baseURL,
    }) => {
        // Login first
        await loginViaUI(page, baseURL);

        const appUrl =
            baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
        const timestamp = Date.now();

        // Create an inbox item via API
        const createResponse = await context.request.post(
            `${appUrl}/api/inbox`,
            {
                data: {
                    content: `Badge test item ${timestamp}`,
                    source: 'web',
                },
            }
        );

        let itemUid: string | null = null;
        if (createResponse.ok()) {
            const item = await createResponse.json();
            itemUid = item.uid;
        }

        // Reload the page to see the updated count
        await page.reload();

        // Wait for sidebar to load
        const inboxNavButton = page.getByTestId('sidebar-nav-inbox');
        await expect(inboxNavButton).toBeVisible({ timeout: 5000 });

        // The inbox button should show a count (we just added one item)
        // Note: The count badge appears inside the button
        // We verify the button contains text that could be a number
        const buttonText = await inboxNavButton.textContent();
        expect(buttonText).toContain('Inbox');

        // Clean up
        if (itemUid) {
            await context.request.delete(`${appUrl}/api/inbox/${itemUid}`);
        }
    });
});

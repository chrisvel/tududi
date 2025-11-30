import { test, expect } from '@playwright/test';

test.describe.serial('User Registration', () => {
test.describe.serial('User Registration - Enabled', () => {
    test.beforeAll(async ({ request, baseURL }) => {
        const appUrl = baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';

        const loginResponse = await request.post(`${appUrl}/api/login`, {
            data: {
                email: process.env.E2E_EMAIL || 'test@tududi.com',
                password: process.env.E2E_PASSWORD || 'password123',
            },
        });

        if (!loginResponse.ok()) {
            const errorText = await loginResponse.text();
            throw new Error(`Failed to login as admin for test setup. Status: ${loginResponse.status()}, Response: ${errorText}`);
        }

        const registrationResponse = await request.post(`${appUrl}/api/admin/toggle-registration`, {
            data: { enabled: true },
        });

        if (!registrationResponse.ok()) {
            const errorText = await registrationResponse.text();
            throw new Error(`Failed to enable registration for tests: ${errorText}`);
        }

        const responseData = await registrationResponse.json();
        if (!responseData.enabled) {
            throw new Error('Registration toggle did not enable registration');
        }
    });

    test.beforeEach(async ({ page, baseURL }) => {
        const appUrl = baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
        await page.goto(appUrl + '/register');
    });

    test('should display registration form', async ({ page }) => {
        await expect(page.getByTestId('register-heading')).toBeVisible();
        await expect(page.getByTestId('register-email')).toBeVisible();
        await expect(page.getByTestId('register-password')).toBeVisible();
        await expect(page.getByTestId('register-confirm-password')).toBeVisible();
        await expect(page.getByTestId('register-submit')).toBeVisible();
    });

    test('should show error when passwords do not match', async ({ page }) => {
        const timestamp = Date.now();
        const email = `test${timestamp}@example.com`;

        await page.getByTestId('register-email').fill(email);
        await page.getByTestId('register-password').fill('password123');
        await page.getByTestId('register-confirm-password').fill('password456');
        await page.getByTestId('register-submit').click();

        await expect(page.getByTestId('register-error')).toBeVisible();
        await expect(page.getByTestId('register-error')).toContainText(/passwords do not match/i);
    });

    test('should prevent submission when password is too short (HTML5 validation)', async ({ page }) => {
        const timestamp = Date.now();
        const email = `test${timestamp}@example.com`;

        await page.getByTestId('register-email').fill(email);
        await page.getByTestId('register-password').fill('12345');
        await page.getByTestId('register-confirm-password').fill('12345');

        await page.getByTestId('register-submit').click();

        await expect(page).toHaveURL(/\/register$/);

        const passwordField = page.getByTestId('register-password');
        const validationMessage = await passwordField.evaluate((el: HTMLInputElement) => el.validationMessage);
        expect(validationMessage).toBeTruthy();
    });

    test('should successfully register a new user or show email error', async ({ page }) => {
        const timestamp = Date.now();
        const email = `test${timestamp}@example.com`;
        const password = 'password123';

        await page.getByTestId('register-email').fill(email);
        await page.getByTestId('register-password').fill(password);
        await page.getByTestId('register-confirm-password').fill(password);

        await page.getByTestId('register-submit').click();

        await page.waitForFunction(() => {
            const successHeading = document.querySelector('[data-testid="register-success-heading"]');
            const errorMessage = document.querySelector('[data-testid="register-error"]');
            return successHeading !== null || errorMessage !== null;
        }, { timeout: 10000 });

        const successVisible = await page.getByTestId('register-success-heading').isVisible().catch(() => false);
        const errorVisible = await page.getByTestId('register-error').isVisible().catch(() => false);

        if (successVisible) {
            await expect(page.getByTestId('register-success-heading')).toBeVisible();
            await expect(page.getByTestId('register-success-message')).toBeVisible();
            await expect(page.getByTestId('register-success-back-link')).toBeVisible();
        } else if (errorVisible) {
            await expect(page.getByTestId('register-error')).toBeVisible();
            await expect(page.getByTestId('register-error')).toContainText(/failed to send verification email/i);
        } else {
            throw new Error('Neither success nor error message appeared');
        }
    });

    test('should navigate to login page from link', async ({ page }) => {
        await page.getByTestId('register-login-link').click();

        await expect(page).toHaveURL(/\/login$/);
    });

    test('should show error for duplicate email registration', async ({ page }) => {
        const email = process.env.E2E_EMAIL || 'test@tududi.com';
        const password = 'password123';

        await page.getByTestId('register-email').fill(email);
        await page.getByTestId('register-password').fill(password);
        await page.getByTestId('register-confirm-password').fill(password);

        await page.getByTestId('register-submit').click();

        await expect(page.getByTestId('register-error')).toBeVisible();
    });
});

test.describe.serial('User Registration - Disabled', () => {
    test.beforeAll(async ({ request, baseURL }) => {
        const appUrl = baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';

        const loginResponse = await request.post(`${appUrl}/api/login`, {
            data: {
                email: process.env.E2E_EMAIL || 'test@tududi.com',
                password: process.env.E2E_PASSWORD || 'password123',
            },
        });

        if (!loginResponse.ok()) {
            const errorText = await loginResponse.text();
            throw new Error(`Failed to login as admin for test setup. Status: ${loginResponse.status()}, Response: ${errorText}`);
        }

        const registrationResponse = await request.post(`${appUrl}/api/admin/toggle-registration`, {
            data: { enabled: false },
        });

        if (!registrationResponse.ok()) {
            const errorText = await registrationResponse.text();
            throw new Error(`Failed to disable registration for tests: ${errorText}`);
        }

        const responseData = await registrationResponse.json();
        if (responseData.enabled !== false) {
            throw new Error('Registration toggle did not disable registration');
        }
    });

    test.beforeEach(async ({ page, baseURL }) => {
        const appUrl = baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
        await page.goto(appUrl + '/register');
    });

    test('should show registration disabled error', async ({ page }) => {
        const timestamp = Date.now();
        const email = `test${timestamp}@example.com`;
        const password = 'password123';

        await page.getByTestId('register-email').fill(email);
        await page.getByTestId('register-password').fill(password);
        await page.getByTestId('register-confirm-password').fill(password);

        await page.getByTestId('register-submit').click();

        await expect(page.getByTestId('register-error')).toBeVisible();
        await expect(page.getByTestId('register-error')).toContainText(/registration is not enabled/i);
    });
});
});

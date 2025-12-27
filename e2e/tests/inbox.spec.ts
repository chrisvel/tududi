import { test, expect } from '@playwright/test';

test.describe('Inbox', () => {
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

        await page.waitForURL(/\/(dashboard|today)/, { timeout: 10000 });
    }

    async function cleanupInboxItems(context, appUrl, contentPattern: string) {
        const response = await context.request.get(`${appUrl}/api/inbox`);
        if (response.ok()) {
            const data = await response.json();
            const items = data.items || data;
            for (const item of items) {
                if (item.content.includes(contentPattern)) {
                    await context.request.delete(
                        `${appUrl}/api/inbox/${item.uid}`
                    );
                }
            }
        }
    }

    async function cleanupTags(context, appUrl, tagNames: string[]) {
        const response = await context.request.get(`${appUrl}/api/tags`);
        if (response.ok()) {
            const tags = await response.json();
            for (const tagName of tagNames) {
                const tag = tags.find(
                    (t) => t.name.toLowerCase() === tagName.toLowerCase()
                );
                if (tag) {
                    await context.request.delete(`${appUrl}/api/tags/${tag.id}`);
                }
            }
        }
    }

    async function cleanupProjects(context, appUrl, projectNames: string[]) {
        const response = await context.request.get(`${appUrl}/api/projects`);
        if (response.ok()) {
            const data = await response.json();
            const projects = data.projects || data;
            for (const projectName of projectNames) {
                const project = projects.find(
                    (p) => p.name.toLowerCase() === projectName.toLowerCase()
                );
                if (project) {
                    await context.request.delete(
                        `${appUrl}/api/projects/${project.id}`
                    );
                }
            }
        }
    }

    test.describe('Navigation', () => {
        test('clicking inbox button navigates to inbox and focuses input', async ({
            page,
            baseURL,
        }) => {
            await loginViaUI(page, baseURL);

            const inboxNavButton = page.getByTestId('sidebar-nav-inbox');
            await expect(inboxNavButton).toBeVisible({ timeout: 5000 });
            await inboxNavButton.click();

            await page.waitForURL(/\/inbox/, { timeout: 10000 });

            const quickCaptureInput = page.getByTestId('quick-capture-input');
            await expect(quickCaptureInput).toBeVisible({ timeout: 5000 });
            await expect(quickCaptureInput).toBeFocused({ timeout: 5000 });
        });
    });

    test.describe('Plain Text Input', () => {
        test('can add inbox item with plain text', async ({
            page,
            context,
            baseURL,
        }) => {
            await loginViaUI(page, baseURL);

            const appUrl =
                baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
            const timestamp = Date.now();
            const testContent = `Plain text item ${timestamp}`;

            await page.goto(`${appUrl}/inbox`);

            const quickCaptureInput = page.getByTestId('quick-capture-input');
            await expect(quickCaptureInput).toBeVisible({ timeout: 5000 });

            await quickCaptureInput.fill(testContent);
            await quickCaptureInput.press('Enter');

            await expect(quickCaptureInput).toHaveValue('', { timeout: 5000 });

            await cleanupInboxItems(context, appUrl, testContent);
        });

        test('can add inbox item with long text', async ({
            page,
            context,
            baseURL,
        }) => {
            await loginViaUI(page, baseURL);

            const appUrl =
                baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
            const timestamp = Date.now();
            const longText = `This is a very long inbox entry ${timestamp} that exceeds typical lengths. `.repeat(
                10
            );

            await page.goto(`${appUrl}/inbox`);

            const quickCaptureInput = page.getByTestId('quick-capture-input');
            await expect(quickCaptureInput).toBeVisible({ timeout: 5000 });

            await quickCaptureInput.fill(longText);
            await quickCaptureInput.press('Enter');

            await expect(quickCaptureInput).toHaveValue('', { timeout: 5000 });

            await cleanupInboxItems(context, appUrl, String(timestamp));
        });
    });

    test.describe('Tags', () => {
        test('shows new tag chip when typing non-existing tag', async ({
            page,
            baseURL,
        }) => {
            await loginViaUI(page, baseURL);

            const appUrl =
                baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
            const timestamp = Date.now();
            const newTagName = `newtag${timestamp}`;

            await page.goto(`${appUrl}/inbox`);

            const quickCaptureInput = page.getByTestId('quick-capture-input');
            await expect(quickCaptureInput).toBeVisible({ timeout: 5000 });

            await quickCaptureInput.fill(`Test item #${newTagName}`);

            const tagChip = page.getByTestId(`selected-tag-${newTagName}`);
            await expect(tagChip).toBeVisible({ timeout: 5000 });

            await expect(tagChip).toHaveAttribute('data-tag-exists', 'false');
        });

        test('creates new tag when submitting with non-existing tag', async ({
            page,
            context,
            baseURL,
        }) => {
            await loginViaUI(page, baseURL);

            const appUrl =
                baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
            const timestamp = Date.now();
            const newTagName = `newtag${timestamp}`;

            await page.goto(`${appUrl}/inbox`);

            const quickCaptureInput = page.getByTestId('quick-capture-input');
            await quickCaptureInput.fill(`Test item #${newTagName}`);
            await quickCaptureInput.press('Enter');

            await expect(quickCaptureInput).toHaveValue('', { timeout: 5000 });

            const tagsResponse = await context.request.get(
                `${appUrl}/api/tags`
            );
            const tags = await tagsResponse.json();
            const createdTag = tags.find((t) => t.name === newTagName);
            expect(createdTag).toBeTruthy();

            await cleanupInboxItems(context, appUrl, String(timestamp));
            await cleanupTags(context, appUrl, [newTagName]);
        });

    });

    test.describe('Projects', () => {
        test('shows new project chip when typing non-existing project', async ({
            page,
            baseURL,
        }) => {
            await loginViaUI(page, baseURL);

            const appUrl =
                baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
            const timestamp = Date.now();
            const newProjectName = `NewProject${timestamp}`;

            await page.goto(`${appUrl}/inbox`);

            const quickCaptureInput = page.getByTestId('quick-capture-input');
            await expect(quickCaptureInput).toBeVisible({ timeout: 5000 });

            await quickCaptureInput.fill(`Test item +${newProjectName}`);

            const projectChip = page.getByTestId(
                `selected-project-${newProjectName}`
            );
            await expect(projectChip).toBeVisible({ timeout: 5000 });

            await expect(projectChip).toHaveAttribute(
                'data-project-exists',
                'false'
            );
        });

        test('creates new project when submitting with non-existing project', async ({
            page,
            context,
            baseURL,
        }) => {
            await loginViaUI(page, baseURL);

            const appUrl =
                baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
            const timestamp = Date.now();
            const newProjectName = `NewProject${timestamp}`;

            await page.goto(`${appUrl}/inbox`);

            const quickCaptureInput = page.getByTestId('quick-capture-input');
            await quickCaptureInput.fill(`Test item +${newProjectName}`);
            await quickCaptureInput.press('Enter');

            await expect(quickCaptureInput).toHaveValue('', { timeout: 5000 });

            const projectsResponse = await context.request.get(
                `${appUrl}/api/projects`
            );
            const data = await projectsResponse.json();
            const projects = data.projects || data;
            const createdProject = projects.find(
                (p) => p.name === newProjectName
            );
            expect(createdProject).toBeTruthy();

            await cleanupInboxItems(context, appUrl, String(timestamp));
            await cleanupProjects(context, appUrl, [newProjectName]);
        });
    });

    test.describe('Combinations', () => {
        test('multiple tags and project combination saves successfully', async ({
            page,
            context,
            baseURL,
        }) => {
            await loginViaUI(page, baseURL);

            const appUrl =
                baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
            const timestamp = Date.now();
            const tag1 = `tag1_${timestamp}`;
            const tag2 = `tag2_${timestamp}`;
            const projectName = `ComboProject${timestamp}`;

            await page.goto(`${appUrl}/inbox`);

            const quickCaptureInput = page.getByTestId('quick-capture-input');
            await expect(quickCaptureInput).toBeVisible({ timeout: 5000 });

            await quickCaptureInput.fill(
                `Multi combo test #${tag1} #${tag2} +${projectName}`
            );

            await expect(
                page.getByTestId(`selected-tag-${tag1}`)
            ).toBeVisible();
            await expect(
                page.getByTestId(`selected-tag-${tag2}`)
            ).toBeVisible();
            await expect(
                page.getByTestId(`selected-project-${projectName}`)
            ).toBeVisible();

            await quickCaptureInput.press('Enter');
            await expect(quickCaptureInput).toHaveValue('', { timeout: 5000 });

            await cleanupInboxItems(context, appUrl, String(timestamp));
            await cleanupTags(context, appUrl, [tag1, tag2]);
            await cleanupProjects(context, appUrl, [projectName]);
        });
    });

    test.describe('URL/Bookmark', () => {
        test('URL input automatically adds bookmark tag', async ({
            page,
            baseURL,
        }) => {
            await loginViaUI(page, baseURL);

            const appUrl =
                baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';

            await page.goto(`${appUrl}/inbox`);

            const quickCaptureInput = page.getByTestId('quick-capture-input');
            await expect(quickCaptureInput).toBeVisible({ timeout: 5000 });

            await quickCaptureInput.fill('https://example.com/test-page');

            const bookmarkChip = page.getByTestId('selected-tag-bookmark');
            await expect(bookmarkChip).toBeVisible({ timeout: 10000 });
        });

        test('URL with existing tags shows both bookmark and custom tags', async ({
            page,
            baseURL,
        }) => {
            await loginViaUI(page, baseURL);

            const appUrl =
                baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
            const timestamp = Date.now();
            const customTag = `customtag${timestamp}`;

            await page.goto(`${appUrl}/inbox`);

            const quickCaptureInput = page.getByTestId('quick-capture-input');
            await expect(quickCaptureInput).toBeVisible({ timeout: 5000 });

            await quickCaptureInput.fill(
                `https://example.com/page #${customTag}`
            );

            await expect(
                page.getByTestId(`selected-tag-${customTag}`)
            ).toBeVisible({ timeout: 5000 });
            await expect(
                page.getByTestId('selected-tag-bookmark')
            ).toBeVisible({ timeout: 10000 });
        });

        test('URL bookmark saves successfully', async ({
            page,
            context,
            baseURL,
        }) => {
            await loginViaUI(page, baseURL);

            const appUrl =
                baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
            const timestamp = Date.now();
            const testUrl = `https://example.com/test-${timestamp}`;

            await page.goto(`${appUrl}/inbox`);

            const quickCaptureInput = page.getByTestId('quick-capture-input');
            await expect(quickCaptureInput).toBeVisible({ timeout: 5000 });

            await quickCaptureInput.fill(testUrl);

            await expect(
                page.getByTestId('selected-tag-bookmark')
            ).toBeVisible({ timeout: 10000 });

            await quickCaptureInput.press('Enter');
            await expect(quickCaptureInput).toHaveValue('', { timeout: 5000 });

            await cleanupInboxItems(context, appUrl, String(timestamp));
        });
    });

    test.describe('Containers', () => {
        test('tags container appears when tags are present', async ({
            page,
            baseURL,
        }) => {
            await loginViaUI(page, baseURL);

            const appUrl =
                baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';

            await page.goto(`${appUrl}/inbox`);

            const quickCaptureInput = page.getByTestId('quick-capture-input');
            await expect(quickCaptureInput).toBeVisible({ timeout: 5000 });

            await expect(
                page.getByTestId('selected-tags-container')
            ).not.toBeVisible();

            await quickCaptureInput.fill('Test #mytag');

            await expect(
                page.getByTestId('selected-tags-container')
            ).toBeVisible({ timeout: 5000 });
        });

        test('projects container appears when projects are present', async ({
            page,
            baseURL,
        }) => {
            await loginViaUI(page, baseURL);

            const appUrl =
                baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';

            await page.goto(`${appUrl}/inbox`);

            const quickCaptureInput = page.getByTestId('quick-capture-input');
            await expect(quickCaptureInput).toBeVisible({ timeout: 5000 });

            await expect(
                page.getByTestId('selected-projects-container')
            ).not.toBeVisible();

            await quickCaptureInput.fill('Test +MyProject');

            await expect(
                page.getByTestId('selected-projects-container')
            ).toBeVisible({ timeout: 5000 });
        });
    });
});

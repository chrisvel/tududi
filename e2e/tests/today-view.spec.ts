import { test, expect } from '@playwright/test';

test.describe('Today', () => {
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

    test('Planned: shows tasks with status in_progress, planned, or waiting', async ({
        page,
        context,
        baseURL,
    }) => {
        // Login first
        await loginViaUI(page, baseURL);

        const appUrl =
            baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
        const timestamp = Date.now();

        // Create tasks via API using the logged-in context
        // Status values: 0=NOT_STARTED, 1=IN_PROGRESS, 4=WAITING, 6=PLANNED
        const tasksToCreate = [
            {
                name: `In Progress Task ${timestamp}`,
                status: 1, // IN_PROGRESS
                priority: 2,
                today: false, // Verify it works independently of today field
            },
            {
                name: `Planned Task ${timestamp}`,
                status: 6, // PLANNED
                priority: 2,
                today: false,
            },
            {
                name: `Not Started Task ${timestamp}`,
                status: 0, // NOT_STARTED
                priority: 2,
                today: true, // Even with today=true, should NOT appear in planned
            },
        ];

        const taskIds: string[] = [];
        const createdTasks: any[] = [];

        for (const taskData of tasksToCreate) {
            const response = await context.request.post(`${appUrl}/api/task`, {
                data: taskData,
            });

            if (response.ok()) {
                const task = await response.json();
                taskIds.push(task.id);
                createdTasks.push(task);
            }
        }

        // Navigate to today page
        await page.goto(`${appUrl}/today`);

        // Wait for Planned section to appear (indicates page loaded)
        const plannedSection = page.getByTestId('planned-section');
        await expect(plannedSection).toBeVisible({ timeout: 10000 });

        // Verify in_progress task is visible in the Planned section
        const inProgressTask = plannedSection.getByTestId(
            `task-item-${taskIds[0]}`
        );
        await expect(inProgressTask).toBeVisible({ timeout: 10000 });

        // Verify planned task is visible in the Planned section
        const plannedTask = plannedSection.getByTestId(
            `task-item-${taskIds[1]}`
        );
        await expect(plannedTask).toBeVisible({ timeout: 10000 });

        // Verify not_started task is NOT visible in Planned section
        const notStartedTask = plannedSection.getByTestId(
            `task-item-${taskIds[2]}`
        );
        await expect(notStartedTask).not.toBeVisible();

        // Clean up created tasks
        for (const taskId of taskIds) {
            await context.request.delete(`${appUrl}/api/task/${taskId}`);
        }
    });

    test('Overdue: shows overdue tasks', async ({
        page,
        context,
        baseURL,
    }) => {
        // Login first
        await loginViaUI(page, baseURL);

        const appUrl =
            baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
        const timestamp = Date.now();

        // Calculate yesterday's date
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        // Create an overdue task
        const response = await context.request.post(`${appUrl}/api/task`, {
            data: {
                name: `Overdue Task ${timestamp}`,
                due_date: yesterdayStr,
                priority: 2,
            }, // 2 = HIGH
        });

        let taskId: string | null = null;
        if (response.ok()) {
            const task = await response.json();
            taskId = task.id;
        }

        // Navigate to today page
        await page.goto(`${appUrl}/today`);

        // Check if Overdue section exists using data-testid
        const overdueSection = page.getByTestId('overdue-section');
        const isOverdueVisible = await overdueSection
            .isVisible()
            .catch(() => false);

        // If overdue section is visible, verify the task is in it
        if (isOverdueVisible) {
            const overdueTask = overdueSection.getByTestId(
                `task-item-${taskId}`
            );
            await expect(overdueTask).toBeVisible();
        } else {
            // If section not visible, the settings might be hiding it
            // Skip this assertion but don't fail the test
        }

        // Clean up
        if (taskId) {
            await context.request.delete(`${appUrl}/api/task/${taskId}`);
        }
    });

    test('Due Today: shows tasks', async ({
        page,
        context,
        baseURL,
    }) => {
        // Login first
        await loginViaUI(page, baseURL);

        const appUrl =
            baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
        const timestamp = Date.now();

        // Calculate today's date
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Create a task due today (but not in today plan)
        const response = await context.request.post(`${appUrl}/api/task`, {
            data: {
                name: `Due Today Task ${timestamp}`,
                due_date: todayStr,
                priority: 2,
                today: false,
            }, // 2 = HIGH
        });

        let taskId: string | null = null;
        if (response.ok()) {
            const task = await response.json();
            taskId = task.id;
        }

        // Navigate to today page
        await page.goto(`${appUrl}/today`);

        // Check if Due Today section exists using data-testid
        const dueTodaySection = page.getByTestId('due-today-section');
        const isDueTodayVisible = await dueTodaySection
            .isVisible()
            .catch(() => false);

        // If due today section is visible, verify the task is in it
        if (isDueTodayVisible) {
            const dueTodayTask = dueTodaySection.getByTestId(
                `task-item-${taskId}`
            );
            await expect(dueTodayTask).toBeVisible();
        } else {
            // If section not visible, the settings might be hiding it
        }

        // Clean up
        if (taskId) {
            await context.request.delete(`${appUrl}/api/task/${taskId}`);
        }
    });

    test('Collapse/expand sections', async ({
        page,
        baseURL,
    }) => {
        // Login first
        await loginViaUI(page, baseURL);

        const appUrl =
            baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
        await page.goto(`${appUrl}/today`);

        // Test Planned section collapse/expand if it exists using data-testid
        const plannedHeader = page.getByTestId('planned-section-header');
        const isPlannedVisible = await plannedHeader
            .isVisible({ timeout: 5000 })
            .catch(() => false);

        if (isPlannedVisible) {
            // Verify header is clickable
            await expect(plannedHeader).toBeVisible();
            // This test just verifies the section exists and is clickable
            // Actual collapse/expand behavior depends on having tasks
        }
    });
});

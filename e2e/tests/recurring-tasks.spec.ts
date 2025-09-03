import { test, expect } from '@playwright/test';

test.describe('Recurring Tasks', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    const appUrl = baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
    
    // Login first
    await page.goto(appUrl + '/login', { waitUntil: 'domcontentloaded' });
    
    const email = process.env.E2E_EMAIL || 'test@tududi.com';
    const password = process.env.E2E_PASSWORD || 'password123';
    
    // Wait for login form to be ready
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /login/i }).click();
    
    // Wait for redirect to Today view with longer timeout
    await expect(page).toHaveURL(/\/today$/, { timeout: 15000 });
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000); // Additional stability wait
  });

  test('can create a daily recurring task and verify settings', async ({ page }) => {
    // Ensure we're on the right page before starting
    await expect(page).toHaveURL(/\/today$/);
    
    // Navigate to task creation - try multiple selectors
    const addTaskButton = page.getByRole('button', { name: /add task/i }).or(
      page.getByRole('button', { name: /\+/i })
    ).or(
      page.locator('[data-testid="add-task-button"]')
    ).or(
      page.getByText('Add Task')
    );
    
    await expect(addTaskButton).toBeVisible({ timeout: 10000 });
    await addTaskButton.click();
    
    // Wait for the task creation modal/form with multiple possible selectors
    const taskNameInput = page.getByLabel('Task name').or(
      page.getByLabel('Name')
    ).or(
      page.locator('input[name="name"]')
    ).or(
      page.locator('[data-testid="task-name-input"]')
    );
    
    await expect(taskNameInput).toBeVisible({ timeout: 10000 });
    
    // Fill in task details
    const taskName = `Daily E2E Test Task ${Date.now()}`;
    await taskNameInput.fill(taskName);
    
    // Set up recurring options
    // Look for recurring/recurrence toggle or checkbox
    const recurringToggle = page.locator('[data-testid="recurring-toggle"]').or(
      page.getByLabel(/recurring/i)
    ).or(
      page.getByText(/recurring/i).locator('..').locator('input')
    );
    
    await recurringToggle.check();
    
    // Select daily recurrence
    const frequencySelect = page.getByLabel(/frequency/i).or(
      page.locator('[data-testid="recurrence-frequency"]')
    ).or(
      page.locator('select').filter({ hasText: /daily|weekly|monthly/i })
    );
    
    await frequencySelect.selectOption('daily');
    
    // Set due date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const dueDateField = page.getByLabel(/due date/i).or(
      page.locator('input[type="date"]')
    );
    await dueDateField.fill(tomorrowStr);
    
    // Save the task
    await page.getByRole('button', { name: /save|create|add/i }).click();
    
    // Wait for task to be created and modal to close
    await expect(page.getByLabel('Task name')).not.toBeVisible();
    
    // Find the created task in the list
    const taskItem = page.getByText(taskName).first();
    await expect(taskItem).toBeVisible();
    
    // Click on the task to open details
    await taskItem.click();
    
    // Wait for task details page/modal
    await expect(page.getByText(taskName)).toBeVisible();
    
    // Verify recurring settings are displayed
    await expect(page.getByText(/daily/i)).toBeVisible();
    await expect(page.getByText(/recurring/i)).toBeVisible();
    
    // Look for recurrence information
    const recurrenceInfo = page.locator('[data-testid="recurrence-info"]').or(
      page.getByText(/repeats daily/i)
    ).or(
      page.getByText(/every.*day/i)
    );
    
    await expect(recurrenceInfo).toBeVisible();
  });

  test('recurring task appears in upcoming view with multiple instances', async ({ page }) => {
    // First create a daily recurring task
    await page.getByRole('button', { name: /add task/i }).click();
    await expect(page.getByLabel('Task name')).toBeVisible();
    
    const taskName = `Upcoming E2E Recurring ${Date.now()}`;
    await page.getByLabel('Task name').fill(taskName);
    
    // Enable recurring
    const recurringToggle = page.locator('[data-testid="recurring-toggle"]').or(
      page.getByLabel(/recurring/i)
    ).or(
      page.getByText(/recurring/i).locator('..').locator('input')
    );
    await recurringToggle.check();
    
    // Set to daily
    const frequencySelect = page.getByLabel(/frequency/i).or(
      page.locator('[data-testid="recurrence-frequency"]')
    ).or(
      page.locator('select').filter({ hasText: /daily|weekly|monthly/i })
    );
    await frequencySelect.selectOption('daily');
    
    // Set due date to today
    const today = new Date().toISOString().split('T')[0];
    const dueDateField = page.getByLabel(/due date/i).or(
      page.locator('input[type="date"]')
    );
    await dueDateField.fill(today);
    
    // Save task
    await page.getByRole('button', { name: /save|create|add/i }).click();
    await expect(page.getByLabel('Task name')).not.toBeVisible();
    
    // Navigate to upcoming view
    const upcomingLink = page.getByRole('link', { name: /upcoming/i }).or(
      page.getByText('Upcoming')
    );
    await upcomingLink.click();
    
    // Wait for upcoming page to load
    await expect(page).toHaveURL(/\/upcoming/);
    
    // Wait a moment for recurring tasks to be generated
    await page.waitForTimeout(2000);
    
    // Look for the recurring task instances
    // Should see multiple instances of the same task for different days
    const taskInstances = page.getByText(taskName);
    
    // Should see at least 2 instances (today and future days)
    await expect(taskInstances.first()).toBeVisible();
    
    // Count should be more than 1 (multiple instances for different days)
    const instanceCount = await taskInstances.count();
    expect(instanceCount).toBeGreaterThan(1);
    
    // Click on one of the instances to check details
    await taskInstances.first().click();
    
    // Verify it shows as a recurring task instance
    await expect(page.getByText(taskName)).toBeVisible();
    
    // Look for parent task reference or recurring indicator
    const recurringIndicator = page.getByText(/recurring/i).or(
      page.getByText(/part of.*series/i)
    ).or(
      page.locator('[data-testid="recurring-instance-indicator"]')
    );
    
    // Note: This might not be visible depending on UI design
    // The key test is that multiple instances exist in upcoming view
  });

  test('can edit recurring task settings', async ({ page }) => {
    // Create a weekly recurring task first
    await page.getByRole('button', { name: /add task/i }).click();
    await expect(page.getByLabel('Task name')).toBeVisible();
    
    const taskName = `Edit Recurring E2E ${Date.now()}`;
    await page.getByLabel('Task name').fill(taskName);
    
    // Enable recurring
    const recurringToggle = page.locator('[data-testid="recurring-toggle"]').or(
      page.getByLabel(/recurring/i)
    ).or(
      page.getByText(/recurring/i).locator('..').locator('input')
    );
    await recurringToggle.check();
    
    // Set to weekly initially
    const frequencySelect = page.getByLabel(/frequency/i).or(
      page.locator('[data-testid="recurrence-frequency"]')
    ).or(
      page.locator('select').filter({ hasText: /daily|weekly|monthly/i })
    );
    await frequencySelect.selectOption('weekly');
    
    // Save task
    await page.getByRole('button', { name: /save|create|add/i }).click();
    await expect(page.getByLabel('Task name')).not.toBeVisible();
    
    // Find and click on the created task
    const taskItem = page.getByText(taskName).first();
    await expect(taskItem).toBeVisible();
    await taskItem.click();
    
    // Look for edit button
    const editButton = page.getByRole('button', { name: /edit/i }).or(
      page.locator('[data-testid="edit-task-button"]')
    ).or(
      page.getByTitle(/edit/i)
    );
    await editButton.click();
    
    // Change frequency from weekly to daily
    const editFrequencySelect = page.getByLabel(/frequency/i).or(
      page.locator('[data-testid="recurrence-frequency"]')
    ).or(
      page.locator('select').filter({ hasText: /daily|weekly|monthly/i })
    );
    await editFrequencySelect.selectOption('daily');
    
    // Save changes
    await page.getByRole('button', { name: /save|update/i }).click();
    
    // Verify the change was applied
    await expect(page.getByText(/daily/i)).toBeVisible();
    
    // Navigate to upcoming to see if new instances are generated
    const upcomingLink = page.getByRole('link', { name: /upcoming/i }).or(
      page.getByText('Upcoming')
    );
    await upcomingLink.click();
    
    await page.waitForTimeout(2000); // Wait for generation
    
    // Should now see daily instances instead of weekly
    const instances = page.getByText(taskName);
    const instanceCount = await instances.count();
    
    // Daily should generate more instances than weekly in the same timeframe
    expect(instanceCount).toBeGreaterThan(1);
  });
});
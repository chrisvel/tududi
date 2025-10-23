import { test, expect } from '@playwright/test';
import { login } from '../helpers/testHelpers';

test('user can toggle dark mode on and off', async ({ page, baseURL }) => {
  await login(page, baseURL);

  // Verify we're on the today page
  await expect(page).toHaveURL(/\/today$/);

  // Initial state check - get the current theme
  const htmlElement = page.locator('html');
  const initialHasDarkClass = await htmlElement.evaluate(el => el.classList.contains('dark'));

  // Find and click the dark mode toggle button
  // The DarkModeToggle component should be in the layout/navbar
  const darkModeToggle = page.locator('button').filter({ hasText: /dark|light/i }).or(
    page.locator('[aria-label*="dark" i], [aria-label*="light" i], [title*="dark" i], [title*="light" i]')
  ).first();

  // If there's a specific icon or button, we click it
  await darkModeToggle.click();

  // Wait for the class to toggle on the html element
  await page.waitForTimeout(500); // Small delay for CSS transition

  // Verify the dark class has toggled
  const afterToggleHasDarkClass = await htmlElement.evaluate(el => el.classList.contains('dark'));
  expect(afterToggleHasDarkClass).toBe(!initialHasDarkClass);

  // Verify localStorage has been updated
  const darkModeStorage = await page.evaluate(() => localStorage.getItem('isDarkMode'));
  expect(darkModeStorage).toBe(JSON.stringify(afterToggleHasDarkClass));

  // Toggle back
  await darkModeToggle.click();
  await page.waitForTimeout(500);

  // Verify it toggles back to original state
  const finalHasDarkClass = await htmlElement.evaluate(el => el.classList.contains('dark'));
  expect(finalHasDarkClass).toBe(initialHasDarkClass);
});

test('dark mode preference persists across page reloads', async ({ page, baseURL }) => {
  const appUrl = await login(page, baseURL);

  // Set dark mode via localStorage
  await page.evaluate(() => {
    localStorage.setItem('isDarkMode', 'true');
  });

  // Reload the page
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Verify dark class is applied
  const htmlElement = page.locator('html');
  const hasDarkClass = await htmlElement.evaluate(el => el.classList.contains('dark'));
  expect(hasDarkClass).toBe(true);

  // Now set light mode
  await page.evaluate(() => {
    localStorage.setItem('isDarkMode', 'false');
  });

  // Reload again
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Verify dark class is removed
  const hasDarkClassAfter = await htmlElement.evaluate(el => el.classList.contains('dark'));
  expect(hasDarkClassAfter).toBe(false);
});

test('dark mode applies dark background and text colors', async ({ page, baseURL }) => {
  await login(page, baseURL);

  const htmlElement = page.locator('html');

  // Enable dark mode via localStorage and reload
  await page.evaluate(() => {
    localStorage.setItem('isDarkMode', 'true');
  });
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Verify dark class is applied
  const hasDarkClass = await htmlElement.evaluate(el => el.classList.contains('dark'));
  expect(hasDarkClass).toBe(true);

  // Check that some dark mode styles are applied
  // Tailwind's dark mode should change background colors
  const bodyBg = await page.evaluate(() => {
    return window.getComputedStyle(document.body).backgroundColor;
  });

  // Dark mode should have a dark background (not pure white)
  // This is a basic check - we're not checking exact colors
  expect(bodyBg).not.toBe('rgb(255, 255, 255)');
});

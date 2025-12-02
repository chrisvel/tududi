import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: process.cwd() + '/.env' });

const baseURL = process.env.APP_URL || 'http://localhost:8080';
const slowMoMs = Number(process.env.E2E_SLOWMO || '0') || 0;

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined, // Use default workers locally, 1 in CI
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 800 },
    launchOptions: { slowMo: slowMoMs },
  },
  projects: [
    { name: 'Chromium', use: { ...devices['Desktop Chrome'] } },
    // { name: 'Firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'WebKit', use: { ...devices['Desktop Safari'] } },
  ],
});

import { test, expect, request as playwrightRequest } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import sqlite3 from 'sqlite3';

// Only the dedicated E2E fixture can be backdated. The HTTP/UI writes are real;
// this moves started_at instead of waiting 25 minutes or changing the app clock.
const fixture =
    process.env.E2E_FOCUS_DB ||
    path.resolve(__dirname, '../../backend/db/test.sqlite3');
function backdate(uid: string, minutes: number): Promise<void> {
    if (!/(test|e2e)[^/]*\.sqlite3$/.test(fixture) || !fs.existsSync(fixture))
        throw new Error(
            'A dedicated test database is required for the Focus clock fixture'
        );
    const at = new Date(Date.now() - minutes * 60000)
        .toISOString()
        .replace('T', ' ')
        .replace('Z', ' +00:00');
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(fixture);
        db.run(
            'UPDATE ltd_focus_sessions SET started_at = ? WHERE uid = ? AND ended_at IS NULL',
            [at, uid],
            function (err) {
                db.close();
                if (err) reject(err);
                else if (this.changes !== 1)
                    reject(new Error('Expected one open fixture session'));
                else resolve();
            }
        );
    });
}

test('Phase 12 DoD: one server clock, 1 / 2 and 37 minutes, breaks excluded', async ({
    page,
    baseURL,
}) => {
    test.setTimeout(90_000);
    const app = baseURL!;
    const admin = await playwrightRequest.newContext({ baseURL: app });
    expect(
        (
            await admin.post('/api/login', {
                data: {
                    email: process.env.E2E_EMAIL || 'test@tududi.com',
                    password: process.env.E2E_PASSWORD || 'password123',
                },
            })
        ).ok()
    ).toBeTruthy();
    const email = `focus12-${Date.now()}@example.com`;
    expect(
        (
            await admin.post('/api/admin/users', {
                data: { email, password: 'password123' },
            })
        ).status()
    ).toBe(201);
    await admin.dispose();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const failures: string[] = [];
    page.on('response', (r) => {
        if (
            r.url().includes('/api/') &&
            r.status() >= 400 &&
            !(r.status() === 401 && r.url().endsWith('/api/profile')) &&
            !(r.status() === 404 && r.url().endsWith('/api/billing'))
        )
            failures.push(`${r.status()} ${r.url()}`);
    });
    await page.goto(`${app}/login`);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: /login/i }).click();
    await expect(page).toHaveURL(/\/welcome$/);
    await page.getByTestId('welcome-start').click();
    await expect(page).toHaveURL(/\/today$/);
    const api = page.context().request;
    expect(
        (
            await api.patch(`${app}/api/profile`, {
                data: {
                    language: 'fa',
                    timezone: `Etc/GMT${new Date().getUTCHours() >= 12 ? '+' : '-'}${Math.abs(new Date().getUTCHours() - 12)}`,
                    features: { pomodoro_enabled: true },
                    ui_settings: {
                        locale: {
                            calendarSystem: 'persian',
                            latinDigits: false,
                        },
                    },
                },
            })
        ).ok()
    ).toBeTruthy();
    const task = await (
        await api.post(`${app}/api/task`, {
            data: {
                name: 'نوشتن Draft — آزمایش فاز ۱۲',
                focus_minutes: 25,
                estimated_minutes: 50,
            },
        })
    ).json();
    expect(
        (
            await api.put(`${app}/api/daily-plan/today`, {
                data: { items: [{ task_uid: task.uid, duration_minutes: 50 }] },
            })
        ).ok()
    ).toBeTruthy();
    expect(
        (await api.post(`${app}/api/daily-plan/today/start`)).ok()
    ).toBeTruthy();
    await page.evaluate(() => {
        localStorage.setItem('i18nextLng', 'fa');
        localStorage.setItem(
            'tududi_pomodoro_timer',
            JSON.stringify({
                isActive: true,
                isRunning: true,
                startTime: Date.now(),
            })
        );
    });
    await page.goto(`${app}/today?lng=fa`);
    await expect(page.getByTestId('now-card')).toBeVisible();
    expect(
        await page.evaluate(() => localStorage.getItem('tududi_pomodoro_timer'))
    ).toBeNull();
    await page.getByTestId('now-card-focus').click();
    await expect(page.getByTestId('focus-mode')).toBeVisible();
    const first = (
        await (await api.get(`${app}/api/focus-sessions/current`)).json()
    ).session;
    expect(first.planned_minutes).toBe(25);
    await backdate(first.uid, 45);
    await page.reload();
    await expect(page.getByTestId('focus-clock')).toHaveText('۰۰:۰۰');
    const progress = page
        .getByTestId('focus-mode')
        .getByTestId('focus-ring')
        .locator('.ltd-focus-progress');
    await expect(progress).toHaveCSS('transition-duration', '1s');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(progress).toHaveCSS('transition-duration', '0s');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const endedResponse = page.waitForResponse(
        (r) => r.url().endsWith(`/${first.uid}/end`) && r.ok()
    );
    await page.getByTestId('focus-break').click();
    expect((await (await endedResponse).json()).session.actual_minutes).toBe(
        25
    );
    await expect(page.getByText('بلند شو و کمی راه برو.')).toBeVisible();
    expect(
        (await (await api.get(`${app}/api/focus-sessions/today`)).json())
            .spent_minutes
    ).toBe(25);
    // Expire only the local break clock; no session may be started automatically.
    await page.clock.install({ time: new Date() });
    await page.clock.fastForward(6 * 60000);
    await expect(page.getByTestId('focus-next')).toBeVisible();
    expect(
        (await (await api.get(`${app}/api/focus-sessions/current`)).json())
            .session
    ).toBeNull();
    expect(
        (await (await api.get(`${app}/api/focus-sessions/today`)).json())
            .spent_minutes
    ).toBe(25);
    // Restore the browser clock before starting the next real server interval.
    await page.clock.setSystemTime(new Date());
    await page.getByTestId('focus-next').click();
    await expect(page.getByTestId('focus-clock')).toHaveText('۲۵:۰۰');
    const second = (
        await (await api.get(`${app}/api/focus-sessions/current`)).json()
    ).session;
    await page.getByRole('button', { name: 'ادامه در برنامه' }).click();
    await expect(page.getByTestId('pomodoro-chip')).toContainText(task.name);
    await page.getByTestId('pomodoro-chip').click();
    expect(
        (await (await api.get(`${app}/api/focus-sessions/current`)).json())
            .session.uid
    ).toBe(second.uid);
    await backdate(second.uid, 12);
    await page.reload();
    await expect(page.getByTestId('focus-clock')).toHaveText('۱۳:۰۰');
    await page.screenshot({
        path: '/tmp/ltd-phase12-focus.png',
        animations: 'disabled',
        fullPage: true,
    });
    await page.getByTestId('focus-interrupt').click();
    await page.getByTestId('focus-note-input').fill('بخش دوم');
    await page.getByTestId('focus-save-interrupt').click();
    await expect(page.getByTestId('focus-mode')).toHaveCount(0);
    await expect(
        page.getByTestId('now-card').getByTestId('focus-count')
    ).toHaveText('۱ / ۲');
    await expect(
        page.getByTestId('now-card').getByTestId('focus-spent')
    ).toHaveText('۳۷ دقیقه');
    await page.screenshot({
        path: '/tmp/ltd-phase12-today.png',
        animations: 'disabled',
        fullPage: true,
    });
    // Sibling route reads the same lifetime projection; count/length edits share the estimate.
    await page.goto(`${app}/task/${task.uid}?lng=fa`);
    await page.getByRole('button', { name: /جزئیات|details/i }).click();
    await expect(page.getByTestId('task-focus-length')).toHaveValue('25');
    await expect(page.getByTestId('task-focus-count')).toHaveValue('2');
    await expect(page.getByTestId('focus-count').first()).toHaveText('۱ / ۲');
    await expect(page.getByTestId('focus-spent').first()).toHaveText(
        '۳۷ دقیقه'
    );
    expect(
        await page.evaluate(() => localStorage.getItem('tududi_pomodoro_timer'))
    ).toBeNull();
    await page.getByTestId('pomodoro-chip').click();
    await expect(page.getByTestId('focus-picker')).toBeVisible();
    const startResponse = page.waitForResponse(
        (r) => r.url().endsWith('/api/focus-sessions') && r.status() === 201
    );
    await page
        .getByTestId('focus-picker')
        .getByRole('button', { name: task.name, exact: true })
        .click();
    const third = (await (await startResponse).json()).session;
    await expect(page.getByTestId('focus-mode')).toBeVisible();
    expect(third.task_uid).toBe(task.uid);
    expect(third.planned_minutes).toBe(25);
    expect(
        (await (await api.get(`${app}/api/focus-sessions/current`)).json())
            .session.uid
    ).toBe(third.uid);
    await page.getByTestId('focus-finish').click();
    await expect(page.getByTestId('focus-mode')).toHaveCount(0);
    await page.getByTestId('task-focus-length').selectOption('50');
    await expect(page.getByTestId('task-focus-count')).toHaveValue('1');
    expect(
        (await (await api.get(`${app}/api/task/${task.uid}`)).json())
            .estimated_minutes
    ).toBe(50);
    await page.getByTestId('task-focus-length').selectOption('25');
    await expect(page.getByTestId('task-focus-count')).toHaveValue('2');
    expect(errors).toEqual([]);
    expect(failures).toEqual([]);
});

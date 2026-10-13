import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import AdminDashboardPage from '../AdminDashboardPage';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any, vars?: any) => {
            const template = typeof fallback === 'string' ? fallback : key;
            if (!vars) return template;
            return Object.keys(vars).reduce(
                (out, name) => out.replace(`{{${name}}}`, String(vars[name])),
                template
            );
        },
    }),
}));

const overview = (hosted: boolean, trendsOverride: object = {}) => ({
    users: { total: 3, admins: 1, verified: 3, last24h: 0 },
    content: { tasks: 10, projects: 2, notes: 1 },
    waitlist: { total: 0, last7d: 0 },
    trends: {
        days: Array.from({ length: 14 }, (_, i) => ({
            date: `2026-10-${String(i + 1).padStart(2, '0')}`,
            signups: i >= 7 ? 2 : 1,
            waitlist: 0,
        })),
        signups: { last7d: 14, prev7d: 7 },
        waitlist: { last7d: 0, prev7d: 0 },
        activation: { new_users: 14, activated: 7 },
        active_users_7d: 5,
        tasks: {
            created: { last7d: 30, prev7d: 10 },
            completed: { last7d: 12, prev7d: 9 },
        },
        visits: {
            landing: {
                views: { last7d: 40, prev7d: 20 },
                visitors: { last7d: 20, prev7d: 10 },
            },
            blog: {
                views: { last7d: 10, prev7d: 10 },
                visitors: { last7d: 5, prev7d: 5 },
            },
            app: {
                views: { last7d: 9, prev7d: 3 },
                visitors: { last7d: 4, prev7d: 2 },
            },
            days: Array.from({ length: 14 }, (_, i) => ({
                date: `2026-10-${String(i + 1).padStart(2, '0')}`,
                views: 3,
                visitors: 2,
            })),
            top_pages: [{ surface: 'landing', path: '/cloud', views: 12 }],
            top_referrers: [{ host: 'news.example', views: 7 }],
            app_users: { dau: 4, wau: 6, prev_wau: 3, mau: 11 },
        },
        billing: hosted
            ? {
                  trials_started_7d: 3,
                  trials_ending_7d: 1,
                  canceled_7d: 1,
                  payment_failed_7d: 0,
              }
            : null,
        ...trendsOverride,
    },
    billing: {
        paying: 0,
        hosted,
        subscription_required: false,
        provider: hosted ? 'stripe' : null,
    },
    instance: {
        registration_enabled: true,
        version: 'v1.0.0',
        environment: 'test',
    },
});

const headers = { get: () => null } as unknown as Headers;

const mockFetch = (hosted: boolean, trendsOverride: object = {}) => {
    global.fetch = jest.fn((url: string) => {
        if (String(url).includes('admin/overview')) {
            return Promise.resolve({
                ok: true,
                headers,
                json: async () => overview(hosted, trendsOverride),
            } as Response);
        }
        return Promise.resolve({
            ok: true,
            headers,
            json: async () => ({ subscribers: [] }),
        } as Response);
    }) as any;
};

describe('Admin dashboard billing/AI usage links', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('shows Billing and AI Usage links when hosted', async () => {
        mockFetch(true);

        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        );

        await waitFor(() =>
            expect(screen.getByText('Billing')).toBeInTheDocument()
        );
        expect(screen.getByText('AI Usage')).toBeInTheDocument();
    });

    it('hides Billing and AI Usage links on a self-hosted instance', async () => {
        mockFetch(false);

        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        );

        await waitFor(() =>
            expect(screen.getByText('self-hosted')).toBeInTheDocument()
        );
        expect(screen.queryByText('Billing')).toBeNull();
        expect(screen.queryByText('AI Usage')).toBeNull();
    });
});

describe('Admin dashboard waitlist', () => {
    it('does not list the latest waitlist signups', async () => {
        mockFetch(false);

        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        );

        await waitFor(() =>
            expect(screen.getByText('self-hosted')).toBeInTheDocument()
        );
        expect(screen.queryByText('Latest waitlist signups')).toBeNull();
        expect(
            (global.fetch as jest.Mock).mock.calls.some(([url]) =>
                String(url).includes('admin/waitlist')
            )
        ).toBe(false);
    });

    it('shows the last 7 days of signups, activation and churn', async () => {
        mockFetch(true);

        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        );

        await waitFor(() =>
            expect(screen.getByTestId('admin-trends')).toBeInTheDocument()
        );
        expect(screen.getByText('+7 vs last week')).toBeInTheDocument();
        expect(screen.getByTestId('admin-trends-activation')).toHaveTextContent(
            '50%'
        );
        expect(screen.getByTestId('admin-trends-churn')).toHaveTextContent(
            '1 · 0'
        );
        expect(screen.getByTestId('admin-trends-bars').children).toHaveLength(
            7
        );
    });

    it('leaves trial and churn tiles off a self-hosted instance', async () => {
        mockFetch(false);

        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        );

        await waitFor(() =>
            expect(screen.getByTestId('admin-trends')).toBeInTheDocument()
        );
        expect(screen.queryByTestId('admin-trends-churn')).toBeNull();
    });
});

describe('Admin dashboard visits', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('shows visitors, conversion, app users and the rankings', async () => {
        mockFetch(false);

        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        );

        await waitFor(() =>
            expect(screen.getByTestId('admin-visits')).toBeInTheDocument()
        );
        // 20 landing + 5 blog visitors; 14 signups of them
        expect(screen.getByTestId('admin-visits')).toHaveTextContent('25');
        expect(screen.getByTestId('admin-visits-conversion')).toHaveTextContent(
            '56%'
        );
        expect(screen.getByTestId('admin-visits-app-users')).toHaveTextContent(
            '4 today'
        );
        expect(screen.getByTestId('admin-visits-bars').children).toHaveLength(
            7
        );
        expect(screen.getByTestId('admin-visits-pages')).toHaveTextContent(
            '/cloud'
        );
        expect(screen.getByTestId('admin-visits-referrers')).toHaveTextContent(
            'news.example'
        );
        expect(
            screen.getByTestId('admin-trends-tasks-completed')
        ).toHaveTextContent('12');
    });

    it('leaves the section out when tracking is off', async () => {
        mockFetch(false, { visits: null });

        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        );

        await waitFor(() =>
            expect(screen.getByTestId('admin-trends')).toBeInTheDocument()
        );
        expect(screen.queryByTestId('admin-visits')).toBeNull();
    });
});

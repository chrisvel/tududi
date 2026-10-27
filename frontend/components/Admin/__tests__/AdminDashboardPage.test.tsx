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

const funnel = (hosted: boolean) => ({
    days: 30,
    hosted,
    trials: hosted,
    activation_tasks: 5,
    current: {
        visitors: 400,
        signups: 20,
        activated: 10,
        paid: hosted ? 2 : null,
        paid_any: hosted ? 3 : null,
    },
    previous: {
        visitors: 300,
        signups: 15,
        activated: 6,
        paid: hosted ? 1 : null,
        paid_any: hosted ? 1 : null,
    },
});

const overview = (hosted: boolean, trendsOverride: object = {}) => ({
    users: { total: 3, admins: 1, verified: 3, last24h: 0 },
    content: { tasks: 10, projects: 2, notes: 1 },
    waitlist: { total: 0, last7d: 0 },
    funnel: funnel(hosted),
    insights: [
        {
            key: 'signups_up',
            tone: 'good',
            params: { pct: 100, now: 14, before: 7 },
        },
        { key: 'not_known_yet', tone: 'info', params: {} },
    ],
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
            expect(screen.getByTestId('admin-stat-users')).toBeInTheDocument()
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
            expect(screen.getByTestId('admin-stat-users')).toBeInTheDocument()
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
        expect(screen.getByTestId('admin-trends-signups')).toHaveTextContent(
            '147+7'
        );
        expect(screen.getByTestId('admin-trends-activation')).toHaveTextContent(
            '7 / 14 · 50%'
        );
        expect(screen.getByTestId('admin-trends-canceled')).toHaveTextContent(
            '1'
        );
        expect(screen.getByTestId('admin-trends-failed')).toHaveTextContent(
            '0'
        );
    });

    it('leaves trial and churn rows off a self-hosted instance', async () => {
        mockFetch(false);

        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        );

        await waitFor(() =>
            expect(screen.getByTestId('admin-trends')).toBeInTheDocument()
        );
        expect(screen.queryByTestId('admin-trends-canceled')).toBeNull();
    });
});

describe('Admin dashboard key numbers and insights', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('shows the key numbers with their change', async () => {
        mockFetch(true);

        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        );

        await waitFor(() =>
            expect(
                screen.getByTestId('admin-stat-visitors')
            ).toBeInTheDocument()
        );
        // 20 landing + 5 blog visitors, up from 15
        expect(screen.getByTestId('admin-stat-visitors')).toHaveTextContent(
            '25+10'
        );
        expect(screen.getByTestId('admin-stat-activation')).toHaveTextContent(
            '50%10 of 20 signups'
        );
        expect(screen.getByTestId('admin-stat-weekly')).toHaveTextContent(
            '6+3'
        );
        expect(screen.getByTestId('admin-stat-paying')).toBeInTheDocument();
    });

    it('words the insights it knows and skips the rest', async () => {
        mockFetch(false);

        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        );

        await waitFor(() =>
            expect(screen.getByTestId('admin-insights')).toBeInTheDocument()
        );
        expect(
            screen.getByText('Signups are up 100% this week (14, was 7).')
        ).toBeInTheDocument();
        expect(screen.queryByTestId('admin-insight-not_known_yet')).toBeNull();
    });
});

describe('Admin dashboard visits', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('shows visitors, app users and the rankings', async () => {
        mockFetch(false);

        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        );

        await waitFor(() =>
            expect(screen.getByTestId('admin-trends')).toBeInTheDocument()
        );
        expect(screen.getByTestId('admin-trends-visitors')).toHaveTextContent(
            '2515+10'
        );
        expect(screen.getByTestId('admin-trends-app-users')).toHaveTextContent(
            '4 today'
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

    it('leaves the visit rows out when tracking is off', async () => {
        mockFetch(false, { visits: null });

        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        );

        await waitFor(() =>
            expect(screen.getByTestId('admin-trends')).toBeInTheDocument()
        );
        expect(screen.queryByTestId('admin-trends-visitors')).toBeNull();
        expect(screen.queryByTestId('admin-visits-pages')).toBeNull();
        expect(screen.queryByTestId('admin-stat-visitors')).toBeNull();
    });
});

describe('Admin dashboard funnel', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('shows each step with the share that made it from the step before', async () => {
        mockFetch(true);

        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        );

        await waitFor(() =>
            expect(screen.getByTestId('admin-funnel')).toBeInTheDocument()
        );
        expect(
            screen.getByText('Trial funnel, last 30 days')
        ).toBeInTheDocument();
        // 20 of 400 visitors, 10 of 20 signups, 2 of 10 activated
        expect(
            screen.getByTestId('admin-funnel-signups-rate')
        ).toHaveTextContent('5%');
        expect(
            screen.getByTestId('admin-funnel-activated-rate')
        ).toHaveTextContent('50%');
        expect(screen.getByTestId('admin-funnel-paid-rate')).toHaveTextContent(
            '20%'
        );
        // 6 of 15 activated the month before: 40% to 50%
        expect(screen.getByText('+10 pts')).toBeInTheDocument();
        expect(screen.getByText('End to end: 0.5%')).toBeInTheDocument();
        expect(
            screen.getByText(/1 more paid without activating/)
        ).toBeInTheDocument();
    });

    it('gives no visitor rate when signups outnumber counted visitors', async () => {
        mockFetch(true);
        const base = (global.fetch as jest.Mock).getMockImplementation()!;
        global.fetch = jest.fn(async (url: string) => {
            const res = await base(url);
            if (!String(url).includes('admin/overview')) return res;
            const body = await res.json();
            body.funnel.current.visitors = 3;
            return { ...res, json: async () => body };
        }) as any;

        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        );

        await waitFor(() =>
            expect(screen.getByTestId('admin-funnel')).toBeInTheDocument()
        );
        expect(
            screen.getByTestId('admin-funnel-signups-rate')
        ).toHaveTextContent('?');
        // end to end starts at signups instead: 2 of 20
        expect(screen.getByText('End to end: 10%')).toBeInTheDocument();
    });

    it('stops at activation on a self-hosted instance', async () => {
        mockFetch(false);

        render(
            <MemoryRouter>
                <AdminDashboardPage />
            </MemoryRouter>
        );

        await waitFor(() =>
            expect(screen.getByTestId('admin-funnel')).toBeInTheDocument()
        );
        expect(
            screen.getByText('Signup funnel, last 30 days')
        ).toBeInTheDocument();
        expect(
            screen.getByTestId('admin-funnel-activated')
        ).toBeInTheDocument();
        expect(screen.queryByTestId('admin-funnel-paid')).toBeNull();
    });
});

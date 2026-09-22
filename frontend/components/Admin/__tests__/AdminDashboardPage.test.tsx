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

const overview = (hosted: boolean) => ({
    users: { total: 3, admins: 1, verified: 3, last24h: 0 },
    content: { tasks: 10, projects: 2, notes: 1 },
    waitlist: { total: 0, last7d: 0 },
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

const mockFetch = (hosted: boolean) => {
    global.fetch = jest.fn((url: string) => {
        if (String(url).includes('admin/overview')) {
            return Promise.resolve({
                ok: true,
                headers,
                json: async () => overview(hosted),
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

        await waitFor(() => expect(screen.getByText('Billing')).toBeInTheDocument());
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

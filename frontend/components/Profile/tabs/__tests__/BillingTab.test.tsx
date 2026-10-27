import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BillingTab from '../BillingTab';
import {
    fetchBillingStatus,
    fetchBillingCatalog,
    startCheckout,
} from '../../../../utils/billingService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) => {
            const template =
                typeof fallback === 'string'
                    ? fallback
                    : (fallback?.defaultValue ?? key);
            const vars = typeof fallback === 'object' ? fallback : {};
            return Object.keys(vars).reduce(
                (out, name) => out.replace(`{{${name}}}`, String(vars[name])),
                template
            );
        },
    }),
}));

jest.mock('../../../Shared/ToastContext', () => ({
    useToast: () => ({
        showErrorToast: jest.fn(),
        showSuccessToast: jest.fn(),
    }),
}));

jest.mock('../../../../utils/billingService', () => ({
    ...jest.requireActual('../../../../utils/billingService'),
    fetchBillingStatus: jest.fn(),
    fetchBillingCatalog: jest.fn(),
    startCheckout: jest.fn(),
    openPortal: jest.fn(),
    syncCheckout: jest.fn(),
}));

const mockStatus = fetchBillingStatus as jest.Mock;
const mockCatalog = fetchBillingCatalog as jest.Mock;
const mockCheckout = startCheckout as jest.Mock;

const limits = {
    max_tasks: null,
    max_projects: null,
    max_notes: null,
    storage_mb: 5000,
    ai_requests_per_month: 200,
    ai_credits_per_month: 50,
};

const status = (overrides: Record<string, unknown> = {}) => ({
    hosted: true,
    plan: 'trial',
    planName: 'Pro',
    status: 'none',
    reason: 'trial',
    limits: { ...limits, max_members: 1 },
    features: {},
    subscription_required: true,
    active: true,
    seats: { members: 0, used: 1, seats: 1 },
    billing_configured: true,
    pricing: { currency: 'EUR', monthly: 5, annual: 50 },
    provider: { name: 'lemonsqueezy', display_name: 'Lemon Squeezy' },
    checkout_available: true,
    portal_available: false,
    intervals: { month: true, year: true },
    plans_available: [
        { key: 'pro', seats: 1, intervals: { month: true, year: true } },
        { key: 'team_3', seats: 3, intervals: { month: true, year: true } },
        { key: 'team_5', seats: 5, intervals: { month: true, year: true } },
    ],
    subscription: null,
    ...overrides,
});

const renderTab = () =>
    render(
        <MemoryRouter>
            <BillingTab isActive />
        </MemoryRouter>
    );

describe('BillingTab', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCatalog.mockResolvedValue({
            plans: [{ key: 'pro', name: 'Pro', limits, features: {} }],
            intervals: { month: true, year: true },
            trial_days: 7,
        });
        mockCheckout.mockResolvedValue('https://checkout.example/x');
    });

    it('checks out Pro by default', async () => {
        mockStatus.mockResolvedValue(status());
        renderTab();

        fireEvent.click(await screen.findByTestId('billing-upgrade'));

        await waitFor(() =>
            expect(mockCheckout).toHaveBeenCalledWith('year', 'pro')
        );
    });

    it('picks a Team size and prices it per seat', async () => {
        mockStatus.mockResolvedValue(status());
        renderTab();

        fireEvent.click(await screen.findByTestId('billing-plan-team'));
        fireEvent.change(screen.getByTestId('billing-team-size'), {
            target: { value: 'team_5' },
        });

        expect(screen.getByText('Upgrade to Team (5 seats)')).toBeVisible();
        expect(screen.getByTestId('billing-price')).toHaveTextContent('250');

        fireEvent.click(screen.getByTestId('billing-upgrade'));
        await waitFor(() =>
            expect(mockCheckout).toHaveBeenCalledWith('year', 'team_5')
        );
    });

    it('shows the seats in use on a Team plan, and no upgrade card', async () => {
        mockStatus.mockResolvedValue(
            status({
                plan: 'team_5',
                planName: 'Team (5 seats)',
                reason: 'subscription',
                status: 'active',
                seats: { members: 4, used: 5, seats: 5 },
                checkout_available: false,
                portal_available: true,
            })
        );
        renderTab();

        expect(await screen.findByTestId('billing-seats')).toHaveTextContent(
            '5 of 5 seats in use.'
        );
        expect(screen.getByTestId('billing-seats')).toHaveTextContent(
            'bigger Team plan'
        );
        expect(screen.queryByTestId('billing-upgrade')).toBeNull();
    });

    it('offers only Pro when no Team plan is on sale', async () => {
        mockStatus.mockResolvedValue(
            status({
                plans_available: [
                    {
                        key: 'pro',
                        seats: 1,
                        intervals: { month: true, year: true },
                    },
                ],
            })
        );
        renderTab();

        await screen.findByTestId('billing-upgrade');
        expect(screen.queryByTestId('billing-plan-team')).toBeNull();
    });
});

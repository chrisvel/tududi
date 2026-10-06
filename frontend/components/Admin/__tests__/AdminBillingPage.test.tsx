import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminBillingPage from '../AdminBillingPage';

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

const toast = { showErrorToast: jest.fn(), showSuccessToast: jest.fn() };
jest.mock('../../Shared/ToastContext', () => ({
    useToast: () => toast,
}));

const fetchAdminBilling = jest.fn();
jest.mock('../../../utils/adminBillingService', () => ({
    fetchAdminBilling: (...args: any[]) => fetchAdminBilling(...args),
    setPlanOverride: jest.fn(),
    clearPlanOverride: jest.fn(),
    syncAccountFromProvider: jest.fn(),
}));

const account = (overrides: Record<string, unknown>) => ({
    user_id: 1,
    email: 'a@example.com',
    name: null,
    plan: 'free',
    status: 'none',
    trial_ends_at: null,
    current_period_end: null,
    cancel_at_period_end: false,
    override_plan: null,
    override_expires_at: null,
    provider: null,
    provider_customer_id: null,
    provider_subscription_id: null,
    ai_requests_this_month: 0,
    ai_tokens_this_month: 0,
    access: 'free',
    trial_days_left: null,
    read_only_until: null,
    ...overrides,
});

describe('Admin billing page', () => {
    beforeEach(() => {
        fetchAdminBilling.mockReset();
        fetchAdminBilling.mockResolvedValue({
            summary: [],
            on_trial: 1,
            total: 2,
            accounts: [
                account({
                    user_id: 1,
                    access: 'trial',
                    trial_ends_at: '2026-10-18T00:00:00.000Z',
                    trial_days_left: 12,
                }),
                account({
                    user_id: 2,
                    email: 'b@example.com',
                    read_only_until: '2026-11-01T00:00:00.000Z',
                }),
            ],
        });
    });

    it('marks trial accounts with the days left, and ended ones', async () => {
        render(<AdminBillingPage />);
        expect(
            await screen.findByTestId('admin-billing-trial-1')
        ).toHaveTextContent('12 days left');
        expect(
            screen.getByTestId('admin-billing-trial-ended-2')
        ).toHaveTextContent('Trial ended');
        expect(screen.getByText('On trial').nextSibling).toHaveTextContent('1');
    });

    it('filters to trials', async () => {
        render(<AdminBillingPage />);
        await screen.findByTestId('admin-billing-trial-1');
        fireEvent.click(screen.getByTestId('admin-billing-trials-only'));
        await waitFor(() =>
            expect(fetchAdminBilling).toHaveBeenLastCalledWith('', 1, 'trial')
        );
    });
});

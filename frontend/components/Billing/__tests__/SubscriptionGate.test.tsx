import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SubscriptionGate from '../SubscriptionGate';
import { fetchBillingStatus } from '../../../utils/billingService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: any) =>
            typeof fallback === 'string' ? fallback : key,
    }),
}));

jest.mock('../../../utils/billingService', () => ({
    fetchBillingStatus: jest.fn(),
}));

const mockStatus = fetchBillingStatus as jest.Mock;

const renderGate = () =>
    render(
        <MemoryRouter initialEntries={['/today']}>
            <Routes>
                <Route
                    path="/subscription/new"
                    element={<div>subscription page</div>}
                />
                <Route
                    path="/today"
                    element={
                        <SubscriptionGate>
                            <div>the app</div>
                        </SubscriptionGate>
                    }
                />
            </Routes>
        </MemoryRouter>
    );

// A new account on a paid instance used to see the app flash before the
// subscription page replaced it.
describe('SubscriptionGate', () => {
    afterEach(() => mockStatus.mockReset());

    it('never renders the app for an account without a subscription', async () => {
        mockStatus.mockResolvedValue({
            subscription_required: true,
            active: false,
        });
        renderGate();

        expect(screen.queryByText('the app')).not.toBeInTheDocument();
        expect(
            await screen.findByText('subscription page')
        ).toBeInTheDocument();
        expect(screen.queryByText('the app')).not.toBeInTheDocument();
    });

    it('renders the app once the subscription is active', async () => {
        mockStatus.mockResolvedValue({
            subscription_required: true,
            active: true,
        });
        renderGate();

        expect(await screen.findByText('the app')).toBeInTheDocument();
    });

    it('renders the app when billing is unavailable (self-hosted)', async () => {
        mockStatus.mockRejectedValue(new Error('Not found'));
        renderGate();

        expect(await screen.findByText('the app')).toBeInTheDocument();
    });
});

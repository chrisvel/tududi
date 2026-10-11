import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import PlanBadge from '../PlanBadge';
import {
    getCachedBillingStatus,
    refreshBillingStatus,
} from '../../../utils/billingService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

jest.mock('../../../utils/billingService', () => ({
    getCachedBillingStatus: jest.fn(),
    refreshBillingStatus: jest.fn(),
}));

const mockCached = getCachedBillingStatus as jest.Mock;
const mockRefresh = refreshBillingStatus as jest.Mock;

const status = (planName: string) => ({
    plan: planName === 'Pro' ? 'pro' : 'free',
    planName,
    reason: 'paid',
});

const renderBadge = () =>
    render(
        <MemoryRouter>
            <PlanBadge />
        </MemoryRouter>
    );

describe('PlanBadge', () => {
    afterEach(() => {
        mockCached.mockReset();
        mockRefresh.mockReset();
    });

    it('shows the cached plan on the first render, before the refresh resolves', () => {
        mockCached.mockReturnValue(status('Pro'));
        mockRefresh.mockReturnValue(new Promise(() => {}));

        renderBadge();

        expect(screen.getByTestId('plan-badge')).toHaveTextContent('Pro');
    });

    it('renders nothing when there is no cached plan yet', () => {
        mockCached.mockReturnValue(null);
        mockRefresh.mockReturnValue(new Promise(() => {}));

        renderBadge();

        expect(screen.queryByTestId('plan-badge')).not.toBeInTheDocument();
    });

    it('updates to the refreshed plan when it arrives', async () => {
        mockCached.mockReturnValue(status('Free'));
        mockRefresh.mockResolvedValue(status('Pro'));

        renderBadge();

        expect(await screen.findByText('Pro')).toBeInTheDocument();
    });
});

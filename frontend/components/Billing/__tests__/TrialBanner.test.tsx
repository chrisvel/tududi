import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import TrialBanner, { daysLeft } from '../TrialBanner';
import { fetchBillingStatus } from '../../../utils/billingService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: any) =>
            typeof opts === 'string'
                ? opts
                : `${key}:${opts?.count ?? opts?.date ?? ''}`,
    }),
}));

jest.mock('../../../hooks/useHostedMode', () => ({
    useHostedMode: () => true,
}));

jest.mock('../../../utils/billingService', () => ({
    fetchBillingStatus: jest.fn(),
}));

const mockStatus = fetchBillingStatus as jest.Mock;
const DAY = 24 * 60 * 60 * 1000;

const renderBanner = () =>
    render(
        <MemoryRouter>
            <TrialBanner />
        </MemoryRouter>
    );

describe('TrialBanner', () => {
    afterEach(() => mockStatus.mockReset());

    it('counts a started day as a whole one', () => {
        const now = Date.now();
        expect(daysLeft(new Date(now + 11.2 * DAY).toISOString(), now)).toBe(
            12
        );
        expect(daysLeft(new Date(now + 60 * 1000).toISOString(), now)).toBe(1);
    });

    it('shows the days left and a subscribe link during the trial', async () => {
        mockStatus.mockResolvedValue({
            reason: 'trial',
            trial_ends_at: new Date(Date.now() + 11.5 * DAY).toISOString(),
        });
        renderBanner();
        expect(
            await screen.findByText('subscription.trialBanner:12')
        ).toBeInTheDocument();
        expect(screen.getByTestId('trial-banner-subscribe')).toHaveAttribute(
            'href',
            '/subscription/new'
        );
    });

    it('says read-only once the trial ended', async () => {
        mockStatus.mockResolvedValue({
            reason: 'free',
            read_only: true,
            read_only_until: new Date(Date.now() + 20 * DAY).toISOString(),
        });
        renderBanner();
        expect(
            await screen.findByTestId('trial-read-only-banner')
        ).toBeInTheDocument();
    });

    it('renders nothing for a paying account', async () => {
        mockStatus.mockResolvedValue({ reason: 'subscription' });
        const { container } = renderBanner();
        await new Promise((r) => setTimeout(r, 0));
        expect(container).toBeEmptyDOMElement();
    });
});

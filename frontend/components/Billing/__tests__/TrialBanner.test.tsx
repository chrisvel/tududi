import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import TrialBanner, { daysLeft } from '../TrialBanner';
import SidebarTrialCard from '../SidebarTrialCard';
import TrialLockNotice from '../TrialLockNotice';
import { fetchBillingStatus } from '../../../utils/billingService';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: any) =>
            typeof opts === 'string'
                ? opts
                : `${key}:${opts?.count ?? opts?.date ?? ''}`,
    }),
}));

jest.mock('../../../utils/featureFlags', () => ({
    getFeatureFlags: () => Promise.resolve({ hosted: true, billing: true }),
}));

jest.mock('../../../utils/billingService', () => ({
    fetchBillingStatus: jest.fn(),
}));

const mockStatus = fetchBillingStatus as jest.Mock;
const DAY = 24 * 60 * 60 * 1000;

const trialStatus = () => ({
    reason: 'trial',
    trial_ends_at: new Date(Date.now() + 11.5 * DAY).toISOString(),
    features: { ai: false, public_notes: false },
    limits: { max_members: 0 },
});

const renderIn = (node: React.ReactElement) =>
    render(<MemoryRouter>{node}</MemoryRouter>);

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('TrialBanner', () => {
    afterEach(() => mockStatus.mockReset());

    it('counts a started day as a whole one', () => {
        const now = Date.now();
        expect(daysLeft(new Date(now + 11.2 * DAY).toISOString(), now)).toBe(
            12
        );
        expect(daysLeft(new Date(now + 60 * 1000).toISOString(), now)).toBe(1);
    });

    it('says read-only once the trial ended', async () => {
        mockStatus.mockResolvedValue({
            reason: 'free',
            read_only: true,
            read_only_until: new Date(Date.now() + 20 * DAY).toISOString(),
        });
        renderIn(<TrialBanner />);
        expect(
            await screen.findByTestId('trial-read-only-banner')
        ).toBeInTheDocument();
    });

    it('leaves the running trial to the sidebar', async () => {
        mockStatus.mockResolvedValue(trialStatus());
        const { container } = renderIn(<TrialBanner />);
        await settle();
        expect(container).toBeEmptyDOMElement();
    });
});

describe('SidebarTrialCard', () => {
    afterEach(() => mockStatus.mockReset());

    it('shows the days left and a subscribe link during the trial', async () => {
        mockStatus.mockResolvedValue(trialStatus());
        renderIn(<SidebarTrialCard />);
        expect(
            await screen.findByText('subscription.trialBanner:12')
        ).toBeInTheDocument();
        expect(screen.getByTestId('trial-banner-subscribe')).toHaveAttribute(
            'href',
            '/subscription/new'
        );
    });

    it('renders nothing for a paying account', async () => {
        mockStatus.mockResolvedValue({ reason: 'subscription' });
        const { container } = renderIn(<SidebarTrialCard />);
        await settle();
        expect(container).toBeEmptyDOMElement();
    });
});

describe('TrialLockNotice', () => {
    afterEach(() => mockStatus.mockReset());

    it.each(['ai', 'public_notes', 'members'] as const)(
        'explains that %s is not in the trial and links to subscribe',
        async (feature) => {
            mockStatus.mockResolvedValue(trialStatus());
            renderIn(<TrialLockNotice feature={feature} />);
            const box = await screen.findByTestId(`trial-lock-${feature}`);
            expect(box.querySelector('a')).toHaveAttribute(
                'href',
                `/subscription/new?feature=${feature}`
            );
        }
    );

    it('renders nothing once subscribed', async () => {
        mockStatus.mockResolvedValue({
            reason: 'subscription',
            features: { ai: true, public_notes: true },
            limits: { max_members: 10 },
        });
        const { container } = renderIn(<TrialLockNotice feature="ai" />);
        await settle();
        expect(container).toBeEmptyDOMElement();
    });
});

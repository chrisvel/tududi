import { subscriptionPathFor } from '../planLimits';

describe('subscriptionPathFor', () => {
    it('sends what a trial leaves out to the subscription page', () => {
        expect(
            subscriptionPathFor({
                code: 'FEATURE_NOT_IN_PLAN',
                error: '',
                details: { feature: 'ai', plan: 'trial' },
            })
        ).toBe('/subscription/new?feature=ai');
    });

    it('sends a write after the trial ended there too', () => {
        expect(subscriptionPathFor({ code: 'TRIAL_ENDED', error: '' })).toBe(
            '/subscription/new'
        );
    });

    it('leaves plan limits to the upgrade modal', () => {
        expect(
            subscriptionPathFor({
                code: 'FEATURE_NOT_IN_PLAN',
                error: '',
                details: { feature: 'ai', plan: 'free' },
            })
        ).toBeNull();
        expect(
            subscriptionPathFor({ code: 'PLAN_LIMIT_REACHED', error: '' })
        ).toBeNull();
    });
});

const { buildInsights } = require('../../../../modules/admin/insights');

const week = (last7d, prev7d) => ({ last7d, prev7d });

const base = (overrides = {}) => ({
    users: { total: 5, empty: 0 },
    feedback: { open: 0 },
    billing: { hosted: false, paying: 0 },
    funnel: {
        days: 30,
        current: {
            visitors: 400,
            signups: 20,
            activated: 12,
            paid: null,
            paid_any: null,
        },
        previous: {
            visitors: 380,
            signups: 18,
            activated: 11,
            paid: null,
            paid_any: null,
        },
    },
    trends: {
        signups: week(10, 9),
        activation: { new_users: 10, activated: 6, verified: 9 },
        onboarding: null,
        tasks: { created: week(50, 48), completed: week(30, 29) },
        visits: null,
        billing: null,
    },
    ...overrides,
});

const keys = (list) => list.map((i) => i.key);

describe('buildInsights', () => {
    it('says it was a quiet week when nothing moved', () => {
        const out = buildInsights(base());
        expect(keys(out)).toContain('biggest_drop');
        const quiet = buildInsights(
            base({
                funnel: {
                    ...base().funnel,
                    current: { ...base().funnel.current, visitors: null },
                    previous: { ...base().funnel.previous, visitors: null },
                },
            })
        );
        expect(keys(quiet)).toEqual(['quiet_week']);
    });

    it('reports big weekly swings and ignores small numbers', () => {
        const up = buildInsights(
            base({ trends: { ...base().trends, signups: week(20, 10) } })
        );
        expect(up.find((i) => i.key === 'signups_up').params).toEqual({
            pct: 100,
            now: 20,
            before: 10,
        });
        const tiny = buildInsights(
            base({ trends: { ...base().trends, signups: week(2, 1) } })
        );
        expect(keys(tiny)).not.toContain('signups_up');
    });

    it('flags visitor counts below the signups and skips that step', () => {
        const out = buildInsights(
            base({
                funnel: {
                    ...base().funnel,
                    current: { ...base().funnel.current, visitors: 3 },
                },
            })
        );
        expect(keys(out)).toContain('visitors_undercounted');
        expect(keys(out)).not.toContain('biggest_drop');
    });

    it('names the funnel step that loses the most people', () => {
        const drop = buildInsights(base()).find(
            (i) => i.key === 'biggest_drop'
        );
        expect(drop.params).toMatchObject({
            from: 'visitors',
            to: 'signups',
            pct: 5,
        });
    });

    it('puts warnings before good news and caps the list', () => {
        const out = buildInsights(
            base({
                users: { total: 20, empty: 15 },
                feedback: { open: 2 },
                trends: {
                    ...base().trends,
                    signups: week(30, 10),
                    activation: { new_users: 10, activated: 2, verified: 3 },
                    billing: {
                        trials_started_7d: 1,
                        trials_ending_7d: 2,
                        canceled_7d: 1,
                        payment_failed_7d: 0,
                    },
                },
            })
        );
        expect(out.length).toBeLessThanOrEqual(6);
        const tones = out.map((i) => i.tone);
        expect(tones.indexOf('good')).toBeGreaterThan(
            tones.lastIndexOf('warn')
        );
        expect(keys(out)).toEqual(
            expect.arrayContaining(['churn', 'unverified', 'empty_accounts'])
        );
    });
});

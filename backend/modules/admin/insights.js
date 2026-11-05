'use strict';

// Plain-language findings for the top of the admin dashboard, worked out
// from the overview figures. Each one is a translation key, a tone and the
// numbers it quotes, so the dashboard words it. Warnings come first, then
// good news, then the rest, and only the first few are kept.

const MAX_INSIGHTS = 6;
// A weekly count has to move by this share, from at least MIN_COUNT on one
// side, before it is worth a line.
const BIG_CHANGE = 0.3;
const MIN_COUNT = 3;
const TONE_ORDER = { warn: 0, good: 1, info: 2 };

const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

const weekChange = (key, now, before) => {
    if (Math.max(now, before) < MIN_COUNT) return null;
    if (!before) {
        return { key: `${key}_new`, tone: 'good', params: { now } };
    }
    const change = (now - before) / before;
    if (Math.abs(change) < BIG_CHANGE) return null;
    return {
        key: change > 0 ? `${key}_up` : `${key}_down`,
        tone: change > 0 ? 'good' : 'warn',
        params: { pct: Math.abs(Math.round(change * 100)), now, before },
    };
};

// The funnel step most people fall out at, leaving out a visitor count
// smaller than the signups it should contain.
const biggestDrop = (steps) => {
    let worst = null;
    for (let i = 1; i < steps.length; i++) {
        const from = steps[i - 1];
        const to = steps[i];
        if (!from.count || to.count > from.count) continue;
        const rate = to.count / from.count;
        if (!worst || rate < worst.rate) {
            worst = { from: from.key, to: to.key, rate };
        }
    }
    return worst;
};

function buildInsights({ users, feedback, funnel, trends, billing }) {
    const out = [];
    const push = (item) => item && out.push(item);
    const visits = trends?.visits || null;
    const siteVisitors = visits
        ? {
              now: visits.landing.visitors.last7d + visits.blog.visitors.last7d,
              before:
                  visits.landing.visitors.prev7d + visits.blog.visitors.prev7d,
          }
        : null;

    if (trends) {
        push(
            weekChange('signups', trends.signups.last7d, trends.signups.prev7d)
        );
    }
    if (siteVisitors) {
        push(weekChange('visitors', siteVisitors.now, siteVisitors.before));
    }

    if (funnel) {
        const { current, previous } = funnel;
        const steps = [];
        if (current.visitors !== null) {
            steps.push({ key: 'visitors', count: current.visitors });
        }
        steps.push({ key: 'signups', count: current.signups });
        steps.push({ key: 'activated', count: current.activated });
        if (current.paid !== null) {
            steps.push({ key: 'paid', count: current.paid });
        }

        if (current.visitors !== null && current.signups > current.visitors) {
            push({
                key: 'visitors_undercounted',
                tone: 'info',
                params: {
                    visitors: current.visitors,
                    signups: current.signups,
                },
            });
        }

        if (current.signups >= MIN_COUNT) {
            const drop = biggestDrop(steps);
            if (drop && drop.rate < 0.5) {
                push({
                    key: 'biggest_drop',
                    tone: 'warn',
                    params: {
                        from: drop.from,
                        to: drop.to,
                        pct: Math.round(drop.rate * 100),
                        days: funnel.days,
                    },
                });
            }
        }

        if (current.signups >= MIN_COUNT && previous.signups >= MIN_COUNT) {
            const now = pct(current.activated, current.signups);
            const before = pct(previous.activated, previous.signups);
            const diff = now - before;
            if (Math.abs(diff) >= 10) {
                push({
                    key: diff > 0 ? 'activation_up' : 'activation_down',
                    tone: diff > 0 ? 'good' : 'warn',
                    params: { now, before, days: funnel.days },
                });
            }
        }

        if (current.paid_any !== null && current.paid !== null) {
            const unactivated = current.paid_any - current.paid;
            if (unactivated > 0) {
                push({
                    key: 'paid_without_activating',
                    tone: 'info',
                    params: { n: unactivated },
                });
            }
        }
    }

    if (trends) {
        const { activation, onboarding } = trends;
        if (
            activation.verified !== undefined &&
            activation.new_users >= MIN_COUNT &&
            activation.verified / activation.new_users < 0.7
        ) {
            push({
                key: 'unverified',
                tone: 'warn',
                params: {
                    n: activation.new_users - activation.verified,
                    total: activation.new_users,
                },
            });
        }
        if (
            onboarding &&
            onboarding.new_users >= 5 &&
            onboarding.first_plan / onboarding.new_users < 0.2
        ) {
            push({
                key: 'few_first_plans',
                tone: 'warn',
                params: {
                    pct: pct(onboarding.first_plan, onboarding.new_users),
                    n: onboarding.first_plan,
                    total: onboarding.new_users,
                },
            });
        }
        if (onboarding && onboarding.cohort >= MIN_COUNT) {
            push({
                key: 'kept_planning',
                tone: onboarding.three_days ? 'info' : 'warn',
                params: {
                    n: onboarding.three_days,
                    total: onboarding.cohort,
                },
            });
        }
        if (trends.tasks) {
            push(
                weekChange(
                    'tasks_completed',
                    trends.tasks.completed.last7d,
                    trends.tasks.completed.prev7d
                )
            );
        }
        if (visits?.app_users) {
            push(
                weekChange(
                    'weekly_users',
                    visits.app_users.wau,
                    visits.app_users.prev_wau
                )
            );
        }
    }

    if (trends?.billing) {
        const b = trends.billing;
        if (b.canceled_7d + b.payment_failed_7d > 0) {
            push({
                key: 'churn',
                tone: 'warn',
                params: {
                    canceled: b.canceled_7d,
                    failed: b.payment_failed_7d,
                },
            });
        }
        if (b.trials_ending_7d > 0) {
            push({
                key: 'trials_ending',
                tone: 'info',
                params: { n: b.trials_ending_7d },
            });
        }
    }

    if (users.total >= 10 && users.empty / users.total >= 0.4) {
        push({
            key: 'empty_accounts',
            tone: 'warn',
            params: { pct: pct(users.empty, users.total), n: users.empty },
        });
    }

    const topReferrer = visits?.top_referrers?.[0];
    if (topReferrer) {
        const total = visits.top_referrers.reduce((n, r) => n + r.views, 0);
        push({
            key: 'top_referrer',
            tone: 'info',
            params: {
                host: topReferrer.host,
                pct: pct(topReferrer.views, total),
            },
        });
    }

    if (feedback?.open > 0) {
        push({
            key: 'open_feedback',
            tone: 'info',
            params: { n: feedback.open },
        });
    }

    if (billing?.hosted && billing.paying === 0 && users.total >= MIN_COUNT) {
        push({ key: 'no_paying', tone: 'info', params: {} });
    }

    if (!out.length) {
        out.push({ key: 'quiet_week', tone: 'info', params: {} });
    }

    // Stable sort keeps the order above within a tone.
    return out
        .map((item, i) => ({ item, i }))
        .sort(
            (a, b) =>
                TONE_ORDER[a.item.tone] - TONE_ORDER[b.item.tone] || a.i - b.i
        )
        .slice(0, MAX_INSIGHTS)
        .map(({ item }) => item);
}

module.exports = { buildInsights };

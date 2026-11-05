import React from 'react';
import { useTranslation } from 'react-i18next';

export interface Insight {
    key: string;
    tone: 'warn' | 'good' | 'info';
    params: Record<string, string | number>;
}

// English wording for each finding the overview can send. Keys the page
// does not know yet are skipped rather than shown raw.
const TEXT: Record<string, string> = {
    signups_up: 'Signups are up {{pct}}% this week ({{now}}, was {{before}}).',
    signups_down:
        'Signups are down {{pct}}% this week ({{now}}, was {{before}}).',
    signups_new: '{{now}} signups this week, after none the week before.',
    visitors_up:
        'Site visitors are up {{pct}}% this week ({{now}}, was {{before}}).',
    visitors_down:
        'Site visitors are down {{pct}}% this week ({{now}}, was {{before}}).',
    visitors_new:
        '{{now}} site visitors this week, after none the week before.',
    visitors_undercounted:
        'More signups ({{signups}}) than counted visitors ({{visitors}}): visit tracking misses most traffic, so the visitor rate is left out.',
    biggest_drop:
        'Most people are lost between {{from}} and {{to}}: {{pct}}% make it (last {{days}} days).',
    activation_up:
        'Activation rose to {{now}}% from {{before}}% the {{days}} days before.',
    activation_down:
        'Activation fell to {{now}}% from {{before}}% the {{days}} days before.',
    paid_without_activating: '{{n}} paid without activating first.',
    unverified:
        "{{n}} of this week's {{total}} signups have not verified their email.",
    few_first_plans:
        'Only {{pct}}% of new users planned a first day ({{n}} of {{total}}).',
    kept_planning:
        "{{n}} of last week's {{total}} signups planned on 3 different days.",
    tasks_completed_up:
        'Tasks completed are up {{pct}}% ({{now}}, was {{before}}).',
    tasks_completed_down:
        'Tasks completed are down {{pct}}% ({{now}}, was {{before}}).',
    tasks_completed_new: '{{now}} tasks completed, after none the week before.',
    weekly_users_up:
        'Weekly app users are up {{pct}}% ({{now}}, was {{before}}).',
    weekly_users_down:
        'Weekly app users are down {{pct}}% ({{now}}, was {{before}}).',
    weekly_users_new: '{{now}} people used the app this week.',
    churn: '{{canceled}} canceled and {{failed}} failed payments this week.',
    trials_ending: '{{n}} trials end in the next 7 days.',
    empty_accounts: '{{pct}}% of all accounts ({{n}}) never created anything.',
    top_referrer: 'Most referred visits come from {{host}} ({{pct}}%).',
    open_feedback: '{{n}} feedback reports are waiting.',
    no_paying: 'No paying customers yet.',
    quiet_week: 'A quiet week: nothing moved much.',
};

const DOT = {
    warn: 'bg-amber-500',
    good: 'bg-emerald-500',
    info: 'bg-gray-400 dark:bg-gray-500',
};

// The handful of things worth knowing this week, in plain words, so the
// numbers below are there to check rather than to decode.
const AdminInsights: React.FC<{ insights: Insight[] }> = ({ insights }) => {
    const { t } = useTranslation();
    const stepLabel: Record<string, string> = {
        visitors: t('admin.funnel.stepVisitors', 'visiting'),
        signups: t('admin.funnel.stepSignups', 'signing up'),
        activated: t('admin.funnel.stepActivated', 'activating'),
        paid: t('admin.funnel.stepPaid', 'paying'),
    };
    const known = insights.filter((i) => TEXT[i.key]);
    if (!known.length) return null;

    return (
        <section
            className="bg-white dark:bg-gray-900 rounded-lg p-5 mb-6"
            data-testid="admin-insights"
        >
            <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                {t('admin.insights.title', 'What stands out')}
            </h2>
            <ul className="space-y-2">
                {known.map((insight) => {
                    const params = { ...insight.params };
                    if (insight.key === 'biggest_drop') {
                        params.from =
                            stepLabel[params.from] ?? String(params.from);
                        params.to = stepLabel[params.to] ?? String(params.to);
                    }
                    return (
                        <li
                            key={insight.key}
                            className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-200"
                            data-testid={`admin-insight-${insight.key}`}
                        >
                            <span
                                className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${DOT[insight.tone]}`}
                            />
                            <span>
                                {t(
                                    `admin.insights.${insight.key}`,
                                    TEXT[insight.key],
                                    params
                                )}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
};

export default AdminInsights;

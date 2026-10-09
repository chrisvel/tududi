import React from 'react';
import { useTranslation } from 'react-i18next';

export interface Trends {
    days: { date: string; signups: number; waitlist: number }[];
    signups: { last7d: number; prev7d: number };
    waitlist: { last7d: number; prev7d: number };
    activation: { new_users: number; activated: number };
    onboarding?: {
        new_users: number;
        first_plan: number;
        cohort: number;
        three_days: number;
    };
    active_users_7d: number;
    billing: {
        trials_started_7d: number;
        trials_ending_7d: number;
        canceled_7d: number;
        payment_failed_7d: number;
    } | null;
}

// "+3 vs last week" style change, coloured only when it moved.
const Delta: React.FC<{ now: number; before: number }> = ({ now, before }) => {
    const { t } = useTranslation();
    const diff = now - before;
    const tone =
        diff > 0
            ? 'text-emerald-600 dark:text-emerald-400'
            : diff < 0
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-gray-500 dark:text-gray-400';
    return (
        <span className={`text-xs ${tone}`}>
            {t('admin.trends.vsLastWeek', '{{diff}} vs last week', {
                diff: diff > 0 ? `+${diff}` : String(diff),
            })}
        </span>
    );
};

const Tile: React.FC<{
    label: string;
    value: React.ReactNode;
    hint?: React.ReactNode;
    tone?: 'warn';
    testId?: string;
}> = ({ label, value, hint, tone, testId }) => (
    <div
        className={`rounded-lg p-4 ${
            tone === 'warn'
                ? 'bg-amber-50 dark:bg-amber-500/10'
                : 'bg-gray-50 dark:bg-gray-900/40'
        }`}
        data-testid={testId}
    >
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
            {value}
        </p>
        {hint && <div className="mt-0.5">{hint}</div>}
    </div>
);

// Signups per day for the last 7 days, last week's day faint behind it so
// the shape of the two weeks can be compared at a glance.
const SignupBars: React.FC<{ days: Trends['days'] }> = ({ days }) => {
    const { t } = useTranslation();
    const thisWeek = days.slice(-7);
    const lastWeek = days.slice(-14, -7);
    const max = Math.max(1, ...days.map((d) => d.signups));
    const pct = (n: number) => `${Math.round((n / max) * 100)}%`;

    return (
        <div
            className="flex items-end gap-2 h-28"
            role="img"
            aria-label={t('admin.trends.chartLabel', 'Signups per day')}
            data-testid="admin-trends-bars"
        >
            {thisWeek.map((day, i) => {
                const prev = lastWeek[i]?.signups ?? 0;
                const weekday = new Date(
                    `${day.date}T00:00:00Z`
                ).toLocaleDateString(undefined, {
                    weekday: 'short',
                    timeZone: 'UTC',
                });
                return (
                    <div
                        key={day.date}
                        className="flex-1 flex flex-col items-center h-full"
                        title={t(
                            'admin.trends.barTitle',
                            '{{date}}: {{n}} signups ({{prev}} a week before)',
                            { date: day.date, n: day.signups, prev }
                        )}
                    >
                        <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            {day.signups || ''}
                        </span>
                        <div className="relative w-full flex-1">
                            <div
                                className="absolute bottom-0 left-0 right-0 rounded-t bg-gray-200 dark:bg-gray-700"
                                style={{ height: pct(prev) }}
                            />
                            <div
                                className="absolute bottom-0 left-1/4 right-1/4 rounded-t bg-blue-500 dark:bg-blue-400"
                                style={{ height: pct(day.signups) }}
                            />
                        </div>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                            {weekday}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

const AdminTrends: React.FC<{ trends: Trends }> = ({ trends }) => {
    const { t } = useTranslation();
    const { activation, billing, onboarding } = trends;
    const rate = (part: number, whole: number): string =>
        whole ? `${Math.round((part / whole) * 100)}%` : '-';
    const activationRate = activation.new_users
        ? Math.round((activation.activated / activation.new_users) * 100)
        : null;

    return (
        <section
            className="bg-white dark:bg-gray-800 rounded-lg p-5 mb-8"
            data-testid="admin-trends"
        >
            <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
                {t('admin.trends.title', 'Last 7 days')}
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                            {trends.signups.last7d}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            {t('admin.trends.signups', 'signups')}
                        </span>
                        <Delta
                            now={trends.signups.last7d}
                            before={trends.signups.prev7d}
                        />
                    </div>
                    <SignupBars days={trends.days} />
                </div>
                <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3 content-start">
                    <Tile
                        label={t('admin.trends.activation', 'Activated')}
                        value={
                            activationRate === null ? '-' : `${activationRate}%`
                        }
                        hint={
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {t(
                                    'admin.trends.activationHint',
                                    '{{n}} of {{total}} new users created something',
                                    {
                                        n: activation.activated,
                                        total: activation.new_users,
                                    }
                                )}
                            </span>
                        }
                        testId="admin-trends-activation"
                    />
                    {onboarding && (
                        <>
                            <Tile
                                label={t(
                                    'admin.trends.firstPlan',
                                    'Planned a first day'
                                )}
                                value={rate(
                                    onboarding.first_plan,
                                    onboarding.new_users
                                )}
                                hint={
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {t(
                                            'admin.trends.firstPlanHint',
                                            '{{n}} of {{total}} new users planned 3+ tasks',
                                            {
                                                n: onboarding.first_plan,
                                                total: onboarding.new_users,
                                            }
                                        )}
                                    </span>
                                }
                                testId="admin-trends-first-plan"
                            />
                            <Tile
                                label={t(
                                    'admin.trends.threeDays',
                                    'Kept planning'
                                )}
                                value={rate(
                                    onboarding.three_days,
                                    onboarding.cohort
                                )}
                                hint={
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {t(
                                            'admin.trends.threeDaysHint',
                                            "{{n}} of {{total}} of last week's signups planned 3 days",
                                            {
                                                n: onboarding.three_days,
                                                total: onboarding.cohort,
                                            }
                                        )}
                                    </span>
                                }
                                testId="admin-trends-three-days"
                            />
                        </>
                    )}
                    <Tile
                        label={t('admin.trends.active', 'Active users')}
                        value={trends.active_users_7d}
                        hint={
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {t(
                                    'admin.trends.activeHint',
                                    'created something this week'
                                )}
                            </span>
                        }
                    />
                    <Tile
                        label={t('admin.trends.waitlist', 'Waitlist joins')}
                        value={trends.waitlist.last7d}
                        hint={
                            <Delta
                                now={trends.waitlist.last7d}
                                before={trends.waitlist.prev7d}
                            />
                        }
                    />
                    {billing && (
                        <>
                            <Tile
                                label={t(
                                    'admin.trends.trialsStarted',
                                    'Trials started'
                                )}
                                value={billing.trials_started_7d}
                            />
                            <Tile
                                label={t(
                                    'admin.trends.trialsEnding',
                                    'Trials ending in 7 days'
                                )}
                                value={billing.trials_ending_7d}
                                tone={
                                    billing.trials_ending_7d > 0
                                        ? 'warn'
                                        : undefined
                                }
                            />
                            <Tile
                                label={t(
                                    'admin.trends.churn',
                                    'Canceled · failed payments'
                                )}
                                value={`${billing.canceled_7d} · ${billing.payment_failed_7d}`}
                                tone={
                                    billing.canceled_7d +
                                        billing.payment_failed_7d >
                                    0
                                        ? 'warn'
                                        : undefined
                                }
                                testId="admin-trends-churn"
                            />
                        </>
                    )}
                </div>
            </div>
        </section>
    );
};

export default AdminTrends;

import React from 'react';
import { useTranslation } from 'react-i18next';

interface WeekCount {
    last7d: number;
    prev7d: number;
}

interface SurfaceVisits {
    views: WeekCount;
    visitors: WeekCount;
}

// Page views as the admin overview reports them. `days` is the marketing
// site and the blog together; visitors are per day, so a week's figure is
// the sum of its days.
export interface Visits {
    landing: SurfaceVisits;
    blog: SurfaceVisits;
    app: SurfaceVisits;
    days: { date: string; views: number; visitors: number }[];
    top_pages: { surface: 'landing' | 'blog'; path: string; views: number }[];
    top_referrers: { host: string; views: number }[];
    app_users: { dau: number; wau: number; prev_wau: number; mau: number };
}

export interface Trends {
    days: { date: string; signups: number; waitlist: number }[];
    signups: { last7d: number; prev7d: number };
    waitlist: { last7d: number; prev7d: number };
    activation: { new_users: number; activated: number; verified?: number };
    onboarding?: {
        new_users: number;
        first_plan: number;
        cohort: number;
        three_days: number;
    };
    active_users_7d: number;
    tasks?: {
        created: { last7d: number; prev7d: number };
        completed: { last7d: number; prev7d: number };
    };
    visits?: Visits | null;
    billing: {
        trials_started_7d: number;
        trials_ending_7d: number;
        canceled_7d: number;
        payment_failed_7d: number;
    } | null;
}

// "+3 vs last week" style change, coloured only when it moved.
export const Delta: React.FC<{ now: number; before: number }> = ({
    now,
    before,
}) => {
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

export const Tile: React.FC<{
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

// One bar per day for the last 7 days, last week's day faint behind it so
// the shape of the two weeks can be compared at a glance. `values` runs
// alongside `days`, 14 entries, oldest first.
export const DayBars: React.FC<{
    days: { date: string }[];
    values: number[];
    label: string;
    barTitle: (date: string, n: number, prev: number) => string;
    testId: string;
}> = ({ days, values, label, barTitle, testId }) => {
    const thisWeek = days.slice(-7);
    const offset = days.length - 7;
    const max = Math.max(1, ...values);
    const pct = (n: number) => `${Math.round((n / max) * 100)}%`;

    return (
        <div
            className="flex items-end gap-2 h-28"
            role="img"
            aria-label={label}
            data-testid={testId}
        >
            {thisWeek.map((day, i) => {
                const n = values[offset + i] ?? 0;
                const prev = values[offset + i - 7] ?? 0;
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
                        title={barTitle(day.date, n, prev)}
                    >
                        <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            {n || ''}
                        </span>
                        <div className="relative w-full flex-1">
                            <div
                                className="absolute bottom-0 left-0 right-0 rounded-t bg-gray-200 dark:bg-gray-700"
                                style={{ height: pct(prev) }}
                            />
                            <div
                                className="absolute bottom-0 left-1/4 right-1/4 rounded-t bg-blue-500 dark:bg-blue-400"
                                style={{ height: pct(n) }}
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
                    <DayBars
                        days={trends.days}
                        values={trends.days.map((d) => d.signups)}
                        label={t('admin.trends.chartLabel', 'Signups per day')}
                        barTitle={(date, n, prev) =>
                            t(
                                'admin.trends.barTitle',
                                '{{date}}: {{n}} signups ({{prev}} a week before)',
                                { date, n, prev }
                            )
                        }
                        testId="admin-trends-bars"
                    />
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
                    {trends.tasks && (
                        <>
                            <Tile
                                label={t(
                                    'admin.trends.tasksCreated',
                                    'Tasks created'
                                )}
                                value={trends.tasks.created.last7d}
                                hint={
                                    <Delta
                                        now={trends.tasks.created.last7d}
                                        before={trends.tasks.created.prev7d}
                                    />
                                }
                                testId="admin-trends-tasks-created"
                            />
                            <Tile
                                label={t(
                                    'admin.trends.tasksCompleted',
                                    'Tasks completed'
                                )}
                                value={trends.tasks.completed.last7d}
                                hint={
                                    <Delta
                                        now={trends.tasks.completed.last7d}
                                        before={trends.tasks.completed.prev7d}
                                    />
                                }
                                testId="admin-trends-tasks-completed"
                            />
                        </>
                    )}
                    {activation.verified !== undefined && (
                        <Tile
                            label={t('admin.trends.verified', 'Verified email')}
                            value={rate(
                                activation.verified,
                                activation.new_users
                            )}
                            hint={
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {t(
                                        'admin.trends.verifiedHint',
                                        '{{n}} of {{total}} new users',
                                        {
                                            n: activation.verified,
                                            total: activation.new_users,
                                        }
                                    )}
                                </span>
                            }
                            testId="admin-trends-verified"
                        />
                    )}
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

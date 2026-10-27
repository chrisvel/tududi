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
        trials_started_prev7d?: number;
        trials_ending_7d: number;
        canceled_7d: number;
        payment_failed_7d: number;
    } | null;
}

// `part` as a share of `whole`, with one decimal below 10% so a small
// conversion does not read as 0%. A dash when there is nothing to divide by.
export const percentOf = (part: number, whole: number): string => {
    if (!whole) return '-';
    const pct = (part / whole) * 100;
    if (pct > 0 && pct < 10) return `${pct.toFixed(1).replace(/\.0$/, '')}%`;
    return `${Math.round(pct)}%`;
};

// "+3" style change, coloured only when it moved.
export const Delta: React.FC<{ now: number; before: number }> = ({
    now,
    before,
}) => {
    const diff = now - before;
    const tone =
        diff > 0
            ? 'text-emerald-600 dark:text-emerald-400'
            : diff < 0
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-gray-400 dark:text-gray-500';
    return (
        <span className={`tabular-nums ${tone}`}>
            {diff > 0 ? `+${diff}` : String(diff)}
        </span>
    );
};

// 14 small bars, last week faint and this week solid, so the shape of the
// fortnight shows next to the totals. `values` is oldest first.
const Spark: React.FC<{ values: number[]; label: string }> = ({
    values,
    label,
}) => {
    const max = Math.max(1, ...values);
    return (
        <svg
            viewBox={`0 0 ${values.length * 4} 16`}
            className="w-20 h-4"
            role="img"
            aria-label={label}
        >
            {values.map((n, i) => {
                const h = n ? Math.max(1.5, (n / max) * 16) : 0.75;
                return (
                    <rect
                        key={i}
                        x={i * 4}
                        y={16 - h}
                        width={3}
                        height={h}
                        rx={0.5}
                        className={
                            i >= values.length - 7
                                ? 'fill-blue-500 dark:fill-blue-400'
                                : 'fill-gray-300 dark:fill-gray-600'
                        }
                    />
                );
            })}
        </svg>
    );
};

interface Row {
    key: string;
    label: string;
    hint?: string;
    now: React.ReactNode;
    before?: number;
    // Set for a plain count so the change column can be worked out.
    nowCount?: number;
    spark?: number[];
    warn?: boolean;
}

// "6 of 21 · 29%" for a share of a group.
const ofTotal = (n: number, total: number) => (
    <>
        {n}
        <span className="text-gray-400 dark:text-gray-500">
            {' '}
            / {total} · {percentOf(n, total)}
        </span>
    </>
);

const count = (
    key: string,
    label: string,
    week: { last7d: number; prev7d: number },
    extra: Partial<Row> = {}
): Row => ({
    key,
    label,
    now: week.last7d,
    nowCount: week.last7d,
    before: week.prev7d,
    ...extra,
});

const Ranking: React.FC<{
    title: string;
    empty: string;
    rows: { key: string; label: string; views: number }[];
    testId: string;
}> = ({ title, empty, rows, testId }) => (
    <div data-testid={testId}>
        <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            {title}
        </h3>
        {rows.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{empty}</p>
        ) : (
            <ul className="space-y-1">
                {rows.slice(0, 5).map((row) => (
                    <li
                        key={row.key}
                        className="flex justify-between gap-3 text-sm text-gray-700 dark:text-gray-200"
                    >
                        <span className="truncate">{row.label}</span>
                        <span className="tabular-nums text-gray-500 dark:text-gray-400">
                            {row.views}
                        </span>
                    </li>
                ))}
            </ul>
        )}
    </div>
);

// Every weekly figure in one table, this week next to the one before:
// where people came from, what this week's signups did, how the app was
// used, and on a hosted instance trials and churn. Visitors are counted
// per day, so someone back on another day counts again.
const AdminTrends: React.FC<{ trends: Trends }> = ({ trends }) => {
    const { t } = useTranslation();
    const { activation, billing, onboarding, visits } = trends;
    const groups: { key: string; title: string; rows: Row[] }[] = [];

    const reach: Row[] = [];
    if (visits) {
        const { landing, blog } = visits;
        reach.push(
            count(
                'visitors',
                t('admin.trends.visitors', 'Site visitors'),
                {
                    last7d: landing.visitors.last7d + blog.visitors.last7d,
                    prev7d: landing.visitors.prev7d + blog.visitors.prev7d,
                },
                {
                    hint: t(
                        'admin.trends.visitorsHint',
                        'marketing site and blog'
                    ),
                    spark: visits.days.map((d) => d.visitors),
                }
            ),
            count('views', t('admin.trends.views', 'Page views'), {
                last7d: landing.views.last7d + blog.views.last7d,
                prev7d: landing.views.prev7d + blog.views.prev7d,
            }),
            count('blog', t('admin.trends.blog', 'Blog readers'), blog.visitors)
        );
    }
    reach.push(
        count(
            'signups',
            t('admin.trends.signupsRow', 'Signups'),
            trends.signups,
            {
                spark: trends.days.map((d) => d.signups),
            }
        ),
        count(
            'waitlist',
            t('admin.trends.waitlist', 'Waitlist joins'),
            trends.waitlist
        )
    );
    groups.push({
        key: 'reach',
        title: t('admin.trends.reach', 'Reach'),
        rows: reach,
    });

    const newUsers: Row[] = [];
    if (activation.verified !== undefined) {
        newUsers.push({
            key: 'verified',
            label: t('admin.trends.verified', 'Verified email'),
            now: ofTotal(activation.verified, activation.new_users),
        });
    }
    newUsers.push({
        key: 'activation',
        label: t('admin.trends.createdAnything', 'Created anything'),
        now: ofTotal(activation.activated, activation.new_users),
    });
    if (onboarding) {
        newUsers.push(
            {
                key: 'first-plan',
                label: t('admin.trends.firstPlan', 'Planned a first day'),
                hint: t('admin.trends.firstPlanShort', '3+ tasks'),
                now: ofTotal(onboarding.first_plan, onboarding.new_users),
            },
            {
                key: 'three-days',
                label: t('admin.trends.threeDays', 'Kept planning'),
                hint: t(
                    'admin.trends.threeDaysShort',
                    "last week's signups, 3 days in their first week"
                ),
                now: ofTotal(onboarding.three_days, onboarding.cohort),
            }
        );
    }
    groups.push({
        key: 'new-users',
        title: t('admin.trends.newUsersGroup', "This week's signups"),
        rows: newUsers,
    });

    const usage: Row[] = [];
    if (visits?.app_users) {
        usage.push(
            count(
                'app-users',
                t('admin.trends.appUsers', 'App users'),
                {
                    last7d: visits.app_users.wau,
                    prev7d: visits.app_users.prev_wau,
                },
                {
                    hint: t(
                        'admin.trends.appUsersHint',
                        '{{day}} today · {{month}} in 30 days',
                        {
                            day: visits.app_users.dau,
                            month: visits.app_users.mau,
                        }
                    ),
                }
            )
        );
    }
    usage.push({
        key: 'creators',
        label: t('admin.trends.creators', 'Created something'),
        hint: t('admin.trends.creatorsHint', 'users, any kind of item'),
        now: trends.active_users_7d,
    });
    if (trends.tasks) {
        usage.push(
            count(
                'tasks-created',
                t('admin.trends.tasksCreated', 'Tasks created'),
                trends.tasks.created
            ),
            count(
                'tasks-completed',
                t('admin.trends.tasksCompleted', 'Tasks completed'),
                trends.tasks.completed
            )
        );
    }
    groups.push({
        key: 'usage',
        title: t('admin.trends.usage', 'Usage'),
        rows: usage,
    });

    if (billing) {
        groups.push({
            key: 'billing',
            title: t('admin.trends.trialsAndChurn', 'Trials and churn'),
            rows: [
                {
                    key: 'trials-started',
                    label: t('admin.trends.trialsStarted', 'Trials started'),
                    now: billing.trials_started_7d,
                    nowCount: billing.trials_started_7d,
                    before: billing.trials_started_prev7d,
                },
                {
                    key: 'trials-ending',
                    label: t(
                        'admin.trends.trialsEnding',
                        'Trials ending in 7 days'
                    ),
                    now: billing.trials_ending_7d,
                },
                {
                    key: 'canceled',
                    label: t('admin.trends.canceled', 'Canceled'),
                    now: billing.canceled_7d,
                    warn: billing.canceled_7d > 0,
                },
                {
                    key: 'failed',
                    label: t('admin.trends.failed', 'Failed payments'),
                    now: billing.payment_failed_7d,
                    warn: billing.payment_failed_7d > 0,
                },
            ],
        });
    }

    const th = 'px-3 py-2 font-medium text-right';
    return (
        <section
            className="bg-white dark:bg-gray-900 rounded-lg p-5 mb-6"
            data-testid="admin-trends"
        >
            <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                {t('admin.trends.title', 'Last 7 days')}
            </h2>
            <div className="overflow-x-auto -mx-3">
                <table className="w-full text-sm">
                    <thead className="text-xs text-gray-500 dark:text-gray-400">
                        <tr>
                            <th className="px-3 py-2 font-medium text-left" />
                            <th className={th}>
                                {t('admin.trends.thisWeek', 'This week')}
                            </th>
                            <th className={th}>
                                {t('admin.trends.lastWeek', 'Last week')}
                            </th>
                            <th className={th}>
                                {t('admin.trends.change', 'Change')}
                            </th>
                            <th className="px-3 py-2 font-medium text-right hidden sm:table-cell">
                                {t('admin.trends.fortnight', '14 days')}
                            </th>
                        </tr>
                    </thead>
                    {groups.map((group) => (
                        <tbody key={group.key}>
                            <tr>
                                <th
                                    colSpan={5}
                                    className="px-3 pt-4 pb-1 text-left text-xs font-medium text-gray-500 dark:text-gray-400"
                                >
                                    {group.title}
                                </th>
                            </tr>
                            {group.rows.map((row) => (
                                <tr
                                    key={row.key}
                                    className={
                                        row.warn
                                            ? 'bg-amber-50 dark:bg-amber-500/10'
                                            : 'odd:bg-gray-50 dark:odd:bg-gray-800/60'
                                    }
                                    data-testid={`admin-trends-${row.key}`}
                                >
                                    <td className="px-3 py-1.5 text-gray-700 dark:text-gray-200">
                                        {row.label}
                                        {row.hint && (
                                            <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                                                {row.hint}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-1.5 text-right tabular-nums font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                        {row.now}
                                    </td>
                                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-500 dark:text-gray-400">
                                        {row.before ?? ''}
                                    </td>
                                    <td className="px-3 py-1.5 text-right">
                                        {row.nowCount !== undefined &&
                                            row.before !== undefined && (
                                                <Delta
                                                    now={row.nowCount}
                                                    before={row.before}
                                                />
                                            )}
                                    </td>
                                    <td className="px-3 py-1.5 text-right hidden sm:table-cell">
                                        {row.spark && (
                                            <span className="inline-flex justify-end">
                                                <Spark
                                                    values={row.spark}
                                                    label={row.label}
                                                />
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    ))}
                </table>
            </div>

            {visits && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-5">
                    <Ranking
                        title={t('admin.visits.topPages', 'Top pages')}
                        empty={t('admin.visits.noPages', 'No page views yet')}
                        rows={visits.top_pages.map((p) => ({
                            key: `${p.surface}:${p.path}`,
                            label:
                                p.surface === 'blog'
                                    ? `blog ${p.path}`
                                    : p.path,
                            views: p.views,
                        }))}
                        testId="admin-visits-pages"
                    />
                    <Ranking
                        title={t('admin.visits.topReferrers', 'Top referrers')}
                        empty={t(
                            'admin.visits.noReferrers',
                            'No referrers yet'
                        )}
                        rows={visits.top_referrers.map((r) => ({
                            key: r.host,
                            label: r.host,
                            views: r.views,
                        }))}
                        testId="admin-visits-referrers"
                    />
                </div>
            )}
        </section>
    );
};

export default AdminTrends;

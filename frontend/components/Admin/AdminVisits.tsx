import React from 'react';
import { useTranslation } from 'react-i18next';
import { DayBars, Delta, Tile, Visits } from './AdminTrends';

const Muted: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span className="text-xs text-gray-500 dark:text-gray-400">{children}</span>
);

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
                {rows.map((row) => (
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

// Page views of the marketing site, the blog and the app. Visitors are
// counted per day (a person back on another day counts again), and the
// marketing site and the blog are added together.
const AdminVisits: React.FC<{ visits: Visits }> = ({ visits }) => {
    const { t } = useTranslation();
    const { landing, blog, app, app_users: appUsers } = visits;

    const visitors = {
        last7d: landing.visitors.last7d + blog.visitors.last7d,
        prev7d: landing.visitors.prev7d + blog.visitors.prev7d,
    };
    const views = {
        last7d: landing.views.last7d + blog.views.last7d,
        prev7d: landing.views.prev7d + blog.views.prev7d,
    };
    return (
        <section
            className="bg-white dark:bg-gray-900 rounded-lg p-5 mb-8"
            data-testid="admin-visits"
        >
            <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
                {t('admin.visits.title', 'Visits, last 7 days')}
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                            {visitors.last7d}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            {t('admin.visits.visitors', 'visitors')}
                        </span>
                        <Delta now={visitors.last7d} before={visitors.prev7d} />
                    </div>
                    <DayBars
                        days={visits.days}
                        values={visits.days.map((d) => d.visitors)}
                        label={t('admin.visits.chartLabel', 'Visitors per day')}
                        barTitle={(date, n, prev) =>
                            t(
                                'admin.visits.barTitle',
                                '{{date}}: {{n}} visitors ({{prev}} a week before)',
                                { date, n, prev }
                            )
                        }
                        testId="admin-visits-bars"
                    />
                </div>
                <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3 content-start">
                    <Tile
                        label={t('admin.visits.views', 'Page views')}
                        value={views.last7d}
                        hint={
                            <Delta now={views.last7d} before={views.prev7d} />
                        }
                        testId="admin-visits-views"
                    />
                    <Tile
                        label={t('admin.visits.blog', 'Blog readers')}
                        value={blog.visitors.last7d}
                        hint={
                            <Delta
                                now={blog.visitors.last7d}
                                before={blog.visitors.prev7d}
                            />
                        }
                        testId="admin-visits-blog"
                    />
                    <Tile
                        label={t('admin.visits.appOpens', 'App opens')}
                        value={app.views.last7d}
                        hint={
                            <Delta
                                now={app.views.last7d}
                                before={app.views.prev7d}
                            />
                        }
                        testId="admin-visits-app-opens"
                    />
                    <Tile
                        label={t('admin.visits.appUsers', 'App users')}
                        value={appUsers.wau}
                        hint={
                            <div className="flex flex-wrap items-baseline gap-x-2">
                                <Delta
                                    now={appUsers.wau}
                                    before={appUsers.prev_wau}
                                />
                                <Muted>
                                    {t(
                                        'admin.visits.appUsersHint',
                                        '{{day}} today · {{month}} in 30 days',
                                        {
                                            day: appUsers.dau,
                                            month: appUsers.mau,
                                        }
                                    )}
                                </Muted>
                            </div>
                        }
                        testId="admin-visits-app-users"
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <Ranking
                    title={t('admin.visits.topPages', 'Top pages')}
                    empty={t('admin.visits.noPages', 'No page views yet')}
                    rows={visits.top_pages.map((p) => ({
                        key: `${p.surface}:${p.path}`,
                        label: p.surface === 'blog' ? `blog ${p.path}` : p.path,
                        views: p.views,
                    }))}
                    testId="admin-visits-pages"
                />
                <Ranking
                    title={t('admin.visits.topReferrers', 'Top referrers')}
                    empty={t('admin.visits.noReferrers', 'No referrers yet')}
                    rows={visits.top_referrers.map((r) => ({
                        key: r.host,
                        label: r.host,
                        views: r.views,
                    }))}
                    testId="admin-visits-referrers"
                />
            </div>
        </section>
    );
};

export default AdminVisits;

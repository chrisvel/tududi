import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EnvelopeIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useToast } from '../Shared/ToastContext';
import {
    fetchWaitlist,
    downloadWaitlistCsv,
    WaitlistEntry,
} from '../../utils/adminWaitlistService';

const PAGE_SIZE = 50;

// Everyone waiting for Cloud to open, which is the list that gets mailed on
// launch day. Read-only on purpose: rows arrive from the marketing page and
// the register page, and nothing here should be able to edit them.
const AdminWaitlistPage: React.FC = () => {
    const { t } = useTranslation();
    const { showErrorToast } = useToast();
    const [entries, setEntries] = useState<WaitlistEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [query, setQuery] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchWaitlist({
                q: search,
                limit: PAGE_SIZE,
                offset: page * PAGE_SIZE,
            });
            setEntries(data.subscribers);
            setTotal(data.total);
        } catch (err: any) {
            showErrorToast(err.message || 'Failed to load the waitlist');
        } finally {
            setLoading(false);
        }
    }, [search, page, showErrorToast]);

    useEffect(() => {
        load();
    }, [load]);

    const exportCsv = async () => {
        setExporting(true);
        try {
            await downloadWaitlistCsv();
        } catch (err: any) {
            showErrorToast(err.message || 'Failed to export the waitlist');
        } finally {
            setExporting(false);
        }
    };

    const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
    const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
    const to = Math.min(total, page * PAGE_SIZE + entries.length);

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center">
                    <EnvelopeIcon className="w-7 h-7 mr-3 text-blue-500" />
                    {t('admin.waitlist.title', 'Waitlist')}
                </h1>
                <button
                    type="button"
                    onClick={exportCsv}
                    disabled={exporting || total === 0}
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60"
                    data-testid="admin-waitlist-export"
                >
                    <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                    {t('admin.waitlist.export', 'Export CSV')}
                </button>
            </div>

            <form
                className="flex items-center gap-2 mb-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    setPage(0);
                    setSearch(query.trim());
                }}
            >
                <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t(
                        'admin.waitlist.searchPlaceholder',
                        'Search by email'
                    )}
                    className="flex-1 max-w-md px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    data-testid="admin-waitlist-search"
                />
                <button
                    type="submit"
                    className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                    {t('common.search', 'Search')}
                </button>
            </form>

            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900 text-left text-gray-600 dark:text-gray-300">
                        <tr>
                            <th className="px-4 py-2">
                                {t('admin.waitlist.email', 'Email')}
                            </th>
                            <th className="px-4 py-2">
                                {t('admin.waitlist.source', 'Source')}
                            </th>
                            <th className="px-4 py-2">
                                {t('admin.waitlist.locale', 'Language')}
                            </th>
                            <th className="px-4 py-2">
                                {t('admin.waitlist.submissions', 'Submissions')}
                            </th>
                            <th className="px-4 py-2">
                                {t('admin.waitlist.joined', 'Joined')}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {loading ? (
                            <tr>
                                <td
                                    className="px-4 py-3 text-gray-500"
                                    colSpan={5}
                                >
                                    {t('common.loading', 'Loading...')}
                                </td>
                            </tr>
                        ) : entries.length === 0 ? (
                            <tr>
                                <td
                                    className="px-4 py-3 text-gray-500"
                                    colSpan={5}
                                    data-testid="admin-waitlist-empty"
                                >
                                    {search
                                        ? t(
                                              'admin.waitlist.noMatches',
                                              'No addresses match that search'
                                          )
                                        : t(
                                              'admin.waitlist.empty',
                                              'Nobody has signed up yet'
                                          )}
                                </td>
                            </tr>
                        ) : (
                            entries.map((entry) => (
                                <tr
                                    key={entry.id}
                                    className="text-gray-900 dark:text-gray-100"
                                >
                                    <td className="px-4 py-2">{entry.email}</td>
                                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                                        {entry.source}
                                    </td>
                                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                                        {entry.locale || '-'}
                                    </td>
                                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                                        {entry.submission_count}
                                    </td>
                                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                                        {new Date(
                                            entry.created_at
                                        ).toLocaleString()}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between mt-4 text-sm text-gray-500 dark:text-gray-400">
                <span data-testid="admin-waitlist-count">
                    {t(
                        'admin.waitlist.showing',
                        '{{from}}-{{to}} of {{total}}',
                        {
                            from,
                            to,
                            total,
                        }
                    )}
                </span>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0 || loading}
                        className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-50"
                    >
                        {t('common.previous', 'Previous')}
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            setPage((p) => Math.min(lastPage, p + 1))
                        }
                        disabled={page >= lastPage || loading}
                        className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-50"
                    >
                        {t('common.next', 'Next')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminWaitlistPage;

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    EnvelopeIcon,
    ArrowDownTrayIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import { useToast } from '../Shared/ToastContext';
import ConfirmDialog from '../Shared/ConfirmDialog';
import {
    fetchWaitlist,
    downloadWaitlistCsv,
    deleteWaitlistEntry,
    WaitlistEntry,
} from '../../utils/adminWaitlistService';

const PAGE_SIZE = 50;

// Everyone waiting for Cloud to open, which is the list that gets mailed on
// launch day. Rows arrive from the marketing page and the register page;
// removing one here is the only edit this page allows.
const AdminWaitlistPage: React.FC = () => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [entries, setEntries] = useState<WaitlistEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [query, setQuery] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [entryToDelete, setEntryToDelete] = useState<WaitlistEntry | null>(
        null
    );

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

    const handleDelete = async () => {
        if (!entryToDelete) return;
        try {
            await deleteWaitlistEntry(entryToDelete.id);
            setEntries((prev) =>
                prev.filter((e) => e.id !== entryToDelete.id)
            );
            setTotal((prev) => Math.max(0, prev - 1));
            showSuccessToast(
                t('admin.waitlist.removed', 'Removed from the waitlist')
            );
        } catch (err: any) {
            showErrorToast(
                err.message ||
                    t('admin.waitlist.removeFailed', 'Failed to remove entry')
            );
        } finally {
            setEntryToDelete(null);
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
                            <th className="px-4 py-2">
                                {t('admin.waitlist.ipAddress', 'IP Address')}
                            </th>
                            <th className="px-4 py-2 text-right">
                                {t('common.actions', 'Actions')}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {loading ? (
                            <tr>
                                <td
                                    className="px-4 py-3 text-gray-500"
                                    colSpan={7}
                                >
                                    {t('common.loading', 'Loading...')}
                                </td>
                            </tr>
                        ) : entries.length === 0 ? (
                            <tr>
                                <td
                                    className="px-4 py-3 text-gray-500"
                                    colSpan={7}
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
                                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400 font-mono text-xs">
                                        {entry.ip_address || '-'}
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setEntryToDelete(entry)
                                            }
                                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                            title={t('common.delete', 'Delete')}
                                            data-testid="admin-waitlist-delete"
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
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

            {entryToDelete && (
                <ConfirmDialog
                    title={t('admin.waitlist.removeTitle', 'Remove Address')}
                    message={t(
                        'admin.waitlist.confirmRemove',
                        'Remove {{email}} from the waitlist? This cannot be undone.',
                        { email: entryToDelete.email }
                    )}
                    onConfirm={handleDelete}
                    onCancel={() => setEntryToDelete(null)}
                />
            )}
        </div>
    );
};

export default AdminWaitlistPage;

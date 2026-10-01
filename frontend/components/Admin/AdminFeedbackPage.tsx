import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    BugAntIcon,
    CheckCircleIcon,
    ArrowUturnLeftIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import { useToast } from '../Shared/ToastContext';
import ConfirmDialog from '../Shared/ConfirmDialog';
import {
    fetchFeedback,
    setFeedbackResolved,
    deleteFeedback,
    FeedbackEntry,
    FeedbackStatus,
} from '../../utils/feedbackService';

const PAGE_SIZE = 50;

// Rows written before validation existed, or by hand, still must not
// become a javascript: or off-site link.
const isAppPath = (url: string) => /^\/(?![/\\])/.test(url);

// Everything users sent from the bug icon in the sidebar footer. Open items
// come first; marking one resolved moves it out of the way without losing
// it, and deleting is for spam.
const AdminFeedbackPage: React.FC = () => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [entries, setEntries] = useState<FeedbackEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [openCount, setOpenCount] = useState(0);
    const [status, setStatus] = useState<FeedbackStatus>('open');
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [entryToDelete, setEntryToDelete] = useState<FeedbackEntry | null>(
        null
    );

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchFeedback({
                status,
                limit: PAGE_SIZE,
                offset: page * PAGE_SIZE,
            });
            setEntries(data.feedback);
            setTotal(data.total);
            setOpenCount(data.open);
        } catch (err: any) {
            showErrorToast(err.message || 'Failed to load feedback');
        } finally {
            setLoading(false);
        }
    }, [status, page, showErrorToast]);

    useEffect(() => {
        load();
    }, [load]);

    const toggleResolved = async (entry: FeedbackEntry) => {
        try {
            await setFeedbackResolved(entry.id, !entry.resolved_at);
            await load();
        } catch (err: any) {
            showErrorToast(
                err.message ||
                    t('admin.feedback.updateFailed', 'Failed to update')
            );
        }
    };

    const handleDelete = async () => {
        if (!entryToDelete) return;
        try {
            await deleteFeedback(entryToDelete.id);
            showSuccessToast(t('admin.feedback.deleted', 'Feedback deleted'));
            await load();
        } catch (err: any) {
            showErrorToast(
                err.message ||
                    t('admin.feedback.deleteFailed', 'Failed to delete')
            );
        } finally {
            setEntryToDelete(null);
        }
    };

    const tabs: { key: FeedbackStatus; label: string }[] = [
        {
            key: 'open',
            label: t('admin.feedback.open', 'Open ({{count}})', {
                count: openCount,
            }),
        },
        { key: 'resolved', label: t('admin.feedback.resolved', 'Resolved') },
        { key: 'all', label: t('admin.feedback.all', 'All') },
    ];

    const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center mb-6">
                <BugAntIcon className="w-7 h-7 mr-3 text-rose-500" />
                {t('admin.feedback.title', 'Feedback')}
            </h1>

            <div className="flex gap-1 mb-4" role="tablist">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={status === tab.key}
                        onClick={() => {
                            setStatus(tab.key);
                            setPage(0);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm ${
                            status === tab.key
                                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                        data-testid={`admin-feedback-tab-${tab.key}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <p className="text-gray-500 dark:text-gray-400">
                    {t('common.loading', 'Loading...')}
                </p>
            ) : entries.length === 0 ? (
                <p
                    className="text-gray-500 dark:text-gray-400"
                    data-testid="admin-feedback-empty"
                >
                    {status === 'open'
                        ? t('admin.feedback.emptyOpen', 'Nothing open. Nice.')
                        : t('admin.feedback.empty', 'No feedback yet.')}
                </p>
            ) : (
                <ul className="space-y-3">
                    {entries.map((entry) => (
                        <li
                            key={entry.id}
                            className={`rounded-lg p-4 bg-white dark:bg-gray-800 ${
                                entry.resolved_at ? 'opacity-60' : ''
                            }`}
                            data-testid="admin-feedback-item"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words min-w-0">
                                    {entry.message}
                                </p>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => toggleResolved(entry)}
                                        className="p-1.5 rounded-md text-gray-500 hover:text-green-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                                        title={
                                            entry.resolved_at
                                                ? t(
                                                      'admin.feedback.reopen',
                                                      'Reopen'
                                                  )
                                                : t(
                                                      'admin.feedback.markResolved',
                                                      'Mark resolved'
                                                  )
                                        }
                                        data-testid="admin-feedback-toggle"
                                    >
                                        {entry.resolved_at ? (
                                            <ArrowUturnLeftIcon className="w-5 h-5" />
                                        ) : (
                                            <CheckCircleIcon className="w-5 h-5" />
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEntryToDelete(entry)}
                                        className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                                        title={t('common.delete', 'Delete')}
                                        data-testid="admin-feedback-delete"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                                <span>
                                    {entry.user
                                        ? entry.user.name
                                            ? `${entry.user.name} · ${entry.user.email}`
                                            : entry.user.email
                                        : '-'}
                                </span>
                                <span>
                                    {new Date(
                                        entry.created_at
                                    ).toLocaleString()}
                                </span>
                                {entry.page_url &&
                                    !isAppPath(entry.page_url) && (
                                        <span>{entry.page_url}</span>
                                    )}
                                {entry.page_url &&
                                    isAppPath(entry.page_url) && (
                                        <Link
                                            to={entry.page_url}
                                            className="text-blue-500 hover:text-blue-600"
                                        >
                                            {entry.page_url}
                                        </Link>
                                    )}
                                {entry.app_version && (
                                    <span>{entry.app_version}</span>
                                )}
                                {entry.user_agent && (
                                    <span
                                        className="truncate max-w-full sm:max-w-md"
                                        title={entry.user_agent}
                                    >
                                        {entry.user_agent}
                                    </span>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {total > PAGE_SIZE && (
                <div className="flex justify-end gap-2 mt-4 text-sm">
                    <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0 || loading}
                        className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-800 disabled:opacity-50"
                    >
                        {t('common.previous', 'Previous')}
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            setPage((p) => Math.min(lastPage, p + 1))
                        }
                        disabled={page >= lastPage || loading}
                        className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-800 disabled:opacity-50"
                    >
                        {t('common.next', 'Next')}
                    </button>
                </div>
            )}

            {entryToDelete && (
                <ConfirmDialog
                    title={t('admin.feedback.deleteTitle', 'Delete Feedback')}
                    message={t(
                        'admin.feedback.confirmDelete',
                        'Delete this feedback? This cannot be undone.'
                    )}
                    onConfirm={handleDelete}
                    onCancel={() => setEntryToDelete(null)}
                />
            )}
        </div>
    );
};

export default AdminFeedbackPage;

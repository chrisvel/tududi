import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    BugAntIcon,
    CheckCircleIcon,
    ArrowUturnLeftIcon,
    TrashIcon,
    LinkIcon,
    ComputerDesktopIcon,
    TagIcon,
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
import { avatarTint } from '../../utils/avatarTint';

const PAGE_SIZE = 50;

// Rows written before validation existed, or by hand, still must not
// become a javascript: or off-site link.
const isAppPath = (url: string) => /^\/(?![/\\])/.test(url);

const initials = (name: string) =>
    name
        .split(/[\s@.]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('') || '?';

// "Chrome · macOS" is all an admin needs at a glance; the full string is
// in the chip's tooltip.
const describeBrowser = (ua: string | null) => {
    if (!ua) return null;
    const browser = /Edg\//.test(ua)
        ? 'Edge'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Chrome\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : null;
    const os = /iPhone|iPad/.test(ua)
        ? 'iOS'
        : /Android/.test(ua)
          ? 'Android'
          : /Mac OS X/.test(ua)
            ? 'macOS'
            : /Windows/.test(ua)
              ? 'Windows'
              : /Linux/.test(ua)
                ? 'Linux'
                : null;
    return [browser, os].filter(Boolean).join(' · ') || ua.slice(0, 40);
};

const timeAgo = (iso: string) => {
    const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
        ['year', 31536000],
        ['month', 2592000],
        ['week', 604800],
        ['day', 86400],
        ['hour', 3600],
        ['minute', 60],
    ];
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    for (const [unit, size] of units) {
        if (Math.abs(seconds) >= size) {
            return rtf.format(Math.round(seconds / size), unit);
        }
    }
    return rtf.format(0, 'minute');
};

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
    const [expanded, setExpanded] = useState<Set<number>>(new Set());

    const toggleExpanded = (id: number) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

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
                <ul className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/60">
                    {entries.map((entry) => {
                        const resolved = Boolean(entry.resolved_at);
                        const isOpen = expanded.has(entry.id);
                        const browser = describeBrowser(entry.user_agent);
                        const sender =
                            entry.user?.name || entry.user?.email || '-';
                        const preview = entry.message.replace(/\s+/g, ' ');
                        return (
                            <li
                                key={entry.id}
                                className={
                                    isOpen
                                        ? 'bg-gray-50 dark:bg-gray-900/40'
                                        : ''
                                }
                                data-testid="admin-feedback-item"
                            >
                                <div
                                    role="button"
                                    tabIndex={0}
                                    aria-expanded={isOpen}
                                    onClick={() => toggleExpanded(entry.id)}
                                    onKeyDown={(e) => {
                                        if (
                                            e.key === 'Enter' ||
                                            e.key === ' '
                                        ) {
                                            e.preventDefault();
                                            toggleExpanded(entry.id);
                                        }
                                    }}
                                    className="group flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 focus:outline-none focus-visible:bg-gray-50 dark:focus-visible:bg-gray-700/40"
                                    data-testid="admin-feedback-row"
                                >
                                    <span
                                        className={`w-2 h-2 rounded-full shrink-0 ${
                                            resolved
                                                ? 'bg-transparent'
                                                : 'bg-rose-500'
                                        }`}
                                        title={
                                            resolved
                                                ? t(
                                                      'admin.feedback.statusResolved',
                                                      'Resolved'
                                                  )
                                                : t(
                                                      'admin.feedback.statusOpen',
                                                      'Open'
                                                  )
                                        }
                                    />
                                    <span
                                        className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold shrink-0 ${avatarTint(
                                            entry.user?.email || sender
                                        )}`}
                                        aria-hidden="true"
                                    >
                                        {initials(sender)}
                                    </span>
                                    <span
                                        className={`w-32 sm:w-48 shrink-0 truncate text-sm ${
                                            resolved
                                                ? 'text-gray-500 dark:text-gray-400'
                                                : 'font-semibold text-gray-900 dark:text-white'
                                        }`}
                                    >
                                        {sender}
                                    </span>
                                    <span
                                        className={`flex-1 min-w-0 truncate text-sm ${
                                            resolved
                                                ? 'text-gray-400 dark:text-gray-500'
                                                : 'text-gray-600 dark:text-gray-300'
                                        }`}
                                    >
                                        {preview}
                                    </span>
                                    {entry.page_url && (
                                        <span className="hidden md:inline-block max-w-[10rem] truncate shrink-0 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700/60 text-xs text-gray-500 dark:text-gray-300">
                                            {entry.page_url}
                                        </span>
                                    )}
                                    <time
                                        className={`w-24 shrink-0 text-right text-xs ${
                                            resolved
                                                ? 'text-gray-400 dark:text-gray-500'
                                                : 'font-medium text-gray-700 dark:text-gray-200'
                                        }`}
                                        dateTime={entry.created_at}
                                        title={new Date(
                                            entry.created_at
                                        ).toLocaleString()}
                                    >
                                        {timeAgo(entry.created_at)}
                                    </time>
                                </div>

                                {isOpen && (
                                    <div className="px-4 pb-4 sm:pl-[4.25rem]">
                                        {entry.user?.name && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                                {entry.user.email}
                                            </p>
                                        )}
                                        <p className="text-[15px] leading-relaxed text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words">
                                            {entry.message}
                                        </p>
                                        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
                                            {entry.page_url &&
                                                (isAppPath(entry.page_url) ? (
                                                    <Link
                                                        to={entry.page_url}
                                                        className="inline-flex items-center max-w-full px-2 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
                                                        title={entry.page_url}
                                                    >
                                                        <LinkIcon className="w-3.5 h-3.5 mr-1 shrink-0" />
                                                        <span className="truncate">
                                                            {entry.page_url}
                                                        </span>
                                                    </Link>
                                                ) : (
                                                    <span className="inline-flex items-center max-w-full px-2 py-1 rounded-md bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300">
                                                        <span className="truncate">
                                                            {entry.page_url}
                                                        </span>
                                                    </span>
                                                ))}
                                            {browser && (
                                                <span
                                                    className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300"
                                                    title={
                                                        entry.user_agent || ''
                                                    }
                                                >
                                                    <ComputerDesktopIcon className="w-3.5 h-3.5 mr-1" />
                                                    {browser}
                                                </span>
                                            )}
                                            {entry.app_version && (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300">
                                                    <TagIcon className="w-3.5 h-3.5 mr-1" />
                                                    {entry.app_version}
                                                </span>
                                            )}
                                            <span className="text-gray-400 dark:text-gray-500 ml-1">
                                                {new Date(
                                                    entry.created_at
                                                ).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="mt-4 flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    toggleResolved(entry)
                                                }
                                                className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-sm ${
                                                    resolved
                                                        ? 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                                                        : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20'
                                                }`}
                                                data-testid="admin-feedback-toggle"
                                            >
                                                {resolved ? (
                                                    <ArrowUturnLeftIcon className="w-4 h-4 mr-1.5" />
                                                ) : (
                                                    <CheckCircleIcon className="w-4 h-4 mr-1.5" />
                                                )}
                                                {resolved
                                                    ? t(
                                                          'admin.feedback.reopen',
                                                          'Reopen'
                                                      )
                                                    : t(
                                                          'admin.feedback.markResolved',
                                                          'Mark resolved'
                                                      )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setEntryToDelete(entry)
                                                }
                                                className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                                                data-testid="admin-feedback-delete"
                                            >
                                                <TrashIcon className="w-4 h-4 mr-1.5" />
                                                {t('common.delete', 'Delete')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        );
                    })}
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
